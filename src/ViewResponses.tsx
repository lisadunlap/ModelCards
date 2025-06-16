import React, { useState, useCallback, useMemo } from 'react';
import { Search, Shuffle, MessageSquare, Users, Zap, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { getModelColor } from './config/modelColors';
import ContentRenderer from './components/ContentRenderer';

interface PropertyData {
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

interface ViewResponsesProps {
  data: PropertyData[];
  onViewResponse?: (item: PropertyData) => void;
}

// Helper function to calculate prompt similarity
const calculatePromptSimilarity = (searchPrompt: string, targetPrompt: string): number => {
  const search = searchPrompt.toLowerCase().trim();
  const target = targetPrompt.toLowerCase().trim();
  
  if (search === target) return 100;
  if (target.includes(search)) return 80;
  if (search.includes(target)) return 70;
  
  // Word-based similarity
  const searchWords = search.split(/\s+/).filter(word => word.length > 2);
  const targetWords = target.split(/\s+/).filter(word => word.length > 2);
  
  if (searchWords.length === 0 || targetWords.length === 0) return 0;
  
  const matches = searchWords.filter(word => 
    targetWords.some(targetWord => 
      targetWord.includes(word) || word.includes(targetWord)
    )
  ).length;
  
  return (matches / Math.max(searchWords.length, targetWords.length)) * 60;
};

// Helper function to convert Tailwind classes to CSS values
const getStyleFromTailwind = (bgClass: string, textClass: string) => {
  const bgColorMap: Record<string, string> = {
    'bg-blue-100': '#dbeafe', 'bg-green-100': '#dcfce7', 'bg-purple-100': '#f3e8ff',
    'bg-orange-100': '#fed7aa', 'bg-pink-100': '#fce7f3', 'bg-indigo-100': '#e0e7ff',
    'bg-teal-100': '#ccfbf1', 'bg-cyan-100': '#cffafe', 'bg-emerald-100': '#d1fae5',
    'bg-amber-100': '#fef3c7', 'bg-lime-100': '#ecfccb', 'bg-rose-100': '#ffe4e6',
    'bg-violet-100': '#ede9fe', 'bg-sky-100': '#e0f2fe', 'bg-red-100': '#fee2e2',
    'bg-yellow-100': '#fef3c7', 'bg-fuchsia-100': '#fae8ff', 'bg-emerald-200': '#a7f3d0',
    'bg-blue-200': '#bfdbfe', 'bg-purple-200': '#ddd6fe', 'bg-neutral-100': '#f5f5f5',
    'bg-gray-100': '#f3f4f6'
  };
  
  const textColorMap: Record<string, string> = {
    'text-blue-800': '#1e40af', 'text-green-800': '#166534', 'text-purple-800': '#6b21a8',
    'text-orange-800': '#9a3412', 'text-pink-800': '#be185d', 'text-indigo-800': '#3730a3',
    'text-teal-800': '#115e59', 'text-cyan-800': '#155e75', 'text-emerald-800': '#065f46',
    'text-amber-800': '#92400e', 'text-lime-800': '#365314', 'text-rose-800': '#9f1239',
    'text-violet-800': '#5b21b6', 'text-sky-800': '#075985', 'text-red-800': '#991b1b',
    'text-yellow-800': '#854d0e', 'text-fuchsia-800': '#86198f', 'text-emerald-900': '#064e3b',
    'text-blue-900': '#1e3a8a', 'text-purple-900': '#581c87', 'text-neutral-800': '#404040',
    'text-gray-800': '#1f2937'
  };
  
  return {
    backgroundColor: bgColorMap[bgClass] || '#f3f4f6',
    color: textColorMap[textClass] || '#1f2937'
  };
};

const ViewResponses: React.FC<ViewResponsesProps> = ({ data, onViewResponse }) => {
  const [searchPrompt, setSearchPrompt] = useState('');
  const [searchResults, setSearchResults] = useState<PropertyData[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [searchMode, setSearchMode] = useState<'search' | 'random' | null>(null);

  // Filter data to only include items with valid responses
  const validBattles = useMemo(() => {
    const filtered = data.filter(item => 
      item.prompt && 
      item.model_1_response && 
      item.model_2_response && 
      item.model_1_name && 
      item.model_2_name &&
      item.prompt.trim().length > 10 // Ensure meaningful prompts
    );
    
    // Shuffle the valid battles to randomize order
    return [...filtered].sort(() => Math.random() - 0.5);
  }, [data]);

  // Find best matching prompts (top 10)
  const findBestMatches = useCallback(() => {
    if (!searchPrompt.trim()) {
      setSearchResults([]);
      return;
    }

    const similarities = validBattles.map(item => ({
      item,
      similarity: calculatePromptSimilarity(searchPrompt, item.prompt)
    }));

    // Sort by similarity and get matches above threshold
    const sortedMatches = similarities
      .filter(match => match.similarity > 10) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity);

    // Deduplicate by prompt + model pair (considering both orderings)
    const seen = new Set<string>();
    const dedupedMatches = sortedMatches.filter(match => {
      const { model_1_name, model_2_name, prompt } = match.item;
      // Create a consistent key regardless of model order
      const modelPair = [model_1_name, model_2_name].sort().join('|');
      const key = `${prompt.trim()}|${modelPair}`;
      
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Take top 10 after deduplication
    const finalResults = dedupedMatches
      .slice(0, 10)
      .map(match => match.item);

    setSearchResults(finalResults);
    setSearchMode('search');
    setExpandedItems(new Set()); // Reset expanded items
  }, [searchPrompt, validBattles]);

  // Random battle selection (top 10 random)
  const selectRandomBattles = useCallback(() => {
    if (validBattles.length === 0) {
      setSearchResults([]);
      return;
    }
    
    // Shuffle the battles
    const shuffled = [...validBattles].sort(() => Math.random() - 0.5);
    
    // Deduplicate by prompt + model pair
    const seen = new Set<string>();
    const dedupedBattles = shuffled.filter(battle => {
      const { model_1_name, model_2_name, prompt } = battle;
      // Create a consistent key regardless of model order
      const modelPair = [model_1_name, model_2_name].sort().join('|');
      const key = `${prompt.trim()}|${modelPair}`;
      
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    // Take top 10 after deduplication
    setSearchResults(dedupedBattles.slice(0, 10));
    setSearchMode('random');
    setExpandedItems(new Set()); // Reset expanded items
  }, [validBattles]);

  // Toggle accordion expansion
  const toggleExpanded = useCallback((index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    findBestMatches();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">View Responses</h2>
        <p className="text-gray-600 mt-1">
          Find and compare model responses by searching for similar prompts or exploring randomly
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-start gap-4">
          {/* Prompt Search */}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
              <Search className="h-4 w-4 mr-2 text-blue-600" />
              Search by Prompt
            </h3>
            <textarea
              id="prompt-search"
              rows={3}
              placeholder="e.g., 'Write a creative story about a robot', 'Explain quantum physics'"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
            />
          </div>

          {/* Search Button */}
          <div className="mt-8">
            <button
              onClick={findBestMatches}
              disabled={!searchPrompt.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm h-[76px]"
            >
              <Search className="h-4 w-4 mr-2" />
              Find Similar
            </button>
          </div>

          {/* Random Selection */}
          <div className="mt-8">
            <button
              onClick={selectRandomBattles}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center text-sm h-[76px]"
            >
              <Zap className="h-4 w-4 mr-2" />
              Surprise Me!
            </button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {searchMode === 'search' ? 'Search Results' : 'Random Conversations'} ({searchResults.length})
            </h3>
          </div>
          
          {searchResults.map((battle, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border">
              {/* Accordion Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={getStyleFromTailwind(
                            getModelColor(battle.model_1_name).badgeColor, 
                            getModelColor(battle.model_1_name).textColor
                          )}
                        >
                          {battle.model_1_name}
                        </div>
                        <span className="text-gray-400">vs</span>
                        <div 
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={getStyleFromTailwind(
                            getModelColor(battle.model_2_name).badgeColor, 
                            getModelColor(battle.model_2_name).textColor
                          )}
                        >
                          {battle.model_2_name}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {battle.prompt}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    {onViewResponse && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewResponse(battle);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {expandedItems.has(index) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Accordion Content */}
              {expandedItems.has(index) && (
                <div className="border-t border-gray-200">
                  {/* Prompt */}
                  <div className="p-4 border-b border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Prompt</h4>
                    <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                      <ContentRenderer content={battle.prompt} className="!bg-transparent !p-0" />
                    </div>
                  </div>

                  {/* Model Responses */}
                  <div className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Model 1 Response */}
                      <div>
                        <div className="flex items-center mb-2">
                          <div 
                            className="inline-flex items-center px-2 py-1 rounded text-sm font-medium mr-2"
                            style={getStyleFromTailwind(
                              getModelColor(battle.model_1_name).badgeColor, 
                              getModelColor(battle.model_1_name).textColor
                            )}
                          >
                            {battle.model_1_name}
                          </div>
                          <span className="text-xs text-gray-500">Response</span>
                        </div>
                        <div 
                          className="rounded-lg p-3 border-l-4 bg-white border"
                          style={{
                            borderLeftColor: getModelColor(battle.model_1_name).chartColor
                          }}
                        >
                          <ContentRenderer content={battle.model_1_response} className="!bg-transparent !p-0" />
                        </div>
                      </div>

                      {/* Model 2 Response */}
                      <div>
                        <div className="flex items-center mb-2">
                          <div 
                            className="inline-flex items-center px-2 py-1 rounded text-sm font-medium mr-2"
                            style={getStyleFromTailwind(
                              getModelColor(battle.model_2_name).badgeColor, 
                              getModelColor(battle.model_2_name).textColor
                            )}
                          >
                            {battle.model_2_name}
                          </div>
                          <span className="text-xs text-gray-500">Response</span>
                        </div>
                        <div 
                          className="rounded-lg p-3 border-l-4 bg-white border"
                          style={{
                            borderLeftColor: getModelColor(battle.model_2_name).chartColor
                          }}
                        >
                          <ContentRenderer content={battle.model_2_response} className="!bg-transparent !p-0" />
                        </div>
                      </div>
                    </div>

                    {/* Analysis Section */}
                    {battle.differences && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h5 className="text-sm font-medium text-gray-900 mb-2">Key Differences</h5>
                        <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                          <ContentRenderer content={battle.differences} className="!bg-transparent !p-0" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewResponses; 