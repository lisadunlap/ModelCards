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

interface ModelSummariesRequest {
  dataset?: string;
  selectedModels?: string[];
  minItemsThreshold?: number;
}

interface ClusterSummary {
  clusterName: string;
  totalItems: number;
  modelItems: number;
  proportion: number;
  percentage: number;
  distinctiveness?: number;
}

interface ModelSummary {
  modelName: string;
  totalItems: number;
  topClusters: ClusterSummary[];
}

interface ModelSummariesResponse {
  modelSummaries: ModelSummary[];
  allModelNames: string[];
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

// Cache for processed data
const cache = new Map<string, { data: ModelSummariesResponse; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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

    const requestBody: ModelSummariesRequest = JSON.parse(event.body || '{}');
    const dataset = requestBody.dataset || 'DBSCAN_HIERARCHICAL';
    const cacheKey = `summaries_${dataset}_${JSON.stringify(requestBody)}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=1800',
        },
        body: JSON.stringify({ ...cached.data, cached: true }),
      };
    }

    console.log(`🚀 Processing model summaries request for dataset: ${dataset}`);

    // Load data from Wasabi
    const rawData = await loadDataFromSource(dataset);
    console.log(`📊 Loaded ${rawData.length} raw data points`);
    
    // Generate model summaries
    const modelSummaries = generateModelSummaries(rawData, requestBody);
    
    // Get all unique models
    const allModelNames = Array.from(new Set([
      ...rawData.map(item => item.model),
      ...rawData.map(item => item.model_1_name),
      ...rawData.map(item => item.model_2_name)
    ])).filter(model => model && model !== 'Unknown' && model.trim().length >= 2).sort();

    const response: ModelSummariesResponse = {
      modelSummaries,
      allModelNames,
      cached: false,
      computeTime: Date.now() - startTime,
      debugInfo: {
        dataset,
        originalDataPoints: rawData.length,
        summariesGenerated: modelSummaries.length,
        allModelsCount: allModelNames.length
      }
    };

    // Cache the result
    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    console.log(`✅ Generated model summaries in ${response.computeTime}ms`);

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
    console.error('❌ Error processing model summaries:', error);
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
  const wasabiBucket = process.env.WASABI_BUCKET || 'vibes';
  const wasabiEndpoint = process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com';
  const datasetConfig = DATASETS[dataset as keyof typeof DATASETS];
  
  if (!datasetConfig) {
    throw new Error(`Unknown dataset: ${dataset}`);
  }
  
  const dataUrl = `${wasabiEndpoint}/${wasabiBucket}/${datasetConfig.path}`;
  
  console.log(`📡 Loading data from: ${dataUrl}`);
  
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to load data from ${dataUrl}: ${response.statusText}`);
  }
  
  let csvContent: string;
  if (dataUrl.endsWith('.gz')) {
    // Handle compressed data
    const buffer = await response.arrayBuffer();
    csvContent = await decompressGzip(buffer);
  } else {
    csvContent = await response.text();
  }
  
  // Parse CSV
  const Papa = await import('papaparse');
  const parsed = Papa.default.parse(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  
  return (parsed.data as any[])
    .filter(row => row && row.property_description)
    .map((row, index) => ({
      ...row,
      row_id: index + 1,
    }));
}

