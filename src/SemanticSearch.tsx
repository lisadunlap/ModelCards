import React, { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, Eye, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { getCurrentDataSources, DATA_CONFIG } from './config/dataSources';
import { getOpenAIApiKey, hasValidApiKey, initializeOpenAIClient, getOpenAIClient } from './config/apiConfig';
import { vectorSearchService, SearchResult } from './services/vectorSearch';
import { NORMALIZED_DEMO_PROPERTIES } from './data/demoData';
import { PropertyDataWithEmbedding } from './types';

// Use centralized API configuration
const hasApiKey = hasValidApiKey();

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
  const [precomputedExamples, setPrecomputedExamples] = useState<PrecomputedExample[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [isVectorSearchConfigured, setIsVectorSearchConfigured] = useState(false);

  // Check for initialization errors and vector search configuration
  React.useEffect(() => {
    try {
      console.log('🔄 Initializing SemanticSearch component...');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setInitError('Component must run in browser environment');
        return;
      }
      
      // Check vector search configuration
      const vectorConfigured = vectorSearchService.isConfigured();
      setIsVectorSearchConfigured(vectorConfigured);
      
      console.log('✅ SemanticSearch component initialized successfully');
      console.log(`🔑 API key available: ${hasApiKey ? 'Yes' : 'No (demo mode)'}`);
      console.log(`🔍 Vector search configured: ${vectorConfigured ? 'Yes' : 'No'}`);
      
      // Ensure we always have some demo examples as a fallback
      if (!hasApiKey || !vectorConfigured) {
        setTimeout(() => {
          if (precomputedExamples.length === 0) {
            console.log('🔄 No examples loaded, creating emergency fallback...');
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
        }, 3000);
      }
      
    } catch (error) {
      console.error('💥 Initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
    }
  }, [hasApiKey, precomputedExamples.length]);

  // Perform semantic search using vector database
  const performVectorSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Performing vector search for:', query);
      const response = await vectorSearchService.searchSimilar(query, 10);
      
      // Convert SearchResult to PropertyDataWithEmbedding format
      const convertedResults: PropertyDataWithEmbedding[] = response.matches.map((match: SearchResult) => ({
        ...match.metadata,
        similarity_score: match.score,
        // Ensure required fields exist
        prompt: match.metadata.prompt || '',
        model_1_response: match.metadata.model_1_response || '',
        model_2_response: match.metadata.model_2_response || '',
        model_1_name: match.metadata.model_1_name || '',
        model_2_name: match.metadata.model_2_name || '',
        differences: match.metadata.differences || '',
        parsed_differences: match.metadata.parsed_differences || '',
        model: match.metadata.model || '',
        property_description: match.metadata.property_description || '',
        category: match.metadata.category || '',
        evidence: match.metadata.evidence || '',
        type: match.metadata.type || '',
        reason: match.metadata.reason || '',
        impact: match.metadata.impact || '',
        property_description_coarse_cluster_label: match.metadata.property_description_coarse_cluster_label || '',
        property_description_fine_cluster_label: match.metadata.property_description_fine_cluster_label || '',
        property_description_coarse_cluster_id: match.metadata.property_description_coarse_cluster_id || 0,
        property_description_fine_cluster_id: match.metadata.property_description_fine_cluster_id || 0,
      }));

      setSearchResults(convertedResults);
      console.log(`✅ Found ${convertedResults.length} results`);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Perform demo search using local embeddings
  const performDemoSearch = useCallback(async (exampleQuery: string) => {
    console.log('🔍 Performing demo search for:', exampleQuery);
    
    // For demo, just return some sample results based on the query
    const demoResults = NORMALIZED_DEMO_PROPERTIES.slice(0, 3).map((item, index) => ({
      ...item,
      similarity_score: 0.8 - (index * 0.1), // Mock similarity scores
    }));
    
    setSearchResults(demoResults);
  }, []);

  // Main search handler
  const performSearch = useCallback(async (queryOverride?: string) => {
    const query = queryOverride || searchQuery;
    
    if (isVectorSearchConfigured && hasApiKey) {
      await performVectorSearch(query);
    } else {
      await performDemoSearch(query);
    }
  }, [searchQuery, isVectorSearchConfigured, hasApiKey, performVectorSearch, performDemoSearch]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // Handle example query click
  const handleExampleClick = (example: PrecomputedExample) => {
    setSearchQuery(example.query);
    performSearch(example.query);
  };

  if (initError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900">Initialization Error</h4>
            <p className="text-sm text-red-700 mt-1">{initError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className={`border rounded-lg p-6 ${isVectorSearchConfigured && hasApiKey ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className={`flex items-center justify-center h-10 w-10 rounded-md text-white ${isVectorSearchConfigured && hasApiKey ? 'bg-purple-500' : 'bg-blue-500'}`}>
              {isVectorSearchConfigured && hasApiKey ? <Sparkles className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-medium mb-2 ${isVectorSearchConfigured && hasApiKey ? 'text-purple-900' : 'text-blue-900'}`}>
              {isVectorSearchConfigured && hasApiKey ? 'Semantic Search' : 'Demo Mode - Semantic Search'}
            </h3>
            {isVectorSearchConfigured && hasApiKey ? (
              <div>
                <p className="text-sm text-purple-700 mb-3">
                  Search through millions of model properties using natural language. Our vector database provides 
                  lightning-fast semantic similarity search.
                </p>
                <div className="text-xs text-purple-600 bg-purple-100 rounded px-3 py-2">
                  <strong>Powered by:</strong> Vector database with OpenAI embeddings for instant semantic search 
                  across your entire dataset without loading it client-side.
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-blue-700 mb-3">
                  Try semantic search with demo examples! These examples demonstrate how AI can find 
                  semantically similar model properties.
                </p>
                <div className="text-xs text-blue-600 bg-blue-100 rounded px-3 py-2 mb-3">
                  <strong>Demo mode:</strong> {!hasApiKey ? 'OpenAI API key required for full search.' : 'Vector database not configured.'} 
                  Click examples below to see semantic search in action.
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

      {/* Example Queries */}
      {precomputedExamples.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <h4 className="font-medium text-gray-900 mb-3">
            {isVectorSearchConfigured && hasApiKey ? 'Try these examples:' : 'Available example searches:'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {precomputedExamples.map((example) => (
              <button
                key={example.id}
                onClick={() => handleExampleClick(example)}
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

      {/* Search Interface */}
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
              {isVectorSearchConfigured ? 'Searching vector database...' : 'Demo search with sample data'}
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

      {/* Configuration Status */}
      {!isVectorSearchConfigured && hasApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900">Vector Database Configuration Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                To search your full dataset, please configure Pinecone or another vector database. 
                Add VITE_PINECONE_API_KEY and VITE_PINECONE_URL to your environment variables.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Key Missing Notice */}
      {!hasApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900">OpenAI API Key Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                To use full semantic search, please add your OpenAI API key to the environment variables.
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