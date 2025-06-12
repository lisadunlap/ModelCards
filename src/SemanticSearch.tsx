import React, { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, Eye, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { getCurrentDataSources, DATA_CONFIG } from './config/dataSources';
import { getOpenAIApiKey, hasValidApiKey, initializeOpenAIClient, getOpenAIClient } from './config/apiConfig';
import { readParquet } from 'parquet-wasm';
import { NORMALIZED_DEMO_PROPERTIES } from './data/demoData';

// Use centralized API configuration
const hasApiKey = hasValidApiKey();

interface PropertyDataWithEmbedding {
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
  embedding?: number[];
  similarity_score?: number;
}

interface SemanticSearchProps {
  onViewResponse?: (item: PropertyDataWithEmbedding) => void;
}

interface PrecomputedExample {
  id: string;
  query: string;
  description: string;
  embedding: number[];
  metadata: {
    model: string;
    dimensions: number;
    computed_at: string;
  };
}

interface PrecomputedExamples {
  generated_at: string;
  model_used: string;
  total_examples: number;
  examples: PrecomputedExample[];
}

const SemanticSearch: React.FC<SemanticSearchProps> = ({ onViewResponse }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PropertyDataWithEmbedding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeddingData, setEmbeddingData] = useState<PropertyDataWithEmbedding[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [precomputedExamples, setPrecomputedExamples] = useState<PrecomputedExample[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  // Check for initialization errors
  React.useEffect(() => {
    try {
      // Test basic functionality
      console.log('🔄 Initializing SemanticSearch component...');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setInitError('Component must run in browser environment');
        return;
      }
      
      console.log('✅ SemanticSearch component initialized successfully');
      console.log(`🔑 API key available: ${hasApiKey ? 'Yes' : 'No (demo mode)'}`);
      
      // Ensure we always have some demo examples as a last resort
      if (!hasApiKey) {
        setTimeout(() => {
          if (precomputedExamples.length === 0) {
            console.log('🔄 No examples loaded, creating emergency fallback...');
            // Create absolutely minimal fallback examples
            const emergencyExamples = [
              {
                id: 'demo-1',
                query: 'scientific explanation',
                description: 'Demo: Find properties related to scientific explanations',
                embedding: NORMALIZED_DEMO_PROPERTIES[0]?.embedding || new Array(10).fill(0.1),
                metadata: { model: 'demo', dimensions: 10, computed_at: new Date().toISOString() }
              },
              {
                id: 'demo-2', 
                query: 'creative writing',
                description: 'Demo: Find properties related to creative writing',
                embedding: NORMALIZED_DEMO_PROPERTIES[1]?.embedding || new Array(10).fill(-0.1),
                metadata: { model: 'demo', dimensions: 10, computed_at: new Date().toISOString() }
              },
              {
                id: 'demo-3',
                query: 'safety refusal',
                description: 'Demo: Find properties related to safety and refusals',
                embedding: NORMALIZED_DEMO_PROPERTIES[2]?.embedding || new Array(10).fill(0.2),
                metadata: { model: 'demo', dimensions: 10, computed_at: new Date().toISOString() }
              }
            ];
            setPrecomputedExamples(emergencyExamples);
            console.log('✅ Emergency fallback examples created');
          }
        }, 3000); // Give other loading mechanisms time to work first
      }
      
    } catch (error) {
      console.error('💥 Initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
    }
  }, [hasApiKey, precomputedExamples.length]);

  // Load the CSV file with embeddings
  useEffect(() => {
    const loadEmbeddingData = async () => {
      try {
        setDataLoading(true);
        setDataError(null);
        
        const dataSources = getCurrentDataSources();
        const response = await fetch(dataSources.embeddings);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch embedding CSV file: ${response.status} ${response.statusText}`);
        }
        
        const csvContent = await response.text();
        const Papa = (await import('papaparse')).default;
        
        const parsedData = Papa.parse(csvContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        if (parsedData.errors.length > 0) {
          console.warn('CSV parsing errors:', parsedData.errors);
        }

        // Process the data and parse embeddings
        const processedData = parsedData.data
          .filter((row: any) => row.property_description && row.property_description_embedding)
          .map((row: any) => {
            let embedding: number[] = [];
            try {
              const embeddingRaw = row.property_description_embedding;
              
              if (typeof embeddingRaw === 'string') {
                embedding = JSON.parse(embeddingRaw);
              } else if (Array.isArray(embeddingRaw)) {
                embedding = embeddingRaw;
              }
            } catch (e) {
              console.warn('Failed to parse embedding:', e);
            }
            
            return {
              ...row,
              embedding
            };
          })
          .filter((row: PropertyDataWithEmbedding) => row.embedding && row.embedding.length > 0);

        // Normalize embeddings
        const normalizedData = processedData.map(item => ({
          ...item,
          embedding: normalizeEmbedding(item.embedding!)
        }));

        setEmbeddingData(normalizedData);
        setDataLoading(false);
      } catch (error) {
        console.error('Error loading embedding data:', error);
        setDataError(error instanceof Error ? error.message : 'Failed to load embedding data');
        setDataLoading(false);
      }
    };

    loadEmbeddingData();
  }, []);

  // Function to embed query using OpenAI API
  const embedQuery = async (query: string): Promise<number[]> => {
    if (!hasApiKey) {
      throw new Error('OpenAI API key not available');
    }
    
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
  };

  // Normalize embedding vector to unit length
  const normalizeEmbedding = (embedding: number[]): number[] => {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return embedding;
    return embedding.map(val => val / magnitude);
  };

  // Calculate dot product between normalized vectors
  const dotProduct = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0;
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  };

  // Perform semantic search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (!hasApiKey) {
      setError('OpenAI API key not configured. Please add your API key to use semantic search.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Embed the user's query
      const queryEmbedding = await embedQuery(searchQuery);
      const normalizedQueryEmbedding = normalizeEmbedding(queryEmbedding);

      // Calculate similarities
      const resultsWithSimilarity = embeddingData
        .map(item => ({
          ...item,
          similarity_score: dotProduct(normalizedQueryEmbedding, item.embedding!)
        }))
        .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
        .slice(0, 10);

      setSearchResults(resultsWithSimilarity);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, embeddingData]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading embedding data...</span>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900">Error Loading Embedding Data</h4>
            <p className="text-sm text-red-700 mt-1">{dataError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className={`border rounded-lg p-6 ${hasApiKey ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className={`flex items-center justify-center h-10 w-10 rounded-md text-white ${hasApiKey ? 'bg-purple-500' : 'bg-blue-500'}`}>
              {hasApiKey ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-medium mb-2 ${hasApiKey ? 'text-purple-900' : 'text-blue-900'}`}>
              {hasApiKey ? 'Semantic Search' : 'Demo Mode - Semantic Search'}
            </h3>
            {hasApiKey ? (
              <div>
                <p className="text-sm text-purple-700 mb-3">
                  Search for model properties using natural language. Our AI will find the most semantically similar 
                  properties based on your query.
                </p>
                <div className="text-xs text-purple-600 bg-purple-100 rounded px-3 py-2">
                  <strong>How it works:</strong> Your query is embedded using OpenAI's text-embedding-3-small model, 
                  then we use dot product similarity to find the most similar property descriptions.
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-blue-700 mb-3">
                  Try semantic search with precomputed example queries! These examples demonstrate how AI can find 
                  semantically similar model properties without requiring your own OpenAI API key.
                </p>
                <div className="text-xs text-blue-600 bg-blue-100 rounded px-3 py-2 mb-3">
                  <strong>Demo mode:</strong> Click the example buttons below to see semantic search in action. 
                  Each example uses precomputed embeddings to find similar properties in the dataset.
                </div>
                {precomputedExamples.length > 0 && (
                  <div className="text-xs text-green-700 bg-green-100 rounded px-3 py-2">
                    ✅ {precomputedExamples.length} example queries available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Example Queries (always show, but prominence depends on API key availability) */}
      {precomputedExamples.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h4 className="font-medium text-gray-900 mb-3">
            {hasApiKey ? 'Try these examples:' : 'Available example searches:'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {precomputedExamples.map((example) => (
              <button
                key={example.id}
                onClick={() => performSearch()}
                disabled={loading}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-gray-900 mb-1">"{example.query}"</div>
                <div className="text-sm text-gray-600">{example.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Interface (only show if API key is available) */}
      {hasApiKey && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search for model properties or behaviors
              </label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  placeholder="e.g., 'models that are creative in storytelling' or 'handling of mathematical reasoning'"
                  className="w-full border border-gray-300 rounded-md px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {embeddingData.length.toLocaleString()} properties available for search
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* API Key Missing Notice (only show if no API key and no precomputed examples) */}
      {!hasApiKey && precomputedExamples.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900">OpenAI API Key Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                To use custom semantic search, please add your OpenAI API key to the environment variables. 
                Alternatively, precomputed examples can be generated using the precompute script.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({searchResults.length})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Ranked by semantic similarity to your query
            </p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {searchResults.map((item, index) => (
              <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
                        #{index + 1}
                      </span>
                      <span className="text-sm text-gray-500">
                        Similarity: {((item.similarity_score || 0) * 100).toFixed(1)}%
                      </span>
                      <span className="text-sm text-gray-500">
                        Model: {item.model}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Property Description</h4>
                      <p className="text-sm text-gray-700">{item.property_description}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {item.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {item.property_description_coarse_cluster_label}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {item.property_description_fine_cluster_label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        item.impact === 'High' ? 'bg-red-100 text-red-800' :
                        item.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.impact} Impact
                      </span>
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {onViewResponse && (
                      <button
                        onClick={() => onViewResponse(item)}
                        className="flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        <span>View</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different search query or check your spelling.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SemanticSearch; 