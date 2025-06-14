import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Users, TrendingUp, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
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

interface ModelSummariesProps {
  data: PropertyData[];
}

interface ClusterSummary {
  clusterName: string;
  totalItems: number;
  modelItems: number;
  proportion: number;
  percentage: number;
}

interface ModelSummary {
  modelName: string;
  totalItems: number;
  topClusters: ClusterSummary[];
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

const ModelSummaries: React.FC<ModelSummariesProps> = ({ data }) => {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isParametersAccordionOpen, setIsParametersAccordionOpen] = useState(false);
  const [minItemsThreshold, setMinItemsThreshold] = useState(20);

  // Get all unique models from both regular model field and battle participants
  const allModelNames = useMemo(() => {
    const models = new Set<string>();
    
    data.forEach(item => {
      if (item.model && item.model !== 'Unknown' && item.model.trim().length >= 2) {
        models.add(item.model);
      }
      if (item.model_1_name && item.model_1_name !== 'Unknown' && item.model_1_name.trim().length >= 2) {
        models.add(item.model_1_name);
      }
      if (item.model_2_name && item.model_2_name !== 'Unknown' && item.model_2_name.trim().length >= 2) {
        models.add(item.model_2_name);
      }
    });
    
    return Array.from(models).sort();
  }, [data]);

  // Initialize selected models to all models by default
  useEffect(() => {
    if (allModelNames.length > 0 && selectedModels.length === 0) {
      setSelectedModels(allModelNames);
    }
  }, [allModelNames, selectedModels.length]);

  // Handle model selection toggle
  const handleModelToggle = useCallback((model: string) => {
    setSelectedModels(prev => {
      if (prev.includes(model)) {
        return prev.filter(m => m !== model);
      } else {
        return [...prev, model];
      }
    });
  }, []);

  // Handle select all / deselect all
  const handleSelectAll = useCallback(() => {
    setSelectedModels(allModelNames);
  }, [allModelNames]);

  const handleDeselectAll = useCallback(() => {
    setSelectedModels([]);
  }, []);

  const modelSummaries = useMemo(() => {
    // Filter data to only include battles where both participants are selected
    let filteredData = data;
    if (selectedModels.length > 0 && selectedModels.length < allModelNames.length) {
      filteredData = data.filter(item => 
        selectedModels.includes(item.model_1_name) && selectedModels.includes(item.model_2_name)
      );
    }

    // Get unique models from filtered data
    const uniqueModels = Array.from(new Set(filteredData.map(item => item.model)))
      .filter(model => {
        // Filter out invalid model names
        if (!model || typeof model !== 'string') return false;
        
        // Remove obviously invalid model names
        const invalidNames = ['numm count', 'null', 'undefined', '', 'NaN'];
        if (invalidNames.includes(model.toLowerCase().trim())) {
          return false;
        }
        
        // Remove very short names that are likely errors
        if (model.trim().length < 2) {
          return false;
        }
        
        // Only include models that are in the selected list
        return selectedModels.includes(model);
      });

    // For each model, calculate top clusters using filtered data
    const summaries: ModelSummary[] = uniqueModels.map(modelName => {
      const modelData = filteredData.filter(item => item.model === modelName);
      
      // Group by fine cluster
      const clusterCounts: Record<string, { modelItems: number; totalItems: number }> = {};
      
      // First pass: count model items in each cluster
      modelData.forEach(item => {
        const cluster = item.property_description_fine_cluster_label;
        if (!cluster || cluster === 'Unknown' || cluster === '') return;
        
        if (!clusterCounts[cluster]) {
          clusterCounts[cluster] = { modelItems: 0, totalItems: 0 };
        }
        clusterCounts[cluster].modelItems += 1;
      });
      
      // Second pass: count total items in each cluster (across all models in filtered data)
      filteredData.forEach(item => {
        const cluster = item.property_description_fine_cluster_label;
        if (!cluster || cluster === 'Unknown' || cluster === '') return;
        
        if (clusterCounts[cluster]) {
          clusterCounts[cluster].totalItems += 1;
        }
      });
      
      // Calculate proportions, filter by minimum items threshold, and get top 10
      const clusterSummaries: ClusterSummary[] = Object.entries(clusterCounts)
        .filter(([_, counts]) => counts.totalItems >= minItemsThreshold)
        .map(([clusterName, counts]) => ({
          clusterName,
          totalItems: counts.totalItems,
          modelItems: counts.modelItems,
          proportion: counts.totalItems > 0 ? counts.modelItems / counts.totalItems : 0,
          percentage: counts.totalItems > 0 ? (counts.modelItems / counts.totalItems) * 100 : 0
        }))
        .sort((a, b) => b.proportion - a.proportion)
        .slice(0, 10);
      
      return {
        modelName,
        totalItems: modelData.length,
        topClusters: clusterSummaries,
        colors: getModelColor(modelName)
      };
    });

    return summaries.sort((a, b) => b.totalItems - a.totalItems);
  }, [data, selectedModels, allModelNames.length, minItemsThreshold]);

  if (modelSummaries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Model Data Available</h3>
          <p className="text-sm">
            {selectedModels.length === 0 
              ? "No models selected. Please select at least one model above." 
              : "No valid model data found for the selected models."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Summaries</h2>
          <p className="text-gray-600 mt-1">
            Top 10 fine-grained clusters by proportion for each model
          </p>
        </div>
        <div className="text-sm text-gray-600">
          {modelSummaries.length} models analyzed
          {selectedModels.length < allModelNames.length && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {selectedModels.length} / {allModelNames.length} models selected
            </span>
          )}
        </div>
      </div>

      {/* Compact Controls Row */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between space-x-6">
          {/* Model Selection */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {isAccordionOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">Models</span>
              <span className="text-xs bg-white px-2 py-0.5 rounded-full border">
                {selectedModels.length}/{allModelNames.length}
              </span>
            </button>
          </div>

          {/* Parameters */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsParametersAccordionOpen(!isParametersAccordionOpen)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {isParametersAccordionOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">Filters</span>
              <span className="text-xs bg-white px-2 py-0.5 rounded-full border">
                {minItemsThreshold}+ items
              </span>
            </button>
          </div>
        </div>

        {/* Model Selection Content */}
        {isAccordionOpen && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600">
                Select models to include in analysis
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {allModelNames.map(model => (
                <label key={model} className="flex items-center space-x-1.5 p-1.5 rounded hover:bg-white cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model)}
                    onChange={() => handleModelToggle(model)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 scale-75"
                  />
                  <span 
                    className="font-medium truncate flex-1" 
                    style={{ color: getStyleFromTailwind(getModelColor(model).badgeColor, getModelColor(model).textColor).color }}
                    title={model}
                  >
                    {model}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Parameters Content */}
        {isParametersAccordionOpen && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 mb-1">Minimum Cluster Size</div>
                <div className="text-xs text-gray-600">
                  Show clusters with at least {minItemsThreshold} items
                </div>
              </div>
              <div className="w-48">
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={minItemsThreshold}
                  onChange={(e) => setMinItemsThreshold(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5</span>
                  <span>100+</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {modelSummaries.map((summary, index) => (
          <div key={summary.modelName} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <div 
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-base font-semibold mb-1"
                    style={getStyleFromTailwind(summary.colors.badgeColor, summary.colors.textColor)}
                  >
                    {summary.modelName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {summary.totalItems.toLocaleString()} properties
                  </div>
                </div>
              </div>
              
              <div className="flex items-center text-sm text-gray-500">
                <TrendingUp className="h-4 w-4 mr-2 text-gray-400" />
                <span>Top clusters by proportion</span>
              </div>
            </div>

            {/* Cluster List */}
            <div className="p-6">
              {summary.topClusters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">No valid clusters found</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.topClusters.map((cluster, clusterIndex) => (
                    <div key={cluster.clusterName} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                      <div className="mb-1.5">
                        <h4 className="text-sm font-medium text-gray-900 leading-relaxed mb-2">
                          {cluster.clusterName}
                        </h4>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ 
                              width: `${Math.min(cluster.percentage, 100)}%`,
                              backgroundColor: summary.colors.chartColor
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{cluster.modelItems}/{cluster.totalItems} items ({(cluster.proportion * 100).toFixed(1)}%)</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-white text-gray-600 border border-gray-200">
                          #{clusterIndex + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelSummaries; 