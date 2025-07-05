/**
 * Data Loading Service
 * 
 * Handles efficient loading of large datasets with support for:
 * - Compressed file formats
 * - Browser caching
 */

import { getCurrentDataSources, getLoadingStrategy, DATA_CONFIG } from '../config/dataSources';
import { PropertyData } from '../types';

export type { PropertyData };

export interface LoadingProgress {
  status: string;
  progress: number; // 0-100
  loaded: number;
  total: number;
}

class DataLoaderService {
  private tableData: PropertyData[] = [];
  private detailDataCache = new Map<number, PropertyData>();
  
  // Cache management
  private cacheKey = 'model_analyzer_data';
  private cacheTimestamp = 'model_analyzer_timestamp';
  
  constructor() {
    // Clear cache to ensure fresh data loading with proper row_id generation
    this.clearCache();
  }
  
  async loadTableData(onProgress?: (progress: LoadingProgress) => void): Promise<PropertyData[]> {
    const loadingStrategy = getLoadingStrategy(); // Get the latest strategy
    try {
      // Check if we can use cached data
      if (loadingStrategy.enableBrowserCache && this.isCacheValid()) {
        const cachedData = this.getCachedData();
        if (cachedData) {
          onProgress?.({
            status: 'Loading from cache...',
            progress: 100,
            loaded: cachedData.length,
            total: cachedData.length
          });
          this.tableData = cachedData;
          return cachedData;
        }
      }
      
      // Load the main dataset
      return await this.loadFullDataset(onProgress);
      
    } catch (error) {
      console.error('Error loading table data:', error);
      throw error;
    }
  }
  
