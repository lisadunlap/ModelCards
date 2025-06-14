import { getOpenAIApiKey, hasValidApiKey, initializeOpenAIClient, getOpenAIClient } from '../config/apiConfig';

interface SearchResult {
  id: string;
  score: number;
  metadata: {
    prompt: string;
    model_1_response: string;
    model_2_response: string;
    model_1_name: string;
    model_2_name: string;
    property_description: string;
    category: string;
    impact: string;
    model: string;
    [key: string]: any;
  };
}

interface VectorSearchResponse {
  matches: SearchResult[];
  total: number;
}

class VectorSearchService {
  private pineconeApiKey: string | null = null;
  private pineconeUrl: string | null = null;

  constructor() {
    // Get Pinecone config from environment
    this.pineconeApiKey = import.meta.env.VITE_PINECONE_API_KEY || null;
    this.pineconeUrl = import.meta.env.VITE_PINECONE_URL || null;
  }

  async searchSimilar(query: string, topK: number = 10): Promise<VectorSearchResponse> {
    if (!hasValidApiKey()) {
      throw new Error('OpenAI API key required for embedding generation');
    }

    if (!this.pineconeApiKey || !this.pineconeUrl) {
      throw new Error('Pinecone configuration missing. Please set VITE_PINECONE_API_KEY and VITE_PINECONE_URL');
    }

    try {
      // 1. Generate embedding for the query
      const queryEmbedding = await this.embedQuery(query);

      // 2. Search Pinecone
      const searchResponse = await fetch(`${this.pineconeUrl}/query`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
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
        throw new Error(`Pinecone search failed: ${searchResponse.statusText}`);
      }

      const data = await searchResponse.json();
      
      return {
        matches: data.matches || [],
        total: data.matches?.length || 0,
      };
    } catch (error) {
      console.error('Vector search error:', error);
      throw error;
    }
  }

  private async embedQuery(query: string): Promise<number[]> {
    const initialized = await initializeOpenAIClient();
    const openai = getOpenAIClient();
    
    if (!initialized || !openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to check if service is configured
  isConfigured(): boolean {
    return !!(this.pineconeApiKey && this.pineconeUrl && hasValidApiKey());
  }
}

export const vectorSearchService = new VectorSearchService();
export type { SearchResult, VectorSearchResponse }; 