function generateModelSummaries(data: PropertyData[], request: ModelSummariesRequest): ModelSummary[] {
  const { selectedModels = [], minItemsThreshold = 20 } = request;
  
  console.log(`📊 Generating model summaries for ${selectedModels.length} selected models`);
  
  // Filter data to only include battles where both participants are selected
  let filteredData = data;
  if (selectedModels.length > 0) {
    const allModels = Array.from(new Set([
      ...data.map(item => item.model),
      ...data.map(item => item.model_1_name),
      ...data.map(item => item.model_2_name)
    ])).filter(model => model && model !== 'Unknown');
    
    if (selectedModels.length < allModels.length) {
      filteredData = data.filter(item => 
        selectedModels.includes(item.model_1_name) && selectedModels.includes(item.model_2_name)
      );
    }
  }

  // NEW APPROACH: Calculate battle-based proportions
  
  // Step 1: Deduplicate by (prompt, differences) to get unique conversations
  const conversationMap = new Map<string, PropertyData>();
  filteredData.forEach(item => {
    const conversationKey = `${item.prompt}|||${item.differences}`;
    if (!conversationMap.has(conversationKey)) {
      conversationMap.set(conversationKey, item);
    }
  });
  const uniqueConversations = Array.from(conversationMap.values());

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

  // Step 3: Group conversations by fine cluster and calculate model-specific battle counts
  const clusterBattles = new Map<string, Map<string, Set<string>>>();
  
  uniqueConversations.forEach(conversation => {
    const clusterKey = conversation.property_description_fine_cluster_label;
    if (!clusterKey || clusterKey === 'Unknown' || clusterKey === '') return;

    // Initialize cluster tracking
    if (!clusterBattles.has(clusterKey)) {
      clusterBattles.set(clusterKey, new Map());
    }
    
    const clusterMap = clusterBattles.get(clusterKey)!;
    const conversationKey = `${conversation.prompt}|||${conversation.differences}`;
    
    // For each battle, track which models participated
    const modelWithProperty = conversation.model;
    if (modelWithProperty && modelWithProperty !== 'Unknown') {
      // Only include models that are in the selected list
      if (selectedModels.length > 0 && !selectedModels.includes(modelWithProperty)) return;
      
      if (!clusterMap.has(modelWithProperty)) {
        clusterMap.set(modelWithProperty, new Set());
      }
      clusterMap.get(modelWithProperty)!.add(conversationKey);
    }
  });

  // Step 4: Calculate propensities and find distinctive clusters for each model
  const modelsToProcess = selectedModels.length > 0 ? selectedModels : Array.from(modelBattleCounts.keys());
  
  const summaries: ModelSummary[] = modelsToProcess.map(modelName => {
    const totalBattles = modelBattleCounts.get(modelName) || 0;
    
    // Calculate propensities for each cluster
    const clusterSummaries: ClusterSummary[] = [];
    
    clusterBattles.forEach((modelBattles, clusterName) => {
      const battlesWithProperty = modelBattles.get(modelName)?.size || 0;
      
      if (totalBattles > 0 && battlesWithProperty > 0) {
        const propensity = battlesWithProperty / totalBattles;
        
        // Calculate average propensity across all other models for this cluster
        let otherModelsPropensities: number[] = [];
        modelBattles.forEach((battleSet, otherModelName) => {
          if (otherModelName !== modelName) {
            const otherTotalBattles = modelBattleCounts.get(otherModelName) || 0;
            const otherBattlesWithProperty = battleSet.size;
            if (otherTotalBattles > 0) {
              otherModelsPropensities.push(otherBattlesWithProperty / otherTotalBattles);
            }
          }
        });
        
        // Only include clusters where this model has meaningful participation
        // and meets the minimum threshold
        const totalClusterBattles = new Set<string>();
        modelBattles.forEach(battleSet => {
          battleSet.forEach(battle => totalClusterBattles.add(battle));
        });
        
        if (totalClusterBattles.size >= minItemsThreshold && otherModelsPropensities.length > 0) {
          const avgOthersPropensity = otherModelsPropensities.reduce((a, b) => a + b, 0) / otherModelsPropensities.length;
          const distinctiveness = avgOthersPropensity > 0 ? propensity / avgOthersPropensity : propensity * 10;
          
          // Only include clusters where this model is significantly more distinctive
          // (at least 1.5x higher propensity than average of others, or absolute propensity > 2%)
          if (distinctiveness >= 1.5 || propensity >= 0.02) {
            clusterSummaries.push({
              clusterName,
              totalItems: totalClusterBattles.size, // Total unique battles in this cluster
              modelItems: battlesWithProperty, // Battles where this model exhibited the property
              proportion: propensity,
              percentage: propensity * 100,
              distinctiveness // Add distinctiveness score for sorting
            });
          }
        }
      }
    });
    
    // Sort by distinctiveness first, then by propensity, and take top 10
    const topClusters = clusterSummaries
      .sort((a, b) => {
        // Sort by distinctiveness score first, then by propensity
        const distinctivenessDiff = (b.distinctiveness || 0) - (a.distinctiveness || 0);
        if (Math.abs(distinctivenessDiff) > 0.1) { // If distinctiveness difference is significant
          return distinctivenessDiff;
        }
        return b.proportion - a.proportion; // Fall back to propensity
      })
      .slice(0, 10);

    return {
      modelName,
      totalItems: totalBattles, // Total battles this model participated in
      topClusters
    };
  }).filter(summary => {
    // Filter out models with insufficient data
    return summary.totalItems >= 10 && summary.topClusters.length > 0;
  });

  return summaries.sort((a, b) => b.totalItems - a.totalItems);
}

async function decompressGzip(buffer: ArrayBuffer): Promise<string> {
  // Use native Compression Streams API if available
  if (typeof DecompressionStream !== 'undefined') {
    const decompressor = new DecompressionStream('gzip');
    const stream = new Response(buffer).body!.pipeThrough(decompressor);
    const decompressed = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(decompressed);
  }
  
  // Fallback: Try to use a simple implementation
  // For production, you might want to use a proper gzip library
  throw new Error('Gzip decompression not supported in this environment. Please use uncompressed files or add pako library.');
} 