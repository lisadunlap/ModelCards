#!/usr/bin/env node

/**
 * Sample Data Generator
 * 
 * This script generates a smaller sample CSV file by randomly selecting 10k rows
 * from the main CSV file. This can be used as a fallback when the main file is too large.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  INPUT_FILE: './public/all_one_sided_comparisons_clustered_4_sample.csv',
  OUTPUT_FILE: './public/sample_properties_10k.csv',
  SAMPLE_SIZE: 10000,
  ENCODING: 'utf8'
};

/**
 * Parse CSV content manually (simple CSV parser)
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0];
  const rows = lines.slice(1);
  
  console.log(`📊 Parsed CSV: ${rows.length} data rows + 1 header row`);
  return { headers, rows };
}

/**
 * Randomly sample rows from the dataset
 */
function sampleRows(rows, sampleSize) {
  if (rows.length <= sampleSize) {
    console.log(`⚠️  Dataset has ${rows.length} rows, which is ≤ sample size ${sampleSize}. Taking all rows.`);
    return rows;
  }
  
  const sampled = [];
  const usedIndices = new Set();
  
  while (sampled.length < sampleSize && usedIndices.size < rows.length) {
    const randomIndex = Math.floor(Math.random() * rows.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      sampled.push(rows[randomIndex]);
    }
  }
  
  console.log(`🎲 Randomly sampled ${sampled.length} rows from ${rows.length} total rows`);
  return sampled;
}

/**
 * Generate sample CSV file
 */
async function generateSampleFile() {
  try {
    console.log('🔄 Starting sample data generation...');
    console.log(`📁 Input file: ${CONFIG.INPUT_FILE}`);
    console.log(`📄 Output file: ${CONFIG.OUTPUT_FILE}`);
    console.log(`🎯 Sample size: ${CONFIG.SAMPLE_SIZE} rows`);
    
    // Check if input file exists
    if (!fs.existsSync(CONFIG.INPUT_FILE)) {
      throw new Error(`Input file not found: ${CONFIG.INPUT_FILE}`);
    }
    
    // Get file size for reference
    const stats = fs.statSync(CONFIG.INPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Input file size: ${fileSizeMB} MB`);
    
    // Read the input CSV file
    console.log('📖 Reading input CSV file...');
    const csvContent = fs.readFileSync(CONFIG.INPUT_FILE, CONFIG.ENCODING);
    console.log(`✅ File read successfully (${csvContent.length.toLocaleString()} characters)`);
    
    // Parse CSV content
    console.log('🔍 Parsing CSV content...');
    const { headers, rows } = parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('No data rows found in the input file');
    }
    
    // Sample random rows
    console.log(`🎲 Sampling ${CONFIG.SAMPLE_SIZE} random rows...`);
    const sampledRows = sampleRows(rows, CONFIG.SAMPLE_SIZE);
    
    // Create output CSV content
    const outputContent = [headers, ...sampledRows].join('\n');
    
    // Write output file
    console.log(`💾 Writing sample data to ${CONFIG.OUTPUT_FILE}...`);
    fs.writeFileSync(CONFIG.OUTPUT_FILE, outputContent, CONFIG.ENCODING);
    
    // Verify output file
    const outputStats = fs.statSync(CONFIG.OUTPUT_FILE);
    const outputSizeMB = (outputStats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Sample file generated successfully!');
    console.log(`📊 Output file size: ${outputSizeMB} MB`);
    console.log(`📈 Size reduction: ${fileSizeMB} MB → ${outputSizeMB} MB (${((1 - outputStats.size / stats.size) * 100).toFixed(1)}% reduction)`);
    console.log(`📄 Rows: ${rows.length} → ${sampledRows.length}`);
    
    // Show sample of what was generated
    console.log('\n📋 Sample of generated data:');
    const sampleLines = outputContent.split('\n').slice(0, 3);
    sampleLines.forEach((line, index) => {
      const label = index === 0 ? 'Header' : `Row ${index}`;
      const preview = line.length > 100 ? `${line.substring(0, 100)}...` : line;
      console.log(`   ${label}: ${preview}`);
    });
    
  } catch (error) {
    console.error('❌ Error generating sample file:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSampleFile();
}

export { generateSampleFile }; 