  private async loadFullDataset(onProgress?: (progress: LoadingProgress) => void): Promise<PropertyData[]> {
    const sources = getCurrentDataSources();
    
    console.log('📁 Loading dataset from:', sources.properties);
    console.log('📁 Is compressed?', sources.properties.endsWith('.gz'));
    
    onProgress?.({
      status: 'Loading dataset...',
      progress: 10,
      loaded: 0,
      total: 0
    });
    
    // ---------------------------------------------------------------------
    // 🔐 Obtain a short-lived pre-signed URL so we can keep the Wasabi bucket
    //     private.  If the Netlify function is not available (e.g. local dev
    //     without `netlify dev`) we gracefully fall back to the public path.
    // ---------------------------------------------------------------------
    let dataUrl = sources.properties;
    try {
      const loadingStrategy = getLoadingStrategy(); // Get the latest strategy
      const datasetKey = loadingStrategy.selectedPropertyFile || 'DBSCAN_HIERARCHICAL';
      const presignEndpoint = `/.netlify/functions/get-signed-url?dataset=${encodeURIComponent(datasetKey)}`;
      const presignResp = await fetch(presignEndpoint);
      if (presignResp.ok) {
        const json = await presignResp.json();
        if (json?.url) {
          console.log('🔑 Using signed URL for dataset');
          dataUrl = json.url;
        } else {
          console.warn('⚠️ Signed URL response missing "url" field, falling back to public path');
        }
      } else {
        console.warn('⚠️ Signed URL request failed (status', presignResp.status, '), falling back');
      }
    } catch (error) {
      console.warn('⚠️ Could not obtain signed URL, proceeding with public path:', error);
    }
    
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.statusText}`);
    }
    
    console.log('📁 Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('📁 Response size:', response.headers.get('content-length'), 'bytes');
    
    onProgress?.({
      status: 'Reading dataset (this may take a while)...',
      progress: 30,
      loaded: 0,
      total: 0
    });
    
    let csvContent: string;
    
    // Handle compressed data
    if (sources.properties.endsWith('.gz')) {
      // If we are using a signed URL, we must manually decompress.
      // Otherwise, the browser might handle it automatically if Content-Encoding is set.
      if (dataUrl.includes('X-Amz-Signature')) {
        console.log('🗜️ Manual decompression required for signed URL');
        const buffer = await response.arrayBuffer();
        csvContent = await this.decompressGzip(buffer);
      } else {
        // For local files, let the browser attempt to decompress first
        try {
          console.log('🗜️ Attempting automatic decompression...');
          csvContent = await response.text();
          // A simple check to see if decompression likely worked.
          if (!csvContent.startsWith('prompt') && !csvContent.startsWith('"prompt"')) {
             throw new Error('Automatic decompression failed, content does not look like a CSV.');
          }
          console.log('✅ Automatic decompression successful');
        } catch (e) {
          console.warn('⚠️ Automatic decompression failed, trying manual fallback.', e);
          // This part is tricky because response.text() consumes the body.
          // For simplicity, we'll recommend running with `netlify dev` for local testing.
          // A more robust solution would involve cloning the response.
          throw new Error('Could not decompress file. For local testing of gzipped files, please use `netlify dev`.');
        }
      }
    } else {
      csvContent = await response.text();
      console.log('📁 Uncompressed size:', csvContent.length, 'characters');
    }
    
    const Papa = (await import('papaparse')).default;
    
    onProgress?.({
      status: 'Parsing dataset...',
      progress: 70,
      loaded: 0,
      total: 0
    });
    
    // Debug: Log the first few lines to understand the structure
    const firstLines = csvContent.split('\n').slice(0, 3);
    console.log('📈 First 3 lines of CSV:', firstLines);
    
    const parsedData = Papa.parse(csvContent, {
      header: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
      skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
      transformHeader: (header: string) => {
        return header.replace(/^\uFEFF/, '').trim();
      },
      transform: (value: string) => {
        if (typeof value === 'string') {
          return value.replace(/^["']|["']$/g, '').trim();
        }
        return value;
      }
    });
    
    console.log('📈 Dataset parsed. Total rows:', parsedData.data?.length || 0);
    
    // Simple column comparison debugging
    const actualColumns = Object.keys(parsedData.data?.[0] || {});
    const expectedColumns = ['prompt', 'model_1_response', 'model_2_response', 'model_1_name', 'model_2_name', 'differences', 'model', 'property_description', 'category', 'type', 'reason', 'impact'];
    
    console.log('📊 Expected columns:', expectedColumns);
    console.log('📊 Actual columns found:', actualColumns);
    console.log('📊 Missing columns:', expectedColumns.filter(col => !actualColumns.includes(col)));
    console.log('📊 Extra columns:', actualColumns.filter(col => !expectedColumns.includes(col)));
    
    console.log('📈 First row sample:', parsedData.data?.[0]);
    console.log('📈 Parse errors:', parsedData.errors?.length || 0);
    if (parsedData.errors && parsedData.errors.length > 0) {
      console.log('📈 Parse errors sample:', parsedData.errors.slice(0, 3));
    }
    
    // Filter and process valid rows
    const validRows = (parsedData.data as any[]).filter(row => row && row.property_description);
    console.log('📈 Rows after filtering:', validRows.length);
    console.log('📈 Sample valid row:', validRows[0]);
    
    const processedData = validRows.map((row, index) => {
      row.row_id = index + 1;
      return this.normalizePropertyData(row);
    });
    console.log('📈 Rows after normalization:', processedData.length);
    
    // Cache the processed data
    const loadingStrategy = getLoadingStrategy(); // Get the latest strategy
    if (loadingStrategy.enableBrowserCache) {
      this.setCachedData(processedData);
    }
    
    onProgress?.({
      status: 'Complete!',
      progress: 100,
      loaded: processedData.length,
      total: processedData.length
    });
    
    this.tableData = processedData;
    this.detailDataCache.clear();
    return processedData;
  }
  
  async loadDetailData(rowId: number): Promise<PropertyData | null> {
    console.log('🔍 loadDetailData called for rowId:', rowId);
    console.log('🔍 tableData length:', this.tableData.length);
    console.log('🔍 Sample tableData row_ids:', this.tableData.slice(0, 5).map(item => item.row_id));
    
    // Check cache first
    if (this.detailDataCache.has(rowId)) {
      console.log('📋 Found in detail cache');
      return this.detailDataCache.get(rowId) || null;
    }
    
    // Look in table data (since we load everything in one file now)
    console.log('📋 Looking in table data');
    const item = this.tableData.find(item => item.row_id === rowId);
    if (item) {
      console.log('✅ Found item in tableData:', {
        row_id: item.row_id,
        model: item.model,
        property_desc: item.property_description?.substring(0, 50) + '...'
      });
      this.detailDataCache.set(rowId, item);
      return item;
    } else {
      console.warn('❌ No item found in tableData for rowId:', rowId);
      return null;
    }
  }
  
  private normalizePropertyData(row: any): PropertyData {
    const normalized = {
      question_id: row.question_id || '',
      prompt: row.prompt || '',
      model_1_response: row.model_1_response || '',
      model_2_response: row.model_2_response || '',
      model_1_name: row.model_1_name || '',
      model_2_name: row.model_2_name || '',
      differences: row.differences || '',
      parsed_differences: row.parsed_differences || '',
      parse_error: row.parse_error,
      model: row.model || 'Unknown',
      property_description: row.property_description || '',
      category: row.category || 'Unknown',
      evidence: row.evidence, // Keep as undefined if not present in the dataset
      type: row.type || '',
      reason: row.reason || '',
      impact: row.impact || 'Low',
      unexpected_behavior: row.unexpected_behavior,
      property_description_coarse_cluster_label: row.property_description_coarse_cluster_label || 'Unknown',
      property_description_fine_cluster_label: row.property_description_fine_cluster_label || 'Unknown',
      property_description_coarse_cluster_id: row.property_description_coarse_cluster_id || 0,
      property_description_fine_cluster_id: row.property_description_fine_cluster_id || 0,
      row_id: row.row_id || 0,
    };
    
    // Debug: Log some sample data to understand the structure
    if (Math.random() < 0.001) { // Log ~0.1% of rows
      console.log('🔍 Sample normalized data:', {
        row_id: normalized.row_id,
        question_id: normalized.question_id,
        model: normalized.model,
        model_1_name: normalized.model_1_name,
        model_2_name: normalized.model_2_name,
        has_model_1_response: !!normalized.model_1_response,
        has_model_2_response: !!normalized.model_2_response,
        property_desc_length: normalized.property_description.length,
        has_evidence: normalized.evidence !== undefined
      });
    }
    
    return normalized;
  }
  
  private async decompressGzip(buffer: ArrayBuffer): Promise<string> {
    // Try native DecompressionStream first (available in modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      try {
        console.log('🗜️ Using native DecompressionStream...');
    const decompressedStream = new DecompressionStream('gzip');
    const writer = decompressedStream.writable.getWriter();
    const reader = decompressedStream.readable.getReader();
    
    writer.write(new Uint8Array(buffer));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
        const decompressed = new TextDecoder().decode(result);
        console.log('✅ Native decompression successful');
        return decompressed;
      } catch (error) {
        console.log('⚠️ Native DecompressionStream failed, trying pako fallback...', error);
      }
    }
    
    // Fallback to pako library
    try {
      console.log('🗜️ Using pako fallback for gzip decompression...');
      const pako = await import('pako');
      const uint8Array = new Uint8Array(buffer);
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      console.log('✅ Pako decompression successful');
      return decompressed;
    } catch (error) {
      console.error('❌ Both native and pako decompression failed:', error);
      throw new Error(`Gzip decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private isCacheValid(): boolean {
    const timestamp = localStorage.getItem(this.cacheTimestamp);
    if (!timestamp) return false;
    
    const cacheAge = Date.now() - parseInt(timestamp);
    return cacheAge < DATA_CONFIG.CACHE_DURATION;
  }
  
  private getCachedData(): PropertyData[] | null {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }
  
  private setCachedData(data: PropertyData[]): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
      localStorage.setItem(this.cacheTimestamp, Date.now().toString());
    } catch (error) {
      console.warn('Could not cache data:', error);
    }
  }
  
  clearCache(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.cacheKey);
      localStorage.removeItem(this.cacheTimestamp);
    }
    this.tableData = [];
    this.detailDataCache.clear();
  }
  
  getLoadingStrategy() {
    return getLoadingStrategy(); // Return the latest strategy
  }
}

// Export singleton instance
export const dataLoader = new DataLoaderService(); 