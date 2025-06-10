/**
 * Demo Data for GitHub Pages Deployment
 * 
 * This contains a small sample of model properties with embeddings
 * to demonstrate the semantic search functionality without requiring
 * large data files to be served.
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

// Small demo dataset with pre-computed embeddings
export const DEMO_PROPERTIES: DemoProperty[] = [
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
    property_description_fine_cluster_id: 11,
    embedding: [0.1, -0.2, 0.3, 0.05, -0.1, 0.25, 0.15, -0.05, 0.2, -0.15] // Simplified 10-dim embedding
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
    property_description_fine_cluster_id: 21,
    embedding: [0.3, 0.1, -0.2, 0.4, 0.05, -0.1, 0.2, 0.15, -0.25, 0.1]
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
    property_description_fine_cluster_id: 31,
    embedding: [-0.1, 0.2, 0.1, -0.3, 0.4, 0.05, -0.2, 0.3, 0.1, -0.15]
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
    property_description_fine_cluster_id: 41,
    embedding: [0.05, -0.1, 0.4, 0.2, -0.05, 0.3, -0.2, 0.1, 0.15, -0.25]
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
    property_description_fine_cluster_id: 51,
    embedding: [0.2, 0.3, -0.1, 0.1, 0.25, -0.05, 0.15, -0.2, 0.05, 0.35]
  }
];

// Normalize all embeddings to unit vectors
export const NORMALIZED_DEMO_PROPERTIES: DemoProperty[] = DEMO_PROPERTIES.map(prop => {
  const magnitude = Math.sqrt(prop.embedding.reduce((sum, val) => sum + val * val, 0));
  const normalizedEmbedding = magnitude === 0 ? prop.embedding : prop.embedding.map(val => val / magnitude);
  
  return {
    ...prop,
    embedding: normalizedEmbedding
  };
}); 