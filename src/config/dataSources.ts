/**
 * Data Sources Configuration
 * 
 * Centralized configuration for all data sources used in the Model Difference Analyzer.
 * Update these paths to point to your data files.
 */

export const DATA_SOURCES = {
  // Main CSV files for model properties - Multiple options
  PROPERTIES_CSV: './wildbench_comparisons_sample_hdbscan_clustered.csv.gz',
  
  // Available property file options
  PROPERTY_FILES: {
    DBSCAN_HIERARCHICAL: {
      path: './dbscan_hierarchical_mcs_50-2.csv.gz',
      label: '500 Arena Prompts on many models',
      description: 'Running a ton of models on 500 different arena prompt (not real arena battles)'
    },
    ARENA_COMPARISON: {
      path: './arena_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz',
      label: 'Actual Arena Battles',
      description: 'Chatbot Arena model comparison with HDBSCAN clustering'
    },
    // WILDBENCH_COMPARISON: {
    //   path: './wildbench_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz',
    //   label: 'Wildbench Model Comparison',
    //   description: 'Wildbench model comparison with HDBSCAN clustering'
    // }
  },
  
  // Embedding data
  EMBEDDINGS_CSV: './embedding_sample.csv',
  EMBEDDINGS_PARQUET: './all_one_sided_comparisons_clustered_with_embeddings-clean.parquet',
  
  // Backup or test data sources (legacy - keep for reference)
  SAMPLE_DIFFERENCES_CSV: './sample_differences.csv',
  SAMPLE_PROPERTIES_CSV: './sample_properties.csv',
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
  USE_COMPRESSED_DATA: true, // Use compressed file (.gz) - recommended for performance
  USE_PARQUET: false, // Toggle between Parquet and CSV for embeddings
  SELECTED_PROPERTY_FILE: 'DBSCAN_HIERARCHICAL', // Default selection
  
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