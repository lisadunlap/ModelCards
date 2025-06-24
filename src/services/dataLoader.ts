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
    
    console.log('📁 Loading dataset from API:', sources.properties);
    
    onProgress?.({
      status: 'Loading dataset...',
      progress: 10,
      loaded: 0,
      total: 0
    });
    
    const response = await fetch(sources.properties);
    if (!response.ok) {
      throw new Error(`Failed to load data from API: ${response.statusText}`);
    }
    
    console.log('📁 API Response headers:', Object.fromEntries(response.headers.entries()));
    
    onProgress?.({
      status: 'Parsing dataset...',
      progress: 50,
      loaded: 0,
      total: 0
    });
    
    // The endpoint returns a JSON object with a 'data' property containing the array of records.
    const jsonResponse = await response.json();
    
    if (!jsonResponse || !jsonResponse.data) {
      throw new Error('Invalid JSON response from server');
    }
    
    const jsonData = jsonResponse.data as PropertyData[];
    console.log('📈 Dataset loaded from JSON API. Total rows:', jsonData.length);

    // Simple column comparison debugging (optional, but good for verification)
    if (jsonData.length > 0) {
      const actualColumns = Object.keys(jsonData[0]);
      const expectedColumns = ['prompt', 'model_1_response', 'model_2_response', 'model_1_name', 'model_2_name', 'differences', 'model', 'property_description', 'category', 'type', 'reason', 'impact'];
      
      console.log('📊 Expected columns:', expectedColumns);
      console.log('📊 Actual columns found:', actualColumns);
      console.log('📊 Missing columns:', expectedColumns.filter(col => !actualColumns.includes(col)));
      console.log('📊 Extra columns:', actualColumns.filter(col => !expectedColumns.includes(col)));
      console.log('📈 First row sample:', jsonData[0]);
    }
    
    // The data is already structured, so we can filter and process it directly.
    const validRows = jsonData.filter(row => row && row.property_description);
    console.log('📈 Rows after filtering for valid property_description:', validRows.length);
    
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