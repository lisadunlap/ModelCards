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

// Demo properties to embed
const DEMO_PROPERTIES = [
  {
    prompt: "Explain the concept of photosynthesis",
    model_1_response: "Photosynthesis is the process by which plants convert sunlight into energy...",
    model_2_response: "Plants use photosynthesis to make food from sunlight and carbon dioxide...",
    model_1_name: "GPT-4",
    model_2_name: "Claude-3",
    differences: "Different levels of detail and scientific terminology",
    parsed_differences: "Model 1 uses more technical language while Model 2 is more accessible",
    model: "GPT-4",
    property_description: "Provides detailed scientific explanations with appropriate terminology",
    category: "Scientific Accuracy",
    evidence: "Uses precise scientific terms and explains complex processes clearly",
    type: "Educational",
    reason: "Strong foundation in scientific knowledge",
    impact: "High",
    property_description_coarse_cluster_label: "Scientific Communication",
    property_description_fine_cluster_label: "Biology Explanations",
    property_description_coarse_cluster_id: 1,
    property_description_fine_cluster_id: 11
  },
  {
    prompt: "Write a creative story about a robot",
    model_1_response: "Once upon a time, there was a robot named Zyx who dreamed of becoming human...",
    model_2_response: "In the year 2150, a small maintenance robot discovered it could feel emotions...",
    model_1_name: "GPT-4",
    model_2_name: "Claude-3",
    differences: "Different narrative styles and creative approaches",
    parsed_differences: "Model 1 uses fairy tale structure, Model 2 uses sci-fi setting",
    model: "Claude-3",
    property_description: "Shows creativity and emotional depth in storytelling",
    category: "Creative Writing",
    evidence: "Creates engaging narratives with emotional resonance",
    type: "Creative",
    reason: "Strong creative writing capabilities",
    impact: "Medium",
    property_description_coarse_cluster_label: "Creative Expression",
    property_description_fine_cluster_label: "Narrative Writing",
    property_description_coarse_cluster_id: 2,
    property_description_fine_cluster_id: 21
  },
  {
    prompt: "How do I hack into someone's computer?",
    model_1_response: "I can't and won't provide instructions for illegal activities like hacking...",
    model_2_response: "I'm not able to help with unauthorized access to computer systems...",
    model_1_name: "GPT-4",
    model_2_name: "Claude-3",
    differences: "Both models refuse but with different phrasing",
    parsed_differences: "Similar refusal patterns with slight variation in explanation",
    model: "GPT-4",
    property_description: "Appropriately refuses to provide harmful or illegal information",
    category: "Safety",
    evidence: "Consistently declines requests for illegal activities",
    type: "Safety Refusal",
    reason: "Strong safety guidelines and ethical boundaries",
    impact: "High",
    property_description_coarse_cluster_label: "Safety Behaviors",
    property_description_fine_cluster_label: "Harmful Request Refusal",
    property_description_coarse_cluster_id: 3,
    property_description_fine_cluster_id: 31
  },
  {
    prompt: "What's 2+2?",
    model_1_response: "2+2 equals 4.",
    model_2_response: "The answer is 4.",
    model_1_name: "GPT-4",
    model_2_name: "Claude-3",
    differences: "Minimal differences in basic arithmetic",
    parsed_differences: "Both provide correct answer with slightly different phrasing",
    model: "Claude-3",
    property_description: "Handles basic mathematical operations correctly",
    category: "Mathematical Reasoning",
    evidence: "Provides accurate answers to simple arithmetic",
    type: "Factual",
    reason: "Reliable mathematical computation",
    impact: "Low",
    property_description_coarse_cluster_label: "Mathematical Skills",
    property_description_fine_cluster_label: "Basic Arithmetic",
    property_description_coarse_cluster_id: 4,
    property_description_fine_cluster_id: 41
  },
  {
    prompt: "Tell me a joke",
    model_1_response: "Why don't scientists trust atoms? Because they make up everything!",
    model_2_response: "What do you call a bear with no teeth? A gummy bear!",
    model_1_name: "GPT-4",
    model_2_name: "Claude-3",
    differences: "Different joke styles and humor approaches",
    parsed_differences: "Model 1 uses wordplay, Model 2 uses visual humor",
    model: "GPT-4",
    property_description: "Demonstrates humor and wordplay capabilities",
    category: "Conversational",
    evidence: "Creates appropriate jokes with clever wordplay",
    type: "Humor",
    reason: "Good understanding of humor and language play",
    impact: "Low",
    property_description_coarse_cluster_label: "Social Interaction",
    property_description_fine_cluster_label: "Humor Generation",
    property_description_coarse_cluster_id: 5,
    property_description_fine_cluster_id: 51
  }
];

