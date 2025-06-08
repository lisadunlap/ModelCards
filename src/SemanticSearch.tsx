import React, { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, Eye, AlertCircle, Sparkles } from 'lucide-react';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only use this for client-side applications
});

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

const SemanticSearch: React.FC<SemanticSearchProps> = ({ onViewResponse }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PropertyDataWithEmbedding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeddingData, setEmbeddingData] = useState<PropertyDataWithEmbedding[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Load the parquet file with embeddings
  useEffect(() => {
    loadEmbeddingData();
  }, []);

  const loadEmbeddingData = async () => {
    try {
      setDataLoading(true);
      setDataError(null);
      
      console.log('Starting to load embedding data...');
      
      // Try CSV first (more reliable for large files)
      try {
        await loadCSVData();
      } catch (csvError) {
        console.warn('Failed to load cleaned CSV file:', csvError);
        setDataError('Cleaned embedding data file not found. Please ensure all_one_sided_comparisons_clustered_with_embeddings-clean.csv exists in the public directory.');
      }
      
    } catch (error) {
      console.error('Error loading embedding data:', error);
      setDataError(error instanceof Error ? error.message : 'Failed to load embedding data');
    } finally {
      setDataLoading(false);
    }
  };

  const loadCSVData = async () => {
    console.log('Loading CSV embedding data...');
    
    // Load the cleaned file with proper JSON embeddings
    const response = await fetch('/embedding_sample.csv');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cleaned CSV file: ${response.status} ${response.statusText}. Please ensure the cleaned CSV file exists in the public directory.`);
    }
    
    const fileContent = await response.text();
    console.log('Cleaned CSV file loaded, size:', fileContent.length);
    
    const Papa = (await import('papaparse')).default;
    
    const parsedData = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: false, // Keep as strings to preserve JSON formatting
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      preview: 1000 // Limit to first 1000 rows for performance
    });

    if (parsedData.errors.length > 0) {
      console.warn('CSV parsing errors:', parsedData.errors);
    }

    console.log('Cleaned CSV parsed successfully, rows:', parsedData.data.length);
    await processEmbeddingData(parsedData.data);
  };

  const processEmbeddingData = async (data: any[]) => {
    // Process the data and parse embeddings
    console.log('🔍 Processing embedding data, first row keys:', Object.keys(data[0] || {}));
    
    const processedData = data
      .filter((row: any) => row.property_description && row.property_description_embedding)
      .map((row: any, index: number) => {
        let embedding: number[] = [];
        try {
          const embeddingRaw = row.property_description_embedding;
          
          if (index < 3) {
            console.log(`🧪 Processing embedding ${index}:`, {
              type: typeof embeddingRaw,
              length: embeddingRaw?.length,
              isArray: Array.isArray(embeddingRaw),
              first100chars: String(embeddingRaw).substring(0, 100)
            });
          }
          
          // Handle different embedding formats
          if (typeof embeddingRaw === 'string') {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(embeddingRaw);
              if (Array.isArray(parsed)) {
                embedding = parsed.map(Number).filter(n => !isNaN(n));
              }
            } catch {
              // If JSON parsing fails, handle numpy array string format
              // Remove brackets, newlines, and extra spaces, then split by space
              const cleanStr = embeddingRaw
                .replace(/^\[|\]$/g, '') // Remove outer brackets
                .replace(/"/g, '') // Remove quotes
                .replace(/\n/g, ' ') // Replace newlines with spaces
                .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
                .replace(/\.\.\./g, '') // Remove ellipsis if present
                .trim();
              
              if (cleanStr.includes(' ')) {
                // Space-separated values (numpy array format)
                embedding = cleanStr
                  .split(' ')
                  .map((val: string) => parseFloat(val.trim()))
                  .filter((val: number) => !isNaN(val) && isFinite(val));
              } else if (cleanStr.includes(',')) {
                // Comma-separated values
                embedding = cleanStr
                  .split(',')
                  .map((val: string) => parseFloat(val.trim()))
                  .filter((val: number) => !isNaN(val) && isFinite(val));
              }
            }
          } else if (Array.isArray(embeddingRaw)) {
            // Already an array
            embedding = embeddingRaw.map(Number).filter(n => !isNaN(n));
          } else if (embeddingRaw && typeof embeddingRaw === 'object') {
            // Handle Arrow/Parquet array format or other object types
            try {
              embedding = Array.from(embeddingRaw).map(Number).filter(n => !isNaN(n));
            } catch {
              console.warn('Failed to convert object to array for row:', index);
            }
          }
          
          if (index < 3) {
            console.log(`✅ Parsed embedding ${index}: length=${embedding.length}, sample=[${embedding.slice(0, 5).join(', ')}...]`);
          }
          
        } catch (e) {
          console.warn(`❌ Failed to parse embedding for row ${index}:`, e, 'Raw data:', row.property_description_embedding);
        }
        
        return {
          ...row,
          embedding
        } as PropertyDataWithEmbedding;
      })
      .filter((row: PropertyDataWithEmbedding) => row.embedding && row.embedding.length > 0);
    
    console.log(`📊 Processed embedding data: ${processedData.length} valid embeddings out of ${data.length} total rows`);
    
    if (processedData.length === 0) {
      throw new Error('No valid embedding data found. Please check the embedding format in your CSV file.');
    }
    
    // Normalize all embeddings for consistent similarity calculations
    console.log('🔧 Normalizing embeddings...');
    const normalizedData = processedData.map((item, index) => {
      const normalizedEmbedding = normalizeEmbedding(item.embedding!);
      
      if (index < 3) {
        // Debug normalization for first few embeddings
        const originalMagnitude = Math.sqrt(item.embedding!.reduce((sum, val) => sum + val * val, 0));
        const normalizedMagnitude = Math.sqrt(normalizedEmbedding.reduce((sum, val) => sum + val * val, 0));
        console.log(`🎯 Normalized embedding ${index}: original magnitude=${originalMagnitude.toFixed(4)}, normalized magnitude=${normalizedMagnitude.toFixed(4)}`);
      }
      
      return {
        ...item,
        embedding: normalizedEmbedding
      };
    });
    
    console.log('✅ All embeddings normalized successfully!');
    
    // Log embedding dimensions
    const dimensions = normalizedData.map(item => item.embedding!.length);
    const uniqueDimensions = [...new Set(dimensions)];
    console.log(`📏 Embedding dimensions found: ${uniqueDimensions.join(', ')}`);
    
    if (uniqueDimensions.length > 1) {
      console.warn('⚠️ Multiple embedding dimensions found! This may cause issues.');
    }
    
    setEmbeddingData(normalizedData);
    console.log('✅ Embedding data set successfully!');
  };

  // Function to embed query using OpenAI API
  const embedQuery = async (query: string): Promise<number[]> => {
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

  // Calculate cosine similarity between two vectors
  const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  // Normalize embedding vector to unit length
  const normalizeEmbedding = (embedding: number[]): number[] => {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return embedding; // Avoid division by zero
    return embedding.map(val => val / magnitude);
  };

  // Calculate dot product between normalized vectors (equivalent to cosine similarity for normalized vectors)
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

    try {
      setLoading(true);
      setError(null);

      // Embed the user's query
      console.log('🔍 Embedding user query:', searchQuery);
      const queryEmbedding = await embedQuery(searchQuery);
      console.log('📊 Query embedding dimensions:', queryEmbedding.length);
      console.log('📈 Query embedding sample:', queryEmbedding.slice(0, 5));

      // Normalize the query embedding
      const normalizedQueryEmbedding = normalizeEmbedding(queryEmbedding);
      const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      const normalizedQueryMagnitude = Math.sqrt(normalizedQueryEmbedding.reduce((sum, val) => sum + val * val, 0));
      console.log(`🎯 Normalized query embedding: original magnitude=${queryMagnitude.toFixed(4)}, normalized magnitude=${normalizedQueryMagnitude.toFixed(4)}`);

      // Check stored embedding dimensions
      const firstStoredEmbedding = embeddingData[0]?.embedding;
      console.log('📋 Stored embedding dimensions:', firstStoredEmbedding?.length);
      console.log('📉 Stored embedding sample:', firstStoredEmbedding?.slice(0, 5));

      if (normalizedQueryEmbedding.length !== firstStoredEmbedding?.length) {
        throw new Error(`Embedding dimension mismatch: Query has ${normalizedQueryEmbedding.length} dimensions, stored embeddings have ${firstStoredEmbedding?.length} dimensions. The embeddings were likely created with a different model.`);
      }

      // Calculate similarities using dot product (equivalent to cosine similarity for normalized vectors)
      // This is more efficient than cosine similarity calculation
      const resultsWithSimilarity = embeddingData
        .map((item, index) => {
          const similarity = dotProduct(normalizedQueryEmbedding, item.embedding!);
          if (index < 3) { // Debug first few similarities
            console.log(`💯 Similarity ${index}:`, similarity.toFixed(4), 'for:', item.property_description.substring(0, 50));
          }
          return {
            ...item,
            similarity_score: similarity
          };
        })
        .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
        .slice(0, 10);

      console.log('🎯 Top 3 similarities:', resultsWithSimilarity.slice(0, 3).map(r => r.similarity_score?.toFixed(4)));
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
            <button
              onClick={loadEmbeddingData}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-purple-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-purple-900 mb-2">Semantic Search</h3>
            <p className="text-sm text-purple-700 mb-3">
              Search for model properties using natural language. Our AI will find the most semantically similar 
              properties and conversations based on your query.
            </p>
            <div className="text-xs text-purple-600 bg-purple-100 rounded px-3 py-2">
              <strong>How it works:</strong> Your query is embedded using OpenAI's text-embedding-3-small model, 
              then we normalize all embeddings and use dot product similarity to find the 10 most similar property descriptions in our dataset.
            </div>
          </div>
        </div>
      </div>

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