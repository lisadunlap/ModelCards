/**
 * Data Sources Configuration
 * 
 * Centralized configuration for all data sources used in the Model Difference Analyzer.
 * Update these paths to point to your data files.
 */

// -----------------------------------------------------------------------------
// External CDN (e.g., Wasabi / S3) support
// -----------------------------------------------------------------------------
// If you have very large CSV/Parquet files you can host them on an external
// object store instead of bundling them with the Netlify site (Netlify static
// asset limit is 25 MB).  Set VITE_DATA_CDN_BASE in your environment (or
// Netlify UI) to the base URL of the bucket, e.g.
//   VITE_DATA_CDN_BASE=https://vibes.s3.us-west-1.wasabisys.com
// All paths below will automatically be prefixed with this value when it is
// present.  Locally (where the env var is usually unset) the app will fall
// back to the original relative paths in /public.
// -----------------------------------------------------------------------------

// Force CDN_BASE to be empty for local development
const CDN_BASE = '';

// Helper to prefix a path with the CDN base only when the base is defined,
// otherwise use local public directory
const cdnPath = (relativePath: string) => {
  // For local development, ensure we're using the public directory
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
};

export const DATA_SOURCES = {
  // Main CSV files for model properties - Multiple options
  PROPERTIES_CSV: cdnPath('/dbscan_hierarchical_mcs_50-2.csv.gz'),
  
  // Available property file options
  PROPERTY_FILES: {
    DBSCAN_HIERARCHICAL: {
      path: cdnPath('/dbscan_hierarchical_mcs_50-2.csv.gz'),
      label: '500 Arena Prompts on many models',
      description: 'Running a ton of models on 500 different arena prompt (not real arena battles)'
    },
    ARENA_COMPARISON: {
      path: cdnPath('/arena_llm_reduced_labels.csv.gz'),
      // path: cdnPath('/longer_descriptions_epsilon_02_reduced.csv.gz'),
      label: 'Actual Arena Battles',
      description: 'Chatbot Arena model comparison with HDBSCAN clustering'
    },
    WILDBENCH_COMPARISON: {
      path: cdnPath('/wildbench_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz'),
      label: 'Wildbench Model Comparison',
      description: 'Wildbench model comparison using HELM predictions'
    },
    WEBDEV_COMPARISON: {
      path: cdnPath('/webdev_small.csv.gz'),
      label: 'Webdev Arena',
      description: 'Chatbot Arena (webdev version)'
    }
  },
  
  // Embedding data
  EMBEDDINGS_CSV: cdnPath('/embedding_sample.csv'),
  EMBEDDINGS_PARQUET: cdnPath('/all_one_sided_comparisons_clustered_with_embeddings-clean.parquet'),
} as const;

/**
 * Data Loading Configuration
 */
export const DATA_CONFIG = {
  // Performance settings
  MAX_PREVIEW_ROWS: null, // Remove limit to see all models
  ENABLE_DYNAMIC_TYPING: true,
  SKIP_EMPTY_LINES: true,
  
  // File format settings
  USE_COMPRESSED_DATA: true, // Re-enable compression
  USE_PARQUET: false,
  SELECTED_PROPERTY_FILE: 'DBSCAN_HIERARCHICAL',
  
  // Parquet-specific settings (for embeddings)
  PARQUET_BATCH_SIZE: 1000, // Process Parquet in batches for memory efficiency
  
  // Caching settings
  ENABLE_BROWSER_CACHE: true, // Use browser cache for processed data
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  
  // Error handling
  MAX_PARSE_ERRORS: 100, // Maximum parse errors to tolerate
  
  // Memory management
  CHUNK_SIZE: 1000, // For processing large datasets in chunks (if needed)
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB max memory usage
} as const;

// Mutable configuration for runtime changes
export let RUNTIME_CONFIG = {
  selectedPropertyFile: DATA_CONFIG.SELECTED_PROPERTY_FILE as keyof typeof DATA_SOURCES.PROPERTY_FILES,
};

/**
 * Update the selected property file at runtime
 */
export const setSelectedPropertyFile = (fileKey: keyof typeof DATA_SOURCES.PROPERTY_FILES) => {
  RUNTIME_CONFIG.selectedPropertyFile = fileKey;
};

/**
 * Get available property file options
 */
export const getPropertyFileOptions = () => {
  return Object.entries(DATA_SOURCES.PROPERTY_FILES).map(([key, config]) => ({
    key,
    ...config
  }));
};

/**
 * Helper function to get the current data sources based on configuration
 */
export const getCurrentDataSources = () => {
  const config = DATA_CONFIG;
  const selectedFileKey = RUNTIME_CONFIG.selectedPropertyFile;
  
  // Get the selected property file
  const selectedPropertyFile = DATA_SOURCES.PROPERTY_FILES[selectedFileKey as keyof typeof DATA_SOURCES.PROPERTY_FILES];
  const propertiesSource = selectedPropertyFile ? selectedPropertyFile.path : DATA_SOURCES.PROPERTIES_CSV;
  
  const embeddingsSource = config.USE_PARQUET 
    ? DATA_SOURCES.EMBEDDINGS_PARQUET 
    : DATA_SOURCES.EMBEDDINGS_CSV;
  
  return {
    properties: propertiesSource,
    embeddings: embeddingsSource,
    selectedPropertyFile: selectedFileKey,
    selectedPropertyConfig: selectedPropertyFile,
  };
};

/**
 * Helper function to validate if all required files are configured
 */
export const validateDataSources = () => {
  const sources = getCurrentDataSources();
  const missing = [];
  
  if (!sources.properties) missing.push('properties CSV');
  if (!sources.embeddings) missing.push('embeddings data');
  
  if (missing.length > 0) {
    throw new Error(`Missing data sources: ${missing.join(', ')}`);
  }
  
  return true;
};

/**
 * Helper function to get data loading strategy
 */
export const getLoadingStrategy = () => {
  return {
    useCompression: DATA_CONFIG.USE_COMPRESSED_DATA,
    useParquet: DATA_CONFIG.USE_PARQUET,
    enableBrowserCache: DATA_CONFIG.ENABLE_BROWSER_CACHE,
    selectedPropertyFile: RUNTIME_CONFIG.selectedPropertyFile,
  };
}; 