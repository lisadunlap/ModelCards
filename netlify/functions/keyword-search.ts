import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

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

interface KeywordSearchRequest {
  dataset?: string;
  searchQuery: string;
  minSampleThreshold?: number;
}

interface ClusterMatch {
  clusterName: string;
  clusterDescription: string;
  totalItems: number;
  modelCounts: Record<string, number>;
  matchingItems: PropertyData[];
  relevanceScore: number;
}

interface KeywordSearchResponse {
  searchResults: ClusterMatch[];
  searchQuery: string;
  cached: boolean;
  computeTime: number;
  debugInfo?: any;
}

// Cache for processed data
const cache = new Map<string, { data: KeywordSearchResponse; timestamp: number }>();
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

    const requestBody: KeywordSearchRequest = JSON.parse(event.body || '{}');
    const dataset = requestBody.dataset || 'DBSCAN_HIERARCHICAL';
    const cacheKey = `search_${dataset}_${JSON.stringify(requestBody)}`;

    if (!requestBody.searchQuery || !requestBody.searchQuery.trim()) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Search query is required' }),
      };
    }

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

    console.log(`🚀 Processing keyword search request for dataset: ${dataset}`);
    console.log(`🔍 Search query: "${requestBody.searchQuery}"`);

    // Load data from Wasabi
    const rawData = await loadDataFromSource(dataset);
    console.log(`📊 Loaded ${rawData.length} raw data points`);
    
    // Perform keyword search
    const searchResults = performKeywordSearch(rawData, requestBody);

    const response: KeywordSearchResponse = {
      searchResults,
      searchQuery: requestBody.searchQuery,
      cached: false,
      computeTime: Date.now() - startTime,
      debugInfo: {
        dataset,
        originalDataPoints: rawData.length,
        searchResultsCount: searchResults.length,
        minThreshold: requestBody.minSampleThreshold || 30
      }
    };

    // Cache the result
    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    console.log(`✅ Completed keyword search in ${response.computeTime}ms`);

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
    console.error('❌ Error processing keyword search:', error);
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

function performKeywordSearch(data: PropertyData[], request: KeywordSearchRequest): ClusterMatch[] {
  const { searchQuery, minSampleThreshold = 30 } = request;
  
  const query = searchQuery.toLowerCase().trim();
  const queryTerms = query.split(/\s+/).filter(term => term.length > 2);

  console.log(`🔍 Performing keyword search for: "${query}"`);
  console.log(`🔍 Query terms: [${queryTerms.join(', ')}]`);

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

  // Step 3: Group conversations by fine cluster and calculate battle-based metrics
  const clusterBattles = new Map<string, Map<string, Set<string>>>();
  
  uniqueConversations.forEach(conversation => {
    const clusterName = conversation.property_description_fine_cluster_label;
    if (!clusterName || clusterName === 'Unknown') return;
    
    if (!clusterBattles.has(clusterName)) {
      clusterBattles.set(clusterName, new Map());
    }
    
    const clusterMap = clusterBattles.get(clusterName)!;
    const conversationKey = `${conversation.prompt}|||${conversation.differences}`;
    
    // CRITICAL FIX: Only count the model that actually exhibited the property
    // The 'model' field tells us which model showed this behavior
    const modelWithProperty = conversation.model;
    if (modelWithProperty && modelWithProperty !== 'Unknown') {
      if (!clusterMap.has(modelWithProperty)) {
        clusterMap.set(modelWithProperty, new Set());
      }
      clusterMap.get(modelWithProperty)!.add(conversationKey);
    }
  });

  // Step 4: Calculate relevance scores and create cluster matches
  const clusterMatches: ClusterMatch[] = [];
  
  clusterBattles.forEach((modelBattles, clusterName) => {
    // Calculate relevance score based on cluster name matching
    let relevanceScore = 0;
    
    const clusterWords = clusterName.toLowerCase().split(/\s+/);
    
    queryTerms.forEach(queryWord => {
      clusterWords.forEach(clusterWord => {
        if (clusterWord === queryWord) {
          relevanceScore += 10; // Strong match for exact word
        } else if (clusterWord.includes(queryWord) || queryWord.includes(clusterWord)) {
          relevanceScore += 5; // Weaker match for substrings
        }
      });
    });
    
    // Only include clusters with minimum samples and relevance
    const totalClusterBattles = new Set<string>();
    modelBattles.forEach(battleSet => {
      battleSet.forEach(battle => totalClusterBattles.add(battle));
    });
    
    if (totalClusterBattles.size >= minSampleThreshold && relevanceScore > 0) {
      // Calculate model propensities for this cluster
      const modelPropensities: Record<string, number> = {};
      const matchingItems: PropertyData[] = [];
      
      modelBattles.forEach((battleSet, modelName) => {
        const totalBattles = modelBattleCounts.get(modelName) || 0;
        const battlesWithProperty = battleSet.size;
        
        if (totalBattles > 0) {
          modelPropensities[modelName] = (battlesWithProperty / totalBattles) * 100;
        } else {
          modelPropensities[modelName] = 0;
        }
      });
      
      // Get a sample of matching items for display
      const sampleBattles = Array.from(totalClusterBattles).slice(0, 10);
      sampleBattles.forEach(battleKey => {
        const [prompt, differences] = battleKey.split('|||');
        const item = uniqueConversations.find(c => c.prompt === prompt && c.differences === differences);
        if (item) {
          matchingItems.push(item);
        }
      });
      
      clusterMatches.push({
        clusterName,
        clusterDescription: matchingItems[0]?.property_description || '',
        totalItems: totalClusterBattles.size,
        modelCounts: modelPropensities, // Now storing propensities instead of counts
        matchingItems: matchingItems.sort(() => Math.random() - 0.5), // Shuffle
        relevanceScore
      });
    }
  });

  // Sort by relevance score and shuffle clusters with same score
  const sortedResults = clusterMatches
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
  
  // Group by relevance score and shuffle within each group
  const groupedByScore: Record<number, ClusterMatch[]> = {};
  sortedResults.forEach(result => {
    if (!groupedByScore[result.relevanceScore]) {
      groupedByScore[result.relevanceScore] = [];
    }
    groupedByScore[result.relevanceScore].push(result);
  });
  
  // Shuffle within each score group and flatten
  const finalResults: ClusterMatch[] = [];
  Object.keys(groupedByScore)
    .sort((a, b) => Number(b) - Number(a)) // Sort by score descending
    .forEach(score => {
      const shuffledGroup = [...groupedByScore[Number(score)]].sort(() => Math.random() - 0.5);
      finalResults.push(...shuffledGroup);
    });

  console.log(`✅ Found ${finalResults.length} matching clusters`);
  return finalResults;
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