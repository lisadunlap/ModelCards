/**
 * API Service for communicating with Netlify functions
 * 
 * This service provides a centralized way to interact with server-side functions
 * for data processing, chart generation, and search operations.
 */

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
  row_id?: number;
}

export interface ChartDataRequest {
  dataset?: string;
  drillLevel: 'coarse' | 'fine' | 'property';
  coarseCluster?: string;
  fineCluster?: string;
  selectedModels?: string[];
  showUnexpectedOnly?: boolean;
  filterBattleModels?: boolean;
  showDiscrepancyOnly?: boolean;
  discrepancyThreshold?: number;
}

export interface ChartDataResponse {
  chartData: any[];
  tableData: PropertyData[];
  totalCount: number;
  uniqueModels: string[];
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

export interface ModelSummariesRequest {
  dataset?: string;
  selectedModels?: string[];
  minItemsThreshold?: number;
}

export interface ClusterSummary {
  clusterName: string;
  totalItems: number;
  modelItems: number;
  proportion: number;
  percentage: number;
  distinctiveness?: number;
}

export interface ModelSummary {
  modelName: string;
  totalItems: number;
  topClusters: ClusterSummary[];
}

export interface ModelSummariesResponse {
  modelSummaries: ModelSummary[];
  allModelNames: string[];
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

export interface KeywordSearchRequest {
  dataset?: string;
  searchQuery: string;
  minSampleThreshold?: number;
}

export interface ClusterMatch {
  clusterName: string;
  clusterDescription: string;
  totalItems: number;
  modelCounts: Record<string, number>;
  matchingItems: PropertyData[];
  relevanceScore: number;
}

export interface KeywordSearchResponse {
  searchResults: ClusterMatch[];
  searchQuery: string;
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

export interface DatasetInfo {
  key: string;
  path: string;
  label: string;
  description: string;
}

export interface DatasetsResponse {
  datasets: DatasetInfo[];
  default: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // Determine API base URL
    if (typeof window !== 'undefined') {
      // Client-side: use current origin for production, localhost for development
      this.baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8888/.netlify/functions'
        : `${window.location.origin}/.netlify/functions`;
    } else {
      // Server-side: default to production
      this.baseUrl = '/.netlify/functions';
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error ${response.status}: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ API Response: ${endpoint} completed in ${data.computeTime || 0}ms ${data.cached ? '(cached)' : ''}`);
    
    return data;
  }

  /**
   * Get available datasets
   */
  async getDatasets(): Promise<DatasetsResponse> {
    return this.makeRequest<DatasetsResponse>('datasets');
  }

  /**
   * Get chart data with server-side processing
   */
  async getChartData(request: ChartDataRequest): Promise<ChartDataResponse> {
    return this.makeRequest<ChartDataResponse>('chart-data', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get model summaries with server-side processing
   */
  async getModelSummaries(request: ModelSummariesRequest): Promise<ModelSummariesResponse> {
    return this.makeRequest<ModelSummariesResponse>('model-summaries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Perform keyword search with server-side processing
   */
  async keywordSearch(request: KeywordSearchRequest): Promise<KeywordSearchResponse> {
    return this.makeRequest<KeywordSearchResponse>('keyword-search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Enhanced semantic search (uses existing function)
   */
  async semanticSearch(query: string, limit: number = 10): Promise<any> {
    return this.makeRequest<any>('semantic-search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }
}

// Export singleton instance
export const apiService = new ApiService();

/**
 * React hook for API calls with loading states
 */
export function useApiCall<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('API call failed:', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Import React for the hook
import React from 'react'; 