import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { gunzipSync } from 'zlib';
import { Readable } from 'stream';
import csv from 'csv-parser';

/**
 * Shared Dataset Definitions
 *
 * This file provides a single source of truth for dataset configurations,
 * used by both the frontend data loader and the backend Netlify functions.
 * This ensures that both environments are aware of the same set of
 * available datasets.
 */

export const DATASETS = {
  DBSCAN_HIERARCHICAL: {
    path: 'datasets/dbscan_hierarchical_mcs_50-2.csv.gz',
    label: '500 Arena Prompts on many models',
    description: 'Running a ton of models on 500 different arena prompt (not real arena battles)'
  },
  ARENA_COMPARISON: {
    path: 'datasets/arena_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz',
    label: 'Actual Arena Battles',
    description: 'Chatbot Arena model comparison with HDBSCAN clustering'
  },
  WILDBENCH_COMPARISON: {
    path: 'datasets/wildbench_full_vibe_results_parsed_processed_hdbscan_clustered.csv.gz',
    label: 'Wildbench Model Comparison',
    description: 'Wildbench model comparison using HELM predictions'
  }
} as const;

export interface PropertyData {
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
  row_id?: number;
}

// Helper function to parse CSV using csv-parser
function parseCSV(csvContent: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from([csvContent]);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`📋 Parsed ${results.length} CSV rows`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

export async function loadDataFromWasabi(dataset: string): Promise<PropertyData[]> {
  const wasabiBucket = process.env.WASABI_BUCKET || 'vibes';
  const wasabiEndpoint = process.env.WASABI_ENDPOINT || 'https://s3.us-west-1.wasabisys.com';
  const wasabiAccessKeyId = process.env.WASABI_ACCESS_KEY_ID;
  const wasabiSecretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
  const wasabiRegion = process.env.WASABI_REGION || 'us-west-1';
  
  const datasetConfig = DATASETS[dataset as keyof typeof DATASETS];
  
  if (!datasetConfig) {
    throw new Error(`Unknown dataset: ${dataset}`);
  }
  
  if (!wasabiAccessKeyId || !wasabiSecretAccessKey) {
    throw new Error('Missing Wasabi credentials. Please set WASABI_ACCESS_KEY_ID and WASABI_SECRET_ACCESS_KEY environment variables.');
  }
  
  console.log(`📡 Loading data from Wasabi: ${datasetConfig.path}`);
  
  // Create S3 client for authenticated requests
  const s3Client = new S3Client({
    region: wasabiRegion,
    endpoint: wasabiEndpoint,
    credentials: {
      accessKeyId: wasabiAccessKeyId,
      secretAccessKey: wasabiSecretAccessKey,
    },
    forcePathStyle: true, // Required for S3-compatible services
  });
  
  try {
    // Get object from Wasabi using authenticated S3 request
    const command = new GetObjectCommand({
      Bucket: wasabiBucket,
      Key: datasetConfig.path,
    });
    
    const response = await s3Client.send(command);
    
    console.log(`📦 Object info: ${response.ContentLength} bytes, modified: ${response.LastModified}`);
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`📦 Downloaded ${buffer.length} bytes`);
    
    // Handle decompression
    let csvContent: string;
    try {
      if (datasetConfig.path.endsWith('.gz')) {
        // Decompress gzipped data
        const decompressed = gunzipSync(buffer);
        csvContent = decompressed.toString('utf8');
        console.log(`📦 Decompressed to ${csvContent.length} characters`);
      } else {
        csvContent = buffer.toString('utf8');
      }
    } catch (decompressError) {
      console.error('❌ Decompression failed, trying as plain text:', decompressError);
      // Fallback: try reading as plain text
      csvContent = buffer.toString('utf8');
    }
    
    console.log(`📦 Final CSV content: ${csvContent.length} characters`);
    
    // Parse CSV using Node.js-compatible parser
    const parsedData = await parseCSV(csvContent);
    
    const processedData = parsedData
      .filter(row => row && row.property_description)
      .map((row, index) => ({
        ...row,
        row_id: index + 1,
      }));
    
    console.log(`✅ Successfully processed ${processedData.length} valid rows`);
    
    return processedData;
      
  } catch (error) {
    console.error('❌ Error loading data from Wasabi:', error);
    throw new Error(`Failed to load data from Wasabi: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 