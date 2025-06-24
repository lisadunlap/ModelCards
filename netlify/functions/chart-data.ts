import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

interface PropertyData {
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

interface ChartDataRequest {
  dataset?: string; // Which dataset to use (e.g., 'DBSCAN_HIERARCHICAL')
  drillLevel: 'coarse' | 'fine' | 'property';
  coarseCluster?: string;
  fineCluster?: string;
  selectedModels?: string[];
  showUnexpectedOnly?: boolean;
  filterBattleModels?: boolean;
  showDiscrepancyOnly?: boolean;
  discrepancyThreshold?: number;
}

interface ChartDataResponse {
  chartData: any[];
  tableData: PropertyData[];
  totalCount: number;
  uniqueModels: string[];
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

// Cache for processed data - organized by dataset
const cache = new Map<string, { data: ChartDataResponse; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for server-side

// NEW: raw dataset cache (pre-parsed rows) so we don't fetch & parse on every request
const rawDatasetCache = new Map<string, { rows: PropertyData[]; timestamp: number }>();
const RAW_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Dataset configurations
const DATASETS = {
  DBSCAN_HIERARCHICAL: {
    path: 'datasets/dbscan_hierarchical_mcs_50-2.csv.gz',
    label: '500 Arena Prompts on many models',
    description: 'Running a ton of models on 500 different arena prompt (not real arena battles)'
  },
  // Add more datasets as needed
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  const startTime = Date.now();
  
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const requestBody: ChartDataRequest = JSON.parse(event.body || '{}');
    const dataset = requestBody.dataset || 'DBSCAN_HIERARCHICAL';
    const cacheKey = `${dataset}_${JSON.stringify(requestBody)}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=1800', // 30 minutes
        },
        body: JSON.stringify({ ...cached.data, cached: true }),
      };
    }

    console.log(`🚀 Processing chart data request for dataset: ${dataset}`);
    console.log(`🔍 Request params:`, JSON.stringify(requestBody, null, 2));

    // Load data from Wasabi
    const rawData = await loadDataFromSource(dataset);
    console.log(`📊 Loaded ${rawData.length} raw data points`);
    
    // Filter and process data based on request parameters
    const filteredData = filterData(rawData, requestBody);
    console.log(`📊 Filtered to ${filteredData.length} data points`);
    
    // Generate sophisticated chart data using battle-based proportions
    const chartData = generateAdvancedChartData(filteredData, requestBody);
    console.log(`📈 Generated ${chartData.length} chart entries`);
    
    // Get unique models
    const uniqueModels = Array.from(new Set(rawData.map(item => item.model)))
      .filter(model => model && model !== 'Unknown' && model.trim().length >= 2)
      .sort();

    const response: ChartDataResponse = {
      chartData,
      tableData: filteredData.slice(0, 500), // Limit table data for performance
      totalCount: filteredData.length,
      uniqueModels,
      cached: false,
      computeTime: Date.now() - startTime,
      debugInfo: {
        dataset,
        originalDataPoints: rawData.length,
        filteredDataPoints: filteredData.length,
        chartEntries: chartData.length,
        uniqueModelsCount: uniqueModels.length
      }
    };

    // Cache the result
    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    console.log(`✅ Computed and cached chart data in ${response.computeTime}ms`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Error processing chart data:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        computeTime: Date.now() - startTime
      }),
    };
  }
};

async function loadDataFromSource(dataset: string): Promise<PropertyData[]> {
  // Check raw cache first
  const cached = rawDatasetCache.get(dataset);
  if (cached && (Date.now() - cached.timestamp) < RAW_CACHE_TTL) {
    console.log(`🔥 Using cached raw rows for dataset ${dataset} (`, cached.rows.length, 'rows )`');
    return cached.rows;
  }

  const wasabiBucket = process.env.WASABI_BUCKET || 'vibes';
  const wasabiEndpoint = process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com';
  const datasetConfig = DATASETS[dataset as keyof typeof DATASETS];
  if (!datasetConfig) {
    throw new Error(`Unknown dataset: ${dataset}`);
  }

  const dataUrl = `${wasabiEndpoint}/${wasabiBucket}/${datasetConfig.path}`;
  console.log(`📡 Downloading CSV from ${dataUrl}`);

  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to load data from ${dataUrl}: ${response.statusText}`);
  }

  // Stream into memory (still one buffer) – quick-win; proper stream parse would pipe.
  const arrayBuf = await response.arrayBuffer();
  let csvContent: string;
  if (datasetConfig.path.endsWith('.gz')) {
    const { gunzipSync } = await import('zlib');
    csvContent = gunzipSync(Buffer.from(arrayBuf)).toString('utf8');
  } else {
    csvContent = Buffer.from(arrayBuf).toString('utf8');
  }
  console.log(`📦 CSV size (utf8 chars):`, csvContent.length);

  // Parse with Papa (sync)
  const Papa = await import('papaparse');
  const parsed = Papa.default.parse(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    fastMode: true,
  });
  console.log(`📋 Parsed`, parsed.data.length, 'rows. Errors:', parsed.errors.length);

  const rows: PropertyData[] = (parsed.data as any[])
    .filter((row) => row && row.property_description)
    .map((row, idx) => ({ ...row, row_id: idx + 1 }));

  rawDatasetCache.set(dataset, { rows, timestamp: Date.now() });
  console.log(`✅ Cached raw dataset (${rows.length} rows, ttl ${RAW_CACHE_TTL/1000}s)`);
  return rows;
}

function filterData(data: PropertyData[], request: ChartDataRequest): PropertyData[] {
  let filtered = data;

  // Apply drill filters
  if (request.coarseCluster) {
    filtered = filtered.filter(item => 
      item.property_description_coarse_cluster_label === request.coarseCluster
    );
  }
  
  if (request.fineCluster) {
    filtered = filtered.filter(item => 
      item.property_description_fine_cluster_label === request.fineCluster
    );
  }

  // Filter by unexpected behavior
  if (request.showUnexpectedOnly) {
    filtered = filtered.filter(item => 
      item.unexpected_behavior && 
      item.unexpected_behavior.toLowerCase() === 'true'
    );
  }

  // Filter by selected models
  if (request.selectedModels && request.selectedModels.length > 0) {
    if (request.filterBattleModels) {
      // Battle mode: both participants must be in selected models
      filtered = filtered.filter(item => 
        request.selectedModels!.includes(item.model_1_name) && 
        request.selectedModels!.includes(item.model_2_name)
      );
    } else {
      // Regular mode: property-holding model must be selected
      filtered = filtered.filter(item => 
        request.selectedModels!.includes(item.model)
      );
    }
  }

  return filtered;
}

function generateAdvancedChartData(data: PropertyData[], request: ChartDataRequest): any[] {
  const { drillLevel, selectedModels = [], showDiscrepancyOnly = false, discrepancyThreshold = 2 } = request;
  
  console.log(`📊 Generating advanced chart data for ${data.length} items at ${drillLevel} level`);
  
  // NEW APPROACH: Calculate battle-based proportions
  
  // Step 1: Deduplicate by (prompt, differences) to get unique conversations
  const conversationMap = new Map<string, PropertyData>();
  data.forEach(item => {
    const conversationKey = `${item.prompt}|||${item.differences}`;
    if (!conversationMap.has(conversationKey)) {
      conversationMap.set(conversationKey, item);
    }
  });
  const uniqueConversations = Array.from(conversationMap.values());
  console.log(`🔄 Deduplicated to ${uniqueConversations.length} unique conversations`);

  // Step 2: For each model, calculate total battles participated in
  const modelBattleCounts = new Map<string, number>();
  uniqueConversations.forEach(conversation => {
    // Each conversation involves exactly 2 models
    if (conversation.model_1_name && conversation.model_1_name !== 'Unknown') {
      modelBattleCounts.set(
        conversation.model_1_name, 
        (modelBattleCounts.get(conversation.model_1_name) || 0) + 1
      );
    }
    if (conversation.model_2_name && conversation.model_2_name !== 'Unknown') {
      modelBattleCounts.set(
        conversation.model_2_name, 
        (modelBattleCounts.get(conversation.model_2_name) || 0) + 1
      );
    }
  });
  console.log(`📊 Model battle counts calculated for ${modelBattleCounts.size} models`);

  // Step 3: Group conversations by cluster/property and calculate proportions
  const clusterBattles = new Map<string, Map<string, Set<string>>>();
  
  uniqueConversations.forEach(conversation => {
    // Determine cluster key based on drill level
    let clusterKey = '';
    switch (drillLevel) {
      case 'coarse':
        clusterKey = conversation.property_description_coarse_cluster_label;
        break;
      case 'fine':
        clusterKey = conversation.property_description_fine_cluster_label;
        break;
      case 'property':
        clusterKey = conversation.property_description;
        break;
    }
    
    if (!clusterKey || clusterKey === 'Unknown' || clusterKey === '') return;

    // Initialize cluster tracking
    if (!clusterBattles.has(clusterKey)) {
      clusterBattles.set(clusterKey, new Map());
    }
    
    const clusterMap = clusterBattles.get(clusterKey)!;
    const conversationKey = `${conversation.prompt}|||${conversation.differences}`;
    
    // For each battle, track which models participated and exhibited the property
    const modelWithProperty = conversation.model;
    if (modelWithProperty && modelWithProperty !== 'Unknown') {
      if (!clusterMap.has(modelWithProperty)) {
        clusterMap.set(modelWithProperty, new Set());
      }
      clusterMap.get(modelWithProperty)!.add(conversationKey);
    }
  });

  // Step 4: Calculate proportions for chart data
  let chartEntries: any[] = [];
  
  clusterBattles.forEach((modelBattles, clusterName) => {
    const entry: any = { 
      name: clusterName, 
      total_battles: 0,
      battle_counts: new Map<string, number>()
    };
    
    // Calculate proportions for each model
    modelBattles.forEach((battleSet, modelName) => {
      const battlesWithProperty = battleSet.size;
      const totalBattles = modelBattleCounts.get(modelName) || 0;
      
      if (totalBattles > 0) {
        const proportion = (battlesWithProperty / totalBattles) * 100; // Convert to percentage
        entry[`${modelName}_percentage`] = Math.round(proportion * 10) / 10; // Round to 1 decimal
        entry[`${modelName}_battle_count`] = battlesWithProperty;
        entry[`${modelName}_total_battles`] = totalBattles;
        entry.battle_counts.set(modelName, battlesWithProperty);
      } else {
        entry[`${modelName}_percentage`] = 0;
        entry[`${modelName}_battle_count`] = 0;
        entry[`${modelName}_total_battles`] = 0;
      }
    });
    
    // Calculate total unique battles for this cluster (across all models)
    const allBattles = new Set<string>();
    modelBattles.forEach(battleSet => {
      battleSet.forEach(battle => allBattles.add(battle));
    });
    entry.total_battles = allBattles.size;
    
    chartEntries.push(entry);
  });

  console.log(`📈 Generated ${chartEntries.length} chart entries before filtering`);

  // Apply discrepancy filtering if enabled
  if (showDiscrepancyOnly && selectedModels.length >= 2) {
    const totalBeforeFilter = chartEntries.length;
    
    chartEntries = chartEntries.filter(entry => {
      // Get all model counts for this category
      const modelCounts = selectedModels.map(model => entry[`${model}_battle_count`] || 0);
      
      // Remove zero counts for ratio calculation
      const nonZeroCounts = modelCounts.filter(count => count > 0);
      
      // Need at least 2 models with data to calculate discrepancy
      if (nonZeroCounts.length < 2) {
        // Show entries where one model has significant data while others have none
        const maxCount = Math.max(...modelCounts);
        return maxCount >= 3; // At least 3 items in one model
      }
      
      // Calculate the ratio between highest and lowest counts
      const maxCount = Math.max(...nonZeroCounts);
      const minCount = Math.min(...nonZeroCounts);
      const ratio = maxCount / minCount;
      
      return ratio >= discrepancyThreshold;
    });
    
    console.log(`🔍 Discrepancy filter: ${totalBeforeFilter} -> ${chartEntries.length} categories (threshold: ${discrepancyThreshold})`);
  }

  // Sort by total battles descending
  const finalData = chartEntries.sort((a, b) => b.total_battles - a.total_battles);
  console.log(`✅ Final chart data: ${finalData.length} entries`);
  
  return finalData;
} 