/**
 * Data Loading Service
 * 
 * Handles efficient loading of large datasets with support for:
 * - Compressed file formats
 * - Browser caching
 */

import { getCurrentDataSources, getLoadingStrategy, DATA_CONFIG } from '../config/dataSources';

export interface PropertyData {
  prompt: string;
  model_1_response: string;
  model_2_response: string;
  model_1_name: string;
  model_2_name: string;
  differences: string;
  parsed_differences: string;
  parse_error?: string;
  model: string;
  property_description: string;
  category: string;
  evidence?: string;
  type: string;
  reason: string;
  impact: string;
  unexpected_behavior?: string;
  property_description_coarse_cluster_label: string;
  property_description_fine_cluster_label: string;
  property_description_coarse_cluster_id: number;
  property_description_fine_cluster_id: number;
  row_id?: number; // For linking table and detail data
}

export interface LoadingProgress {
  status: string;
  progress: number; // 0-100
  loaded: number;
  total: number;
}

class DataLoaderService {
  private tableData: PropertyData[] = [];
  private detailDataCache = new Map<number, PropertyData>();
  private loadingStrategy = getLoadingStrategy();
  
  // Cache management
  private cacheKey = 'model_analyzer_data';
  private cacheTimestamp = 'model_analyzer_timestamp';
  
  constructor() {
    // Clear cache to ensure fresh data loading with proper row_id generation
    this.clearCache();
  }
  
  async loadTableData(onProgress?: (progress: LoadingProgress) => void): Promise<PropertyData[]> {
    try {
      // Check if we can use cached data
      if (this.loadingStrategy.enableBrowserCache && this.isCacheValid()) {
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
    
    const response = await fetch(sources.properties, {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'text/csv, text/plain, */*'
      }
    });
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
      // Clone the response so we can try multiple approaches
      const responseClone = response.clone();
      
      try {
        // Try automatic decompression first
        console.log('🗜️ Attempting automatic decompression...');
        csvContent = await response.text();
        
        // Check if decompression worked (CSV should start with column headers)
        if (csvContent.startsWith('prompt,') || csvContent.startsWith('"prompt"') || csvContent.includes(',')) {
          console.log('✅ Automatic decompression successful, size:', csvContent.length, 'characters');
        } else {
          throw new Error('Automatic decompression produced invalid data');
        }
      } catch (error) {
        console.log('🗜️ Automatic decompression failed, trying manual...', error);
        
        onProgress?.({
          status: 'Decompressing dataset...',
          progress: 50,
          loaded: 0,
          total: 0
        });
        
        // Use the cloned response for manual decompression
        const buffer = await responseClone.arrayBuffer();
        console.log('📁 Compressed buffer size:', buffer.byteLength, 'bytes');
        csvContent = await this.decompressGzip(buffer);
        console.log('📁 Manually decompressed size:', csvContent.length, 'characters');
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
    
    // Try to detect delimiter
    const firstLine = csvContent.split('\n')[0];
    let delimiter = ',';
    if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) {
      delimiter = ';';
      console.log('📈 Detected semicolon delimiter');
    } else if (firstLine.includes('\t') && firstLine.split('\t').length > firstLine.split(',').length) {
      delimiter = '\t';
      console.log('📈 Detected tab delimiter');
    } else {
      console.log('📈 Using comma delimiter');
    }
    
    const parsedData = Papa.parse(csvContent, {
      header: true,
      delimiter: delimiter,
      quoteChar: '"',
      escapeChar: '"',
      dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
      skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
      transformHeader: (header: string) => {
        // Clean up header names - remove BOM, trim whitespace, etc.
        return header.replace(/^\uFEFF/, '').trim();
      },
      transform: (value: string, header: string) => {
        // Clean up values - remove extra quotes, trim whitespace
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
    
    // Debug filtering
    const validRows = (parsedData.data as any[]).filter(row => row && row.property_description);
    console.log('📈 Rows after filtering:', validRows.length);
    console.log('📈 Sample valid row:', validRows[0]);
    
    const processedData = validRows.map((row, index) => {
      // Always assign a unique row_id based on the index
      row.row_id = index + 1;
      return this.normalizePropertyData(row);
    });
    console.log('📈 Rows after normalization:', processedData.length);
    
    // Cache the processed data
    if (this.loadingStrategy.enableBrowserCache) {
      this.setCachedData(processedData);
    }
    
    onProgress?.({
      status: 'Complete!',
      progress: 100,
      loaded: processedData.length,
      total: processedData.length
    });
    
    this.tableData = processedData;
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
    // Simple gzip decompression using DecompressionStream
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
    
    return new TextDecoder().decode(result);
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
    return this.loadingStrategy;
  }
}

// Export singleton instance
export const dataLoader = new DataLoaderService(); 