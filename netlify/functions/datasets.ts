import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Dataset configurations
const DATASETS = {
  DBSCAN_HIERARCHICAL: {
    path: 'datasets/dbscan_hierarchical_mcs_50-2.csv.gz',
    label: '500 Arena Prompts on many models',
    description: 'Running a ton of models on 500 different arena prompt (not real arena battles)'
  },
  // Add more datasets as they become available
  // ARENA_COMPARISON: {
  //   path: 'datasets/arena_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz',
  //   label: 'Actual Arena Battles',
  //   description: 'Chatbot Arena model comparison with HDBSCAN clustering'
  // },
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const response = {
      datasets: Object.entries(DATASETS).map(([key, config]) => ({
        key,
        ...config
      })),
      default: 'DBSCAN_HIERARCHICAL'
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Error listing datasets:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}; 