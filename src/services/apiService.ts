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
  parsed_differences?: string;
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
  row_id?: number;
}

export interface ChartDataRequest {
  dataset: string;
  drillLevel: 'coarse' | 'fine' | 'property';
  coarseCluster?: string;
  fineCluster?: string;
  property?: string;
  selectedModels: string[];
  showUnexpectedOnly: boolean;
  filterBattleModels: boolean;
  showDiscrepancyOnly: boolean;
  discrepancyThreshold: number;
}

export interface ChartDataResponse {
  chartData: any[];
  tableData: PropertyData[];
  totalCount: number;
  uniqueModels: string[];
  processingTime: number;
}

export interface ModelSummariesRequest {
  dataset: string;
  selectedModels: string[];
  minItemsThreshold: number;
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
  summaries: any[];
  totalModels: number;
  processingTime: number;
}

export interface KeywordSearchRequest {
  dataset: string;
  query: string;
  minSampleThreshold: number;
  selectedModels?: string[];
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
  results: any[];
  totalMatches: number;
  processingTime: number;
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
    // In development, use local dev server; in production, use current domain
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8888/.netlify/functions'  // Netlify dev server
      : '/.netlify/functions';  // Production
  }

  async getChartData(request: ChartDataRequest): Promise<ChartDataResponse> {
    console.log('📡 API: Getting chart data with request:', request);
    
    const response = await fetch(`${this.baseUrl}/chart-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API: Chart data received, entries:', data.chartData?.length || 0);
    return data;
  }

  async getModelSummaries(request: ModelSummariesRequest): Promise<ModelSummariesResponse> {
    console.log('📡 API: Getting model summaries with request:', request);
    
    const response = await fetch(`${this.baseUrl}/model-summaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API: Model summaries received, count:', data.summaries?.length || 0);
    return data;
  }

  async searchKeywords(request: KeywordSearchRequest): Promise<KeywordSearchResponse> {
    console.log('📡 API: Searching keywords with request:', request);
    
    const response = await fetch(`${this.baseUrl}/keyword-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API: Keyword search results received, count:', data.results?.length || 0);
    return data;
  }

  async getDatasets(): Promise<any> {
    console.log('📡 API: Getting available datasets');
    
    const response = await fetch(`${this.baseUrl}/datasets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API: Datasets received:', Object.keys(data));
    return data;
  }

  async loadFullDataset(dataset: string): Promise<{ data: PropertyData[]; totalCount: number; cached: boolean; processingTime: number }> {
    console.log('📡 API: Loading full dataset:', dataset);
    
    const response = await fetch(`${this.baseUrl}/datasets?dataset=${encodeURIComponent(dataset)}&full=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ API: Full dataset loaded:', result.totalCount, 'items', result.cached ? '(cached)' : '(fresh)');
    return result;
  }
}

export const apiService = new ApiService();

/**
 * React hook for API calls with loading states
 */
import React from 'react';

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