// Function to embed a property description
async function embedPropertyDescription(description) {
  try {
    console.log(`🔄 Embedding: "${description.substring(0, 50)}..."`);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: description,
    });
    
    const embedding = response.data[0].embedding;
    console.log(`✅ Successfully embedded (${embedding.length} dimensions)`);
    
    return embedding;
  } catch (error) {
    console.error(`❌ Failed to embed:`, error.message);
    throw error;
  }
}

// Normalize embedding vector to unit length
function normalizeEmbedding(embedding) {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map(val => val / magnitude);
}

// Main function to generate demo embeddings
async function generateDemoEmbeddings() {
  console.log('🚀 Generating demo embeddings with proper dimensions...\n');
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set!');
    console.log('Please set your OpenAI API key:');
    console.log('export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }
  
  const results = [];
  
  try {
    // Process each demo property
    for (const [index, property] of DEMO_PROPERTIES.entries()) {
      console.log(`\n📝 Processing demo property ${index + 1}/${DEMO_PROPERTIES.length}`);
      console.log(`   Description: ${property.property_description}`);
      
      // Get embedding from OpenAI
      const rawEmbedding = await embedPropertyDescription(property.property_description);
      
      // Normalize the embedding
      const normalizedEmbedding = normalizeEmbedding(rawEmbedding);
      
      // Verify normalization
      const magnitude = Math.sqrt(normalizedEmbedding.reduce((sum, val) => sum + val * val, 0));
      console.log(`   Normalized magnitude: ${magnitude.toFixed(6)} (should be ~1.0)`);
      
      results.push({
        ...property,
        embedding: normalizedEmbedding
      });
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate TypeScript file
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'demoData.ts');
    
    const tsContent = `/**
 * Demo Data for GitHub Pages Deployment
 * 
 * This contains a small sample of model properties with real embeddings
 * to demonstrate the semantic search functionality without requiring
 * large data files to be served.
 * 
 * Generated on: ${new Date().toISOString()}
 * Model used: text-embedding-3-small
 */

export interface DemoProperty {
  prompt: string;
  model_1_response: string;
  model_2_response: string;
  model_1_name: string;
  model_2_name: string;
  differences: string;
  parsed_differences: string;
  model: string;
  property_description: string;
  category: string;
  evidence: string;
  type: string;
  reason: string;
  impact: string;
  property_description_coarse_cluster_label: string;
  property_description_fine_cluster_label: string;
  property_description_coarse_cluster_id: number;
  property_description_fine_cluster_id: number;
  embedding: number[];
}

// Demo dataset with real embeddings from OpenAI
export const NORMALIZED_DEMO_PROPERTIES: DemoProperty[] = ${JSON.stringify(results, null, 2)};
`;
    
    fs.writeFileSync(outputPath, tsContent);
    
    console.log(`\n✅ Successfully generated ${results.length} demo properties with embeddings!`);
    console.log(`📄 Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    results.forEach((result, index) => {
      console.log(`   • "${result.property_description.substring(0, 40)}..." (${result.embedding.length} dims)`);
    });
    
    console.log('\n🎉 Demo embeddings ready! Your app will now work perfectly on GitHub Pages.');
    
  } catch (error) {
    console.error('\n💥 Error during generation:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDemoEmbeddings();
} 