import React, { useMemo, useState, useCallback } from 'react';
import { Search, BarChart3, Eye, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { getModelColor } from './config/modelColors';
import InfoTooltip from './components/InfoTooltip';

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
  evidence?: string;
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

interface KeywordSearchProps {
  data: PropertyData[];
  onViewResponse?: (item: PropertyData) => void;
}

interface ClusterMatch {
  clusterName: string;
  clusterDescription: string;
  totalItems: number;
  modelCounts: Record<string, number>;
  matchingItems: PropertyData[];
  relevanceScore: number;
}

interface ModelDistribution {
  modelName: string;
  count: number;
  percentage: number;
  colors: {
    badgeColor: string;
    textColor: string;
    chartColor: string;
  };
}

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

const KeywordSearch: React.FC<KeywordSearchProps> = ({ data, onViewResponse }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minSampleThreshold, setMinSampleThreshold] = useState(30);
  const [searchResults, setSearchResults] = useState<ClusterMatch[] | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Toggle card expansion
  const toggleCardExpansion = (clusterName: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clusterName)) {
        newSet.delete(clusterName);
      } else {
        newSet.add(clusterName);
      }
      return newSet;
    });
  };

  // Perform keyword search
  const performSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const queryTerms = query.split(/\s+/).filter(term => term.length > 2);

    // NEW APPROACH: Calculate battle-based proportions
    
    // Step 1: Deduplicate by (prompt, differences) to get unique conversations
    const conversationMap = new Map<string, PropertyData>();
    data.forEach(item => {
      const conversationKey = `${item.prompt}|||${item.differences}`;
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, item);
      }
    });
    const uniqueConversations = Array.from(conversationMap.values());

    // Step 2: For each model, calculate total battles participated in
    const modelBattleCounts = new Map<string, number>();
    uniqueConversations.forEach(conversation => {
      // Each conversation involves exactly 2 models
      if (conversation.model_1_name && conversation.model_1_name !== 'Unknown') {
        modelBattleCounts.set(
          conversation.model_1_name, 
          (modelBattleCounts.get(conversation.model_1_name) || 0) + 1
        );
      }
      if (conversation.model_2_name && conversation.model_2_name !== 'Unknown') {
        modelBattleCounts.set(
          conversation.model_2_name, 
          (modelBattleCounts.get(conversation.model_2_name) || 0) + 1
        );
      }
    });

    // Step 3: Group conversations by fine cluster and calculate battle-based metrics
    const clusterBattles = new Map<string, Map<string, Set<string>>>();
    
    uniqueConversations.forEach(conversation => {
      const clusterName = conversation.property_description_fine_cluster_label;
      if (!clusterName || clusterName === 'Unknown') return;
      
      if (!clusterBattles.has(clusterName)) {
        clusterBattles.set(clusterName, new Map());
      }
      
      const clusterMap = clusterBattles.get(clusterName)!;
      const conversationKey = `${conversation.prompt}|||${conversation.differences}`;
      
      // CRITICAL FIX: Only count the model that actually exhibited the property
      // The 'model' field tells us which model showed this behavior
      const modelWithProperty = conversation.model;
      if (modelWithProperty && modelWithProperty !== 'Unknown') {
        if (!clusterMap.has(modelWithProperty)) {
          clusterMap.set(modelWithProperty, new Set());
        }
        clusterMap.get(modelWithProperty)!.add(conversationKey);
      }
    });

    // Step 4: Calculate relevance scores and create cluster matches
    const clusterMatches: ClusterMatch[] = [];
    
    clusterBattles.forEach((modelBattles, clusterName) => {
      // Calculate relevance score based on cluster name matching
      let relevanceScore = 0;
      
      const clusterWords = clusterName.toLowerCase().split(/\s+/);
      
      queryTerms.forEach(queryWord => {
        clusterWords.forEach(clusterWord => {
          if (clusterWord === queryWord) {
            relevanceScore += 10; // Strong match for exact word
          } else if (clusterWord.includes(queryWord) || queryWord.includes(clusterWord)) {
            relevanceScore += 5; // Weaker match for substrings
          }
        });
      });
      
      // Only include clusters with minimum samples and relevance
      const totalClusterBattles = new Set<string>();
      modelBattles.forEach(battleSet => {
        battleSet.forEach(battle => totalClusterBattles.add(battle));
      });
      
      if (totalClusterBattles.size >= minSampleThreshold && relevanceScore > 0) {
        // Calculate model propensities for this cluster
        const modelPropensities: Record<string, number> = {};
        const matchingItems: PropertyData[] = [];
        
        modelBattles.forEach((battleSet, modelName) => {
          const totalBattles = modelBattleCounts.get(modelName) || 0;
          const battlesWithProperty = battleSet.size;
          
          if (totalBattles > 0) {
            modelPropensities[modelName] = (battlesWithProperty / totalBattles) * 100;
          } else {
            modelPropensities[modelName] = 0;
          }
        });
        
        // Get a sample of matching items for display
        const sampleBattles = Array.from(totalClusterBattles).slice(0, 10);
        sampleBattles.forEach(battleKey => {
          const [prompt, differences] = battleKey.split('|||');
          const item = uniqueConversations.find(c => c.prompt === prompt && c.differences === differences);
          if (item) {
            matchingItems.push(item);
          }
        });
        
        clusterMatches.push({
          clusterName,
          clusterDescription: matchingItems[0]?.property_description || '',
          totalItems: totalClusterBattles.size,
          modelCounts: modelPropensities, // Now storing propensities instead of counts
          matchingItems: matchingItems.sort(() => Math.random() - 0.5), // Shuffle
          relevanceScore
        });
      }
    });

    // Sort by relevance score and shuffle clusters with same score
    const sortedResults = clusterMatches
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
    
    // Group by relevance score and shuffle within each group
    const groupedByScore: Record<number, ClusterMatch[]> = {};
    sortedResults.forEach(result => {
      if (!groupedByScore[result.relevanceScore]) {
        groupedByScore[result.relevanceScore] = [];
      }
      groupedByScore[result.relevanceScore].push(result);
    });
    
    // Shuffle within each score group and flatten
    const finalResults: ClusterMatch[] = [];
    Object.keys(groupedByScore)
      .sort((a, b) => Number(b) - Number(a)) // Sort by score descending
      .forEach(score => {
        const shuffledGroup = [...groupedByScore[Number(score)]].sort(() => Math.random() - 0.5);
        finalResults.push(...shuffledGroup);
      });

    setSearchResults(finalResults);
  }, [data, searchQuery, minSampleThreshold]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSearchResults(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // Get all unique models
  const allModels = useMemo(() => {
    return Array.from(new Set(data.map(item => item.model).filter(model => model && model !== 'Unknown')));
  }, [data]);

  const absoluteCountTooltip = "Shows the propensity (percentage of battles) where each model exhibited properties from this cluster. Higher percentages indicate the model is more likely to show this type of behavior. The bars are dynamically scaled for each cluster to best show relative differences.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Keyword Search</h2>
        <p className="text-gray-600 mt-1">
          Search for property clusters by keywords and see model propensities
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div>
            <label htmlFor="keyword-search" className="block text-sm font-medium text-gray-700 mb-2">
              Search for clusters by keyword
            </label>
            <div className="relative">
              <input
                id="keyword-search"
                type="text"
                placeholder="e.g., 'creative writing', 'safety', 'reasoning', 'bias'"
                className="w-full border border-gray-300 rounded-md px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="min-samples" className="text-sm text-gray-600">
                  Min battles:
                </label>
                <input
                  id="min-samples"
                  type="number"
                  min="5"
                  max="100"
                  value={minSampleThreshold}
                  onChange={(e) => setMinSampleThreshold(parseInt(e.target.value) || 10)}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
            
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Search Results - Compact Design */}
      {searchResults && searchResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Top 10 Matching Clusters
              </h3>
              <InfoTooltip content={absoluteCountTooltip} />
            </div>
            <div className="text-sm text-gray-600">
              Showing {searchResults.length} clusters for "{searchQuery}"
            </div>
          </div>

          {searchResults.map((cluster, index) => {
            const isExpanded = expandedCards.has(cluster.clusterName);
            
            // Calculate model distribution (now propensities)
            const modelDistribution: ModelDistribution[] = Object.entries(cluster.modelCounts)
              .map(([modelName, propensity]) => ({
                modelName,
                count: Math.round(propensity * 10) / 10, // Round to 1 decimal for display
                percentage: propensity, // This is already a propensity percentage
                colors: getModelColor(modelName)
              }))
              .sort((a, b) => b.percentage - a.percentage);

            const topModels = modelDistribution.slice(0, 3);
            const remainingCount = modelDistribution.length - 3;
            const maxPercentage = modelDistribution.reduce((max, item) => Math.max(max, item.percentage), 0);
            const chartMax = Math.max(1, Math.ceil(maxPercentage));

            return (
              <div key={cluster.clusterName} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                {/* Compact Header - Always Visible */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          Relevance: {cluster.relevanceScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {cluster.totalItems} battles
                        </span>
                        <span className="text-xs text-gray-500">
                          {Object.keys(cluster.modelCounts).length} models
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
                        {cluster.clusterName}
                      </h4>
                      
                      {/* Compact description preview */}
                      <p className="text-sm text-gray-600 mb-3">
                        {(cluster.clusterDescription || '').length > 120 
                          ? (cluster.clusterDescription || '').substring(0, 120) + '...' 
                          : cluster.clusterDescription || ''}
                      </p>

                      {/* Top 3 models - Horizontal layout */}
                      <div className="flex flex-wrap items-center gap-2">
                        {topModels.map((modelDist) => (
                          <div key={modelDist.modelName} className="flex items-center space-x-2">
                            <div 
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                              style={getStyleFromTailwind(modelDist.colors.badgeColor, modelDist.colors.textColor)}
                            >
                              {modelDist.modelName.length > 15 
                                ? modelDist.modelName.substring(0, 15) + '...' 
                                : modelDist.modelName}
                            </div>
                            <span className="text-xs text-gray-600">
                              {modelDist.percentage.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <span className="text-xs text-gray-500">
                            +{remainingCount} more
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Expand/Collapse Button */}
                    <div className="flex items-center space-x-2 ml-4">
                      {onViewResponse && (
                        <button
                          onClick={() => onViewResponse(cluster.matchingItems[0])}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View sample"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleCardExpansion(cluster.clusterName)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title={isExpanded ? "Show less" : "Show more"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {/* Full description */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Full Description</h5>
                      <div className="bg-white rounded p-3 border-l-4 border-blue-400">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {cluster.clusterDescription || ''}
                        </p>
                      </div>
                    </div>

                    {/* All models distribution */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-sm font-medium text-gray-900">
                            Model Distribution ({modelDistribution.length} models)
                          </h5>
                          <InfoTooltip content={absoluteCountTooltip} iconClassName="h-3 w-3" />
                        </div>
                        <div className="text-xs text-gray-500">
                          Scale: 0% – {chartMax.toFixed(0)}%
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {modelDistribution.map((modelDist) => (
                          <div key={modelDist.modelName} className="flex items-center space-x-3">
                            <div 
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium w-32 justify-center"
                              style={getStyleFromTailwind(modelDist.colors.badgeColor, modelDist.colors.textColor)}
                              title={modelDist.modelName}
                            >
                              <span className="truncate">
                                {modelDist.modelName.length > 12 
                                  ? modelDist.modelName.substring(0, 12) + '...' 
                                  : modelDist.modelName}
                              </span>
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${(modelDist.percentage / chartMax) * 100}%`,
                                  backgroundColor: modelDist.colors.chartColor
                                }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-600 w-16 text-right">
                              {modelDist.percentage.toFixed(1)}% propensity
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {searchResults !== null && searchResults.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No matching clusters found</p>
            <p className="text-sm mt-1">
              Try different keywords or lower the minimum battle threshold.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchResults === null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <div className="text-blue-600">
            <TrendingUp className="h-8 w-8 mx-auto mb-3" />
            <p className="text-lg font-medium">Ready to Search</p>
            <p className="text-sm mt-1">
              Enter keywords to find relevant property clusters and see how they're distributed across models.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeywordSearch; 