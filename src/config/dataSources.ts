/**
 * Data Sources Configuration
 * 
 * Centralized configuration for all data sources used in the Model Difference Analyzer.
 * Update these paths to point to your data files.
 */

export const DATA_SOURCES = {
  // Main Parquet files for model properties
  PROPERTIES_CSV: '/all_one_sided_comparisons_clustered_4.csv',
  
  // Embedding data - Using Parquet for better performance and smaller size
  EMBEDDINGS_PARQUET: '/all_one_sided_comparisons_clustered_with_embeddings-clean.parquet',
  EMBEDDINGS_CSV: '/embedding_sample.csv', // Fallback for testing
  
  // Alternative data sources (if you have multiple datasets)
  ALTERNATIVE_DIFFERENCES_CSV: '/alternative_differences.csv',
  ALTERNATIVE_PROPERTIES_CSV: '/alternative_properties.csv',
  
  // Backup or test data sources
  SAMPLE_DIFFERENCES_CSV: '/sample_differences.csv',
  SAMPLE_PROPERTIES_CSV: '/sample_properties.csv',
} as const;

/**
 * Data Loading Configuration
 */
export const DATA_CONFIG = {
  // Performance settings
  MAX_PREVIEW_ROWS: null, // Remove limit to see all models
  ENABLE_DYNAMIC_TYPING: true,
  SKIP_EMPTY_LINES: true,
  
  // Parquet-specific settings
  USE_PARQUET: false, // Toggle between Parquet and CSV - set to false to use CSV sample
  PARQUET_BATCH_SIZE: 1000, // Process Parquet in batches for memory efficiency
  
  // Error handling
  MAX_PARSE_ERRORS: 100, // Maximum parse errors to tolerate
  
  // Memory management
  CHUNK_SIZE: 1000, // For processing large datasets in chunks (if needed)
} as const;

/**
 * Helper function to get the current data sources
 * You can modify this to switch between different datasets
 */
export const getCurrentDataSources = () => {
  return {
    properties: DATA_SOURCES.PROPERTIES_CSV,
    embeddings: DATA_CONFIG.USE_PARQUET ? DATA_SOURCES.EMBEDDINGS_PARQUET : DATA_SOURCES.EMBEDDINGS_CSV,
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