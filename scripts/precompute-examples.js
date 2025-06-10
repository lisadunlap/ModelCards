import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Example queries to precompute
const EXAMPLE_QUERIES = [
  {
    id: 'incorrect-reasoning',
    query: 'incorrect reasoning',
    description: 'Find properties related to logical errors or flawed reasoning'
  },
  {
    id: 'friendly-tone',
    query: 'friendly tone',
    description: 'Find properties related to conversational style and friendliness'
  },
  {
    id: 'refusal-to-answer',
    query: 'refusal to answer',
    description: 'Find properties related to models declining to respond'
  }
];

// Function to embed a single query
async function embedQuery(query) {
  try {
    console.log(`🔄 Embedding query: "${query}"`);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    
    const embedding = response.data[0].embedding;
    console.log(`✅ Successfully embedded "${query}" (${embedding.length} dimensions)`);
    
    return embedding;
  } catch (error) {
    console.error(`❌ Failed to embed "${query}":`, error.message);
    throw error;
  }
}

// Normalize embedding vector to unit length
function normalizeEmbedding(embedding) {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map(val => val / magnitude);
}

// Main function to precompute all examples
async function precomputeExamples() {
  console.log('🚀 Starting precomputation of example embeddings...\n');
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set!');
    console.log('Please set your OpenAI API key:');
    console.log('export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }
  
  const results = [];
  
  try {
    // Process each example query
    for (const example of EXAMPLE_QUERIES) {
      console.log(`\n📝 Processing: ${example.query}`);
      console.log(`   Description: ${example.description}`);
      
      // Get embedding from OpenAI
      const rawEmbedding = await embedQuery(example.query);
      
      // Normalize the embedding
      const normalizedEmbedding = normalizeEmbedding(rawEmbedding);
      
      // Verify normalization
      const magnitude = Math.sqrt(normalizedEmbedding.reduce((sum, val) => sum + val * val, 0));
      console.log(`   Normalized magnitude: ${magnitude.toFixed(6)} (should be ~1.0)`);
      
      results.push({
        id: example.id,
        query: example.query,
        description: example.description,
        embedding: normalizedEmbedding,
        metadata: {
          model: "text-embedding-3-small",
          dimensions: normalizedEmbedding.length,
          computed_at: new Date().toISOString()
        }
      });
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save results to JSON file
    const outputPath = path.join(__dirname, '..', 'public', 'precomputed-examples.json');
    const outputDir = path.dirname(outputPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`\n📁 Created directory: ${outputDir}`);
    }
    
    const output = {
      generated_at: new Date().toISOString(),
      model_used: "text-embedding-3-small",
      total_examples: results.length,
      examples: results
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Successfully precomputed ${results.length} example embeddings!`);
    console.log(`📄 Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    results.forEach(result => {
      console.log(`   • "${result.query}" (${result.embedding.length} dims)`);
    });
    
    console.log('\n🎉 All done! You can now use these examples in your app.');
    
  } catch (error) {
    console.error('\n💥 Error during precomputation:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  precomputeExamples();
} 