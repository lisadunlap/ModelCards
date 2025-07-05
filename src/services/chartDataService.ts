interface ChartDataRequest {
  drillLevel: 'coarse' | 'fine' | 'property';
  coarseCluster?: string;
  fineCluster?: string;
  selectedModels?: string[];
  showUnexpectedOnly?: boolean;
  filterBattleModels?: boolean;
}

interface ChartDataResponse {
  chartData: any[];
  tableData: PropertyData[];
  totalCount: number;
  uniqueModels: string[];
  cached: boolean;
  computeTime: number;
}

interface PropertyData {
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

class ChartDataService {
  private baseUrl: string;
  private cache = new Map<string, { data: ChartDataResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes client-side cache

  constructor() {
    // Detect environment
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8888/.netlify/functions'
      : '/.netlify/functions';
  }

  async fetchChartData(request: ChartDataRequest): Promise<ChartDataResponse> {
    const cacheKey = JSON.stringify(request);
    
    // Check client-side cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('📈 Returning cached chart data');
      return { ...cached.data, cached: true };
    }

    try {
      console.log('📈 Fetching chart data from server:', request);
      const startTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/chart-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data: ChartDataResponse = await response.json();
      const fetchTime = Date.now() - startTime;
      
      console.log(`📈 Chart data fetched in ${fetchTime}ms (server: ${data.computeTime}ms)`);
      console.log(`📊 Chart data: ${data.chartData.length} items, ${data.totalCount} total records`);
      
      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch chart data:', error);
      throw new Error(`Failed to load chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback method that uses the existing client-side processing
  async fetchChartDataFallback(
    allData: PropertyData[], 
    request: ChartDataRequest
  ): Promise<ChartDataResponse> {
    console.log('📈 Using fallback client-side processing');
    const startTime = Date.now();
    
    // Apply the same filtering logic as the server
    let filteredData = allData;

    // Apply drill filters
    if (request.coarseCluster) {
      filteredData = filteredData.filter(item => 
        item.property_description_coarse_cluster_label === request.coarseCluster
      );
    }
    
    if (request.fineCluster) {
      filteredData = filteredData.filter(item => 
        item.property_description_fine_cluster_label === request.fineCluster
      );
    }

    // Filter by unexpected behavior
    if (request.showUnexpectedOnly) {
      filteredData = filteredData.filter(item => 
        item.unexpected_behavior && 
        item.unexpected_behavior.toLowerCase() === 'true'
      );
    }

    // Filter by selected models
    if (request.selectedModels && request.selectedModels.length > 0) {
      if (request.filterBattleModels) {
        // Battle mode: both participants must be in selected models
        filteredData = filteredData.filter(item => 
          request.selectedModels!.includes(item.model_1_name) && 
          request.selectedModels!.includes(item.model_2_name)
        );
      } else {
        // Regular mode: at least one model must be selected
        filteredData = filteredData.filter(item => 
          request.selectedModels!.includes(item.model)
        );
      }
    }

    // Generate chart data
    const chartData = this.generateChartData(filteredData, request);
    
    // Get unique models
    const uniqueModels = Array.from(new Set(allData.map(item => item.model)))
      .filter(model => model && model !== 'Unknown')
      .sort();

    const computeTime = Date.now() - startTime;
    console.log(`📈 Fallback processing completed in ${computeTime}ms`);

    return {
      chartData,
      tableData: filteredData.slice(0, 1000),
      totalCount: filteredData.length,
      uniqueModels,
      cached: false,
      computeTime,
    };
  }

  private generateChartData(data: PropertyData[], request: ChartDataRequest): any[] {
    const { drillLevel } = request;
    
    // Group data based on drill level
    const grouped = new Map<string, PropertyData[]>();
    
    data.forEach(item => {
      let key: string;
      switch (drillLevel) {
        case 'coarse':
          key = item.property_description_coarse_cluster_label || 'Unknown';
          break;
        case 'fine':
          key = item.property_description_fine_cluster_label || 'Unknown';
          break;
        case 'property':
          key = item.property_description || 'Unknown';
          break;
        default:
          key = 'Unknown';
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    // Convert to chart format
    const chartData = Array.from(grouped.entries()).map(([key, items]) => {
      const modelCounts = new Map<string, number>();
      
      items.forEach(item => {
        const model = item.model || 'Unknown';
        modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
      });

      const dataPoint: any = {
        name: key,
        total: items.length,
      };

      // Add model-specific counts
      modelCounts.forEach((count, model) => {
        dataPoint[model] = count;
      });

      return dataPoint;
    });

    // Sort by total count descending
    return chartData.sort((a, b) => b.total - a.total);
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Chart data cache cleared');
  }
}

export const chartDataService = new ChartDataService();
export type { ChartDataRequest, ChartDataResponse, PropertyData }; 