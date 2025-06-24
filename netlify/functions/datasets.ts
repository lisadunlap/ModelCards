import { Handler } from '@netlify/functions';
import { loadDataFromWasabi, DATASETS } from './_shared/wasabi-loader';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const handler: Handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log(`📡 Datasets function called: ${event.httpMethod} ${event.path}`);
    
    // Handle CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const requestedDataset = queryParams.dataset;
    const loadFullData = queryParams.full === 'true';

    if (event.httpMethod === 'GET') {
      if (loadFullData && requestedDataset) {
        // Load full dataset
        console.log(`📊 Loading full dataset: ${requestedDataset}`);
        
        const cacheKey = `full_${requestedDataset}`;
        const cached = cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
          console.log(`✅ Returning cached full data for ${requestedDataset} (${cached.data.length} items)`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              dataset: requestedDataset,
              data: cached.data,
              totalCount: cached.data.length,
              cached: true,
              processingTime: Date.now() - startTime
            }),
          };
        }

        // Load fresh data
        const fullData = await loadDataFromWasabi(requestedDataset);
        
        // Cache the result
        cache.set(cacheKey, {
          data: fullData,
          timestamp: Date.now()
        });
        
        console.log(`✅ Loaded full dataset: ${fullData.length} items`);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            dataset: requestedDataset,
            data: fullData,
            totalCount: fullData.length,
            cached: false,
            processingTime: Date.now() - startTime
          }),
        };
      } else {
        // Return available datasets
        const datasets = Object.entries(DATASETS).map(([key, config]) => ({
          key,
          ...config
        }));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            datasets,
            default: 'DBSCAN_HIERARCHICAL',
            processingTime: Date.now() - startTime
          }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };

  } catch (error) {
    console.error('❌ Datasets function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }),
    };
  }
}; 