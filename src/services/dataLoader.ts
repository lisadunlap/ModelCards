/**
 * Optimized Data Loading Service
 * 
 * Handles efficient loading of large datasets with support for:
 * - Split table/detail data
 * - Compressed file formats
 * - Lazy loading
 * - Browser caching
 * - Pagination
 */

import { getCurrentDataSources, getLoadingStrategy, isOptimizedDataAvailable, DATA_CONFIG } from '../config/dataSources';

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
  evidence: string;
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

export interface DataIndex {
  total_rows: number;
  table_rows: number;
  detail_rows: number;
  available_columns: {
    table: string[];
    detail: string[];
  };
  row_id_mapping?: number[];
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
  private fullDetailData: PropertyData[] | null = null; // Cache full detail dataset
  private dataIndex: DataIndex | null = null;
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
      
      // Check if optimized data is available
      const useOptimized = this.loadingStrategy.useOptimizedData && await isOptimizedDataAvailable();
      
      if (useOptimized) {
        return await this.loadOptimizedTableData(onProgress);
      } else {
        return await this.loadFullDataset(onProgress);
      }
      
    } catch (error) {
      console.error('Error loading table data:', error);
      throw error;
    }
  }
  
  private async loadOptimizedTableData(onProgress?: (progress: LoadingProgress) => void): Promise<PropertyData[]> {
    const sources = getCurrentDataSources();
    
    console.log('📁 Loading from source:', sources.tableData);
    console.log('📁 Is compressed file?', sources.tableData.endsWith('.gz'));
    
    onProgress?.({
      status: 'Loading optimized table data...',
      progress: 10,
      loaded: 0,
      total: 0
    });
    
    // Load data index first
    try {
      const indexResponse = await fetch(sources.dataIndex);
      if (indexResponse.ok) {
        this.dataIndex = await indexResponse.json();
        console.log('📊 Loaded data index:', this.dataIndex);
      }
    } catch (error) {
      console.warn('Could not load data index:', error);
    }
    
    onProgress?.({
      status: 'Fetching table data...',
      progress: 20,
      loaded: 0,
      total: this.dataIndex?.table_rows || 0
    });
    
    // Load table data with automatic decompression request
    const tableResponse = await fetch(sources.tableData, {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'text/csv, text/plain, */*'
      }
    });
    if (!tableResponse.ok) {
      console.warn(`Optimized table data not found (${sources.tableData}), falling back to full dataset`);
      // Try the original compressed file as fallback
      console.log('🔄 Attempting fallback to original compressed file...');
      return await this.loadFullDataset(onProgress);
    }
    
    console.log('📁 Response headers:', Object.fromEntries(tableResponse.headers.entries()));
    console.log('📁 Response size:', tableResponse.headers.get('content-length'), 'bytes');
    console.log('📁 Content-Encoding:', tableResponse.headers.get('content-encoding'));
    
    onProgress?.({
      status: 'Reading table data...',
      progress: 40,
      loaded: 0,
      total: this.dataIndex?.table_rows || 0
    });
    
    // Handle compressed data
    let csvContent: string;
    const contentEncoding = tableResponse.headers.get('content-encoding');
    
    if (contentEncoding === 'gzip' || (!contentEncoding && sources.tableData.endsWith('.gz'))) {
      // Try automatic decompression first
      try {
        csvContent = await tableResponse.text();
        console.log('✅ Automatic decompression worked, size:', csvContent.length, 'characters');
      } catch (error) {
        console.log('🗜️ Automatic decompression failed, trying manual...');
        onProgress?.({
          status: 'Decompressing data...',
          progress: 50,
          loaded: 0,
          total: this.dataIndex?.table_rows || 0
        });
        
        const buffer = await tableResponse.arrayBuffer();
        console.log('📁 Compressed buffer size:', buffer.byteLength, 'bytes');
        csvContent = await this.decompressGzip(buffer);
        console.log('📁 Manually decompressed size:', csvContent.length, 'characters');
      }
    } else {
      csvContent = await tableResponse.text();
      console.log('📁 Text size:', csvContent.length, 'characters');
    }
    
    onProgress?.({
      status: 'Parsing table data...',
      progress: 60,
      loaded: 0,
      total: this.dataIndex?.table_rows || 0
    });
    
    // Parse CSV
    const Papa = (await import('papaparse')).default;
    const parsedData = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
      skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
    });
    
    onProgress?.({
      status: 'Processing table data...',
      progress: 80,
      loaded: 0,
      total: parsedData.data.length
    });
    
    // Process and filter data
    const processedData = (parsedData.data as any[])
      .filter(row => row && row.property_description)
      .map((row, index) => {
        // Always assign a unique row_id based on the index
        row.row_id = index + 1;
        return this.normalizePropertyData(row);
      });
    
    onProgress?.({
      status: 'Caching data...',
      progress: 90,
      loaded: processedData.length,
      total: processedData.length
    });
    
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
  
  private async loadFullDataset(onProgress?: (progress: LoadingProgress) => void): Promise<PropertyData[]> {
    // Fallback to original loading method
    const sources = getCurrentDataSources();
    
    console.log('📁 Loading full dataset from:', sources.properties);
    console.log('📁 Is compressed?', sources.properties.endsWith('.gz'));
    
    onProgress?.({
      status: 'Loading full dataset...',
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
        if (csvContent.startsWith('prompt,') || csvContent.startsWith('"prompt"')) {
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
      status: 'Parsing full dataset...',
      progress: 70,
      loaded: 0,
      total: 0
    });
    
    const parsedData = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
      skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
    });
    
    console.log('📈 Full dataset parsed. Total rows:', parsedData.data?.length || 0);
    console.log('📈 Sample columns:', Object.keys(parsedData.data?.[0] || {}));
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
    
    // If not using lazy loading, detail data should already be in table data
    if (!this.loadingStrategy.lazyLoadDetails) {
      console.log('📋 Not using lazy loading, looking in table data');
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
      }
    }
    
    // Load detail data if not already loaded
    if (!this.fullDetailData) {
      console.log('📋 Loading full detail dataset...');
      await this.loadFullDetailDataset();
    }
    
    // Find the specific row in the full detail data
    if (this.fullDetailData) {
      console.log('📋 Searching in full detail data for rowId:', rowId);
      const targetRow = this.fullDetailData.find(row => row.row_id === rowId);
      if (targetRow) {
        console.log('✅ Found detail data for rowId:', rowId);
        this.detailDataCache.set(rowId, targetRow);
        return targetRow;
      } else {
        console.warn('❌ No detail data found for rowId:', rowId);
      }
    }
    
    console.warn('📋 Falling back to table data');
    return this.tableData.find(item => item.row_id === rowId) || null;
  }
  
  private async loadFullDetailDataset(): Promise<void> {
    try {
      const sources = getCurrentDataSources();
      console.log('📋 Loading detail data from:', sources.detailData);
      
      const response = await fetch(sources.detailData, {
        headers: {
          'Accept': 'text/csv, text/plain, */*'
        }
      });
      if (!response.ok) {
        console.warn('Detail data not available');
        return;
      }
      
      console.log('📋 Detail data response size:', response.headers.get('content-length'), 'bytes');
      
      const csvContent = await response.text();
      console.log('📋 Detail CSV content size:', csvContent.length, 'characters');
      
      const Papa = (await import('papaparse')).default;
      const parsedData = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
        skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
      });
      
      // Process and store the full detail dataset
      this.fullDetailData = (parsedData.data as any[])
        .filter(row => row && row.property_description)
        .map((row, index) => {
          // Always assign a unique row_id based on the index
          row.row_id = index + 1;
          return this.normalizePropertyData(row);
        });
      
      console.log('✅ Loaded full detail dataset:', this.fullDetailData.length, 'rows');
      
    } catch (error) {
      console.error('Error loading full detail dataset:', error);
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
      evidence: row.evidence || '',
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
        property_desc_length: normalized.property_description.length
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
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.cacheTimestamp);
    this.detailDataCache.clear();
  }
  
  getDataIndex(): DataIndex | null {
    return this.dataIndex;
  }
  
  getLoadingStrategy() {
    return this.loadingStrategy;
  }
}

// Export singleton instance
export const dataLoader = new DataLoaderService(); 