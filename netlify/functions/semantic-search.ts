import { Handler } from '@netlify/functions';

interface SearchRequest {
  query: string;
  topK?: number;
}

interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export const handler: Handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { query, topK = 10 }: SearchRequest = JSON.parse(event.body || '{}');

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query is required' }),
      };
    }

    // Get environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeUrl = process.env.PINECONE_URL;

    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' }),
      };
    }

    if (!pineconeApiKey || !pineconeUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Pinecone not configured' }),
      };
    }

    // 1. Generate embedding using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search Pinecone
    const searchResponse = await fetch(`${pineconeUrl}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': pineconeApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: false,
      }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Pinecone search error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        matches: searchData.matches || [],
        total: searchData.matches?.length || 0,
      }),
    };

  } catch (error) {
    console.error('Semantic search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}; 