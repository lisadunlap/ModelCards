import React, { useMemo, useState, useCallback } from 'react';
import { Search, BarChart3, Eye, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { getModelColor } from './config/modelColors';

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
  const [searchResults, setSearchResults] = useState<ClusterMatch[]>([]);
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

    // Group data by fine cluster
    const clusterGroups: Record<string, PropertyData[]> = {};
    data.forEach(item => {
      const cluster = item.property_description_fine_cluster_label;
      if (!cluster || cluster === 'Unknown' || cluster === '') return;
      
      if (!clusterGroups[cluster]) {
        clusterGroups[cluster] = [];
      }
      clusterGroups[cluster].push(item);
    });

    // Calculate relevance scores for each cluster
    const clusterMatches: ClusterMatch[] = [];
    
    Object.entries(clusterGroups).forEach(([clusterName, items]) => {
      // Skip clusters with insufficient samples
      if (items.length < minSampleThreshold) return;

      // Calculate relevance score based on cluster name and property descriptions
      let relevanceScore = 0;
      const clusterText = clusterName.toLowerCase();
      
      // Score based on cluster name matches
      queryTerms.forEach(term => {
        if (clusterText.includes(term)) {
          relevanceScore += 10; // High score for cluster name matches
        }
      });

      // Score based on property description matches
      const propertyDescriptions = items.map(item => item.property_description.toLowerCase()).join(' ');
      queryTerms.forEach(term => {
        const matches = (propertyDescriptions.match(new RegExp(term, 'g')) || []).length;
        relevanceScore += matches * 0.5; // Lower score for description matches
      });

      // Only include clusters with some relevance
      if (relevanceScore > 0) {
        // Count models in this cluster
        const modelCounts: Record<string, number> = {};
        items.forEach(item => {
          if (item.model && item.model !== 'Unknown') {
            modelCounts[item.model] = (modelCounts[item.model] || 0) + 1;
          }
        });

        // Get representative cluster description from first item
        const clusterDescription = items[0]?.property_description || clusterName;

        clusterMatches.push({
          clusterName,
          clusterDescription,
          totalItems: items.length,
          modelCounts,
          matchingItems: items,
          relevanceScore
        });
      }
    });

    // Sort by relevance score and take top 10
    const topMatches = clusterMatches
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);

    setSearchResults(topMatches);
  }, [data, searchQuery, minSampleThreshold]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // Get all unique models
  const allModels = useMemo(() => {
    return Array.from(new Set(data.map(item => item.model).filter(model => model && model !== 'Unknown')));
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Keyword Search</h2>
        <p className="text-gray-600 mt-1">
          Search for property clusters by keywords and see model distribution
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
                  Min samples:
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
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Top 10 Matching Clusters
            </h3>
            <div className="text-sm text-gray-600">
              Showing {searchResults.length} clusters for "{searchQuery}"
            </div>
          </div>

          {searchResults.map((cluster, index) => {
            const isExpanded = expandedCards.has(cluster.clusterName);
            
            // Calculate model distribution
            const modelDistribution: ModelDistribution[] = Object.entries(cluster.modelCounts)
              .map(([modelName, count]) => ({
                modelName,
                count,
                percentage: (count / cluster.totalItems) * 100,
                colors: getModelColor(modelName)
              }))
              .sort((a, b) => b.count - a.count);

            const topModels = modelDistribution.slice(0, 3);
            const remainingCount = modelDistribution.length - 3;

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
                          {cluster.totalItems} samples
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
                        {cluster.clusterDescription.length > 120 
                          ? cluster.clusterDescription.substring(0, 120) + '...' 
                          : cluster.clusterDescription}
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
                          {cluster.clusterDescription}
                        </p>
                      </div>
                    </div>

                    {/* All models distribution */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-3">
                        Model Distribution ({modelDistribution.length} models)
                      </h5>
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
                                  width: `${Math.min(modelDist.percentage, 100)}%`,
                                  backgroundColor: modelDist.colors.chartColor
                                }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-600 w-16 text-right">
                              {modelDist.count} ({modelDist.percentage.toFixed(1)}%)
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
      {searchQuery && searchResults.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No matching clusters found</p>
            <p className="text-sm mt-1">
              Try different keywords or lower the minimum sample threshold.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searchQuery && (
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