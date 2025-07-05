export interface PropertyData {
  prompt: string;
  model_1_response: string;
  model_2_response: string;
  model_1_name: string;
  model_2_name: string;
  differences: string;
  parsed_differences?: string;
  parse_error?: string;
  model: string;
  property_description: string;
  category: string;
  evidence?: string;
  type: string;
  reason: string;
  impact: string;
  unexpected_behavior?: string;
  property_description_coarse_cluster_label: string;
  property_description_fine_cluster_label: string;
  property_description_coarse_cluster_id?: number;
  property_description_fine_cluster_id?: number;
  row_id?: number;
}

// Extended interface for SemanticSearch that includes embedding
export interface PropertyDataWithEmbedding extends PropertyData {
  embedding?: number[];
  similarity_score?: number;
} 