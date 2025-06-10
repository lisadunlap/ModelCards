import React, { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, Eye, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { OpenAI } from 'openai';
import { getCurrentDataSources, DATA_CONFIG } from './config/dataSources';
import { readParquet } from 'parquet-wasm';
import { NORMALIZED_DEMO_PROPERTIES } from './data/demoData';

// Initialize OpenAI client only if API key is available
const getApiKey = () => {
  try {
    // Check if we're in a browser environment and environment variables are available
    if (typeof window !== 'undefined') {
      // Try to access import.meta.env safely
      const env = import.meta.env;
      if (env && typeof env === 'object' && 'VITE_OPENAI_API_KEY' in env) {
        return env.VITE_OPENAI_API_KEY;
      }
    }
    return null;
  } catch (error) {
    console.warn('Could not access environment variables:', error);
    return null;
  }
};

const apiKey = getApiKey();
const hasApiKey = !!(apiKey && 
                    typeof apiKey === 'string' && 
                    apiKey.trim() && 
                    apiKey !== 'undefined' && 
                    apiKey !== 'null' && 
                    apiKey.length > 10); // Basic sanity check for API key length

let openai: OpenAI | null = null;
try {
  if (hasApiKey && apiKey) {
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    console.log('✅ OpenAI client initialized successfully');
  } else {
    console.log('ℹ️ No valid OpenAI API key found - running in demo mode');
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize OpenAI client (will run in demo mode):', error);
  openai = null;
}

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

  // Load the parquet file with embeddings and precomputed examples
  useEffect(() => {
    if (initError) return; // Don't proceed if there's an init error
    
    try {
      loadPrecomputedExamples();
      
      // Only load embedding data if we have an API key OR if precomputed examples fail to load
      // This allows the app to work on GitHub Pages without large data files
      if (hasApiKey) {
        loadEmbeddingData();
      } else {
        // In demo mode, we'll load embedding data only if precomputed examples aren't available
        // This provides a fallback but prioritizes the lightweight demo experience
        setTimeout(() => {
          if (precomputedExamples.length === 0) {
            console.log('🔄 No precomputed examples found, attempting to load embedding data for fallback...');
            loadEmbeddingData();
          } else {
            console.log('✅ Demo mode: Using precomputed examples with demo dataset');
            // Use the small demo dataset for demonstration
            setEmbeddingData(NORMALIZED_DEMO_PROPERTIES.map(prop => ({
              ...prop,
              similarity_score: undefined
            })));
            setDataLoading(false);
            setDataError(null);
          }
        }, 1000); // Give precomputed examples time to load first
      }
    } catch (error) {
      console.error('💥 Error in useEffect:', error);
      setDataError(error instanceof Error ? error.message : 'Unknown error occurred');
      setDataLoading(false);
    }
  }, [hasApiKey, initError]);

  // Update the effect to handle precomputed examples loading
  useEffect(() => {
    if (initError) return;
    
    try {
      if (!hasApiKey && precomputedExamples.length > 0) {
        console.log('✅ Demo mode: Using precomputed examples with demo dataset');
        // Use the small demo dataset for demonstration
        setEmbeddingData(NORMALIZED_DEMO_PROPERTIES.map(prop => ({
          ...prop,
          similarity_score: undefined
        })));
        setDataLoading(false);
        setDataError(null);
      }
    } catch (error) {
      console.error('💥 Error loading demo data:', error);
      setDataError(error instanceof Error ? error.message : 'Error loading demo data');
      setDataLoading(false);
    }
  }, [precomputedExamples, hasApiKey, initError]);

  const loadPrecomputedExamples = async () => {
    try {
      console.log('🔄 Loading precomputed examples...');
      const response = await fetch('./precomputed-examples.json');
      
      if (!response.ok) {
        console.warn('⚠️ Precomputed examples file not found, using minimal fallback examples');
        // Provide minimal fallback examples
        const fallbackExamples = [
          {
            id: 'incorrect-reasoning',
            query: 'incorrect reasoning',
            description: 'Find properties related to logical errors or flawed reasoning',
            embedding: NORMALIZED_DEMO_PROPERTIES[0]?.embedding || [],
            metadata: {
              model: 'text-embedding-3-small',
              dimensions: 1536,
              computed_at: new Date().toISOString()
            }
          },
          {
            id: 'friendly-tone',
            query: 'friendly tone',
            description: 'Find properties related to conversational style and friendliness',
            embedding: NORMALIZED_DEMO_PROPERTIES[1]?.embedding || [],
            metadata: {
              model: 'text-embedding-3-small',
              dimensions: 1536,
              computed_at: new Date().toISOString()
            }
          },
          {
            id: 'refusal-to-answer',
            query: 'refusal to answer',
            description: 'Find properties related to models declining to respond',
            embedding: NORMALIZED_DEMO_PROPERTIES[2]?.embedding || [],
            metadata: {
              model: 'text-embedding-3-small',
              dimensions: 1536,
              computed_at: new Date().toISOString()
            }
          }
        ];
        setPrecomputedExamples(fallbackExamples);
        console.log(`✅ Using ${fallbackExamples.length} fallback examples`);
        return;
      }
      
      const data: PrecomputedExamples = await response.json();
      setPrecomputedExamples(data.examples);
      console.log(`✅ Loaded ${data.examples.length} precomputed examples from file`);
      
    } catch (error) {
      console.warn('⚠️ Failed to load precomputed examples, using minimal fallback:', error);
      // Even if everything fails, provide some basic examples
      const fallbackExamples = [
        {
          id: 'demo-search',
          query: 'demo search',
          description: 'Demonstration of semantic search functionality',
          embedding: new Array(10).fill(0).map(() => Math.random() - 0.5), // Random 10-dim vector
          metadata: {
            model: 'fallback',
            dimensions: 10,
            computed_at: new Date().toISOString()
          }
        }
      ];
      setPrecomputedExamples(fallbackExamples);
      console.log('✅ Using minimal fallback example');
    }
  };

  const loadEmbeddingData = async () => {
    try {
      setDataLoading(true);
      setDataError(null);
      
      console.log('Starting to load embedding data...');
      
      // Try Parquet first if enabled, then fallback to CSV
      if (DATA_CONFIG.USE_PARQUET) {
        try {
          await loadParquetData();
        } catch (parquetError) {
          console.warn('Failed to load Parquet file, falling back to CSV:', parquetError);
          await loadCSVData();
        }
      } else {
      try {
        await loadCSVData();
      } catch (csvError) {
          console.warn('Failed to load CSV file:', csvError);
          setDataError('Embedding data file not found. Please ensure the embedding file exists in the public directory.');
        }
      }
      
    } catch (error) {
      console.error('Error loading embedding data:', error);
      setDataError(error instanceof Error ? error.message : 'Failed to load embedding data');
    } finally {
      setDataLoading(false);
    }
  };

  const loadParquetData = async () => {
    console.log('Loading Parquet embedding data...');
    
    const dataSources = getCurrentDataSources();
    
    try {
      console.log('Fetching Parquet file from:', dataSources.embeddings);
      const response = await fetch(dataSources.embeddings);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Parquet file: ${response.status} ${response.statusText}. Path: ${dataSources.embeddings}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('✅ Parquet file loaded successfully!');
      console.log(`📦 File size: ${(uint8Array.length / 1024 / 1024).toFixed(1)}MB`);
      
      // Read Parquet file using parquet-wasm 0.6.1 API
      console.log('🔄 Parsing Parquet file...');
      const table = readParquet(uint8Array);
      
      console.log('✅ Parquet file parsed successfully!');
      console.log('📊 Parquet table type:', typeof table);
      console.log('📋 Parquet table keys:', Object.keys(table));
      
      // Try different methods to convert the table to JavaScript objects
      let data: any[] = [];
      
      // Method 1: Check if it has a toArray method
      if (typeof (table as any).toArray === 'function') {
        console.log('📝 Using toArray() method...');
        data = (table as any).toArray();
      }
      // Method 2: Check if it's already an array-like structure
      else if (Array.isArray(table)) {
        console.log('📝 Table is already an array...');
        data = table as any[];
      }
      // Method 3: Try to access table data directly
      else if ((table as any).data) {
        console.log('📝 Using table.data property...');
        data = (table as any).data;
      }
      // Method 4: Try Arrow Table conversion
      else if ((table as any).batches || (table as any).recordBatches) {
        console.log('📝 Converting Arrow table to objects...');
        // Convert Arrow table to array of objects
        const batches = (table as any).batches || (table as any).recordBatches;
        for (const batch of batches) {
          const batchData = batch.toArray ? batch.toArray() : batch;
          if (Array.isArray(batchData)) {
            data.push(...batchData);
          }
        }
      }
      // Method 5: Manual iteration if table has row access i am adding extra lines
      else if (typeof (table as any).get === 'function' && (table as any).length) {
        console.log('📝 Using manual row iteration...');
        const length = (table as any).length;
        for (let i = 0; i < Math.min(length, DATA_CONFIG.MAX_PREVIEW_ROWS || 5000); i++) {
          data.push((table as any).get(i));
        }
      }
      else {
        throw new Error('Unable to determine how to extract data from Parquet table. Table structure: ' + JSON.stringify(Object.keys(table)));
      }
      
      console.log(`✅ Parquet data conversion successful!`);
      console.log(`📊 Total rows extracted: ${data.length}`);
      
      if (data.length === 0) {
        throw new Error('No data extracted from Parquet file');
      }
      
      // Log sample of first row to debug structure
      console.log('🔍 First row sample:', Object.keys(data[0] || {}));
      console.log('🔍 First row data preview:', JSON.stringify(data[0], null, 2).substring(0, 200) + '...');
      
      // Limit rows if configured
      const limitedData = DATA_CONFIG.MAX_PREVIEW_ROWS ? data.slice(0, DATA_CONFIG.MAX_PREVIEW_ROWS) : data;
      
      console.log(`🎯 Processing ${limitedData.length} rows from Parquet file...`);
      await processEmbeddingData(limitedData);
      
    } catch (parquetError) {
      console.error('❌ Parquet loading failed:', parquetError);
      console.error('🔧 Error details:', {
        name: parquetError instanceof Error ? parquetError.name : 'Unknown',
        message: parquetError instanceof Error ? parquetError.message : String(parquetError),
        stack: parquetError instanceof Error ? parquetError.stack : undefined
      });
      throw parquetError; // Re-throw to trigger CSV fallback
    }
  };

  const loadCSVData = async () => {
    console.log('Loading CSV embedding data...');
    
    const dataSources = getCurrentDataSources();
    
    // Load the cleaned file with proper JSON embeddings
    const response = await fetch(dataSources.embeddings);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch embedding CSV file: ${response.status} ${response.statusText}. Path: ${dataSources.embeddings}. Please ensure the embedding CSV file exists in the public directory.`);
    }
    
    const fileContent = await response.text();
    console.log('CSV file loaded, size:', fileContent.length);
    
    const Papa = (await import('papaparse')).default;
    
    const parsedData = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: false, // Keep as strings to preserve JSON formatting
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      preview: DATA_CONFIG.MAX_PREVIEW_ROWS || undefined
    });

    if (parsedData.errors.length > 0) {
      console.warn('CSV parsing errors:', parsedData.errors);
    }

    console.log('CSV parsed successfully, rows:', parsedData.data.length);
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
    if (!hasApiKey) {
      throw new Error('OpenAI API key not available - please configure VITE_OPENAI_API_KEY environment variable');
    }
    
    if (!openai) {
      throw new Error('OpenAI client not initialized - please check your configuration');
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

  // Perform semantic search with precomputed examples
  const performSearchWithPrecomputed = useCallback(async (exampleEmbedding: number[], queryText: string) => {
    try {
      setLoading(true);
      setError(null);
      setSearchQuery(queryText); // Update the search query display

      console.log('🔍 Using precomputed embedding for:', queryText);

      // Check if we have embedding data loaded
      if (embeddingData.length === 0) {
        setError('No embedding data available. Please wait for data to load or check your configuration.');
        setSearchResults([]);
        return;
      }

      // Check stored embedding dimensions
      const firstStoredEmbedding = embeddingData[0]?.embedding;
      console.log('📋 Stored embedding dimensions:', firstStoredEmbedding?.length);
      console.log('📏 Precomputed embedding dimensions:', exampleEmbedding.length);

      if (exampleEmbedding.length !== firstStoredEmbedding?.length) {
        throw new Error(`Embedding dimension mismatch: Precomputed has ${exampleEmbedding.length} dimensions, stored embeddings have ${firstStoredEmbedding?.length} dimensions.`);
      }

      // Calculate similarities using dot product (both embeddings are already normalized)
      const resultsWithSimilarity = embeddingData
        .map((item, index) => {
          const similarity = dotProduct(exampleEmbedding, item.embedding!);
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
  }, [embeddingData, hasApiKey]);

  // Perform semantic search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (!hasApiKey || !openai) {
      setError('OpenAI API key not configured. Please use the example queries below.');
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

  if (initError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900">Initialization Error</h4>
            <p className="text-sm text-red-700 mt-1">{initError}</p>
            <button
              onClick={() => {
                setInitError(null);
                window.location.reload();
              }}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                  properties and conversations based on your query.
                </p>
                <div className="text-xs text-purple-600 bg-purple-100 rounded px-3 py-2">
                  <strong>How it works:</strong> Your query is embedded using OpenAI's text-embedding-3-small model, 
                  then we use dot product similarity to find the 10 most similar property descriptions.
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
                onClick={() => performSearchWithPrecomputed(example.embedding, example.query)}
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