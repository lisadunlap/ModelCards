import React, { useMemo } from 'react';
import { Users, TrendingUp, BarChart3 } from 'lucide-react';
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
  const modelSummaries = useMemo(() => {
    // Get unique models
    const uniqueModels = Array.from(new Set(data.map(item => item.model)))
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
        
        return true;
      });

    // For each model, calculate top clusters
    const summaries: ModelSummary[] = uniqueModels.map(modelName => {
      const modelData = data.filter(item => item.model === modelName);
      
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
      
      // Second pass: count total items in each cluster (across all models)
      data.forEach(item => {
        const cluster = item.property_description_fine_cluster_label;
        if (!cluster || cluster === 'Unknown' || cluster === '') return;
        
        if (clusterCounts[cluster]) {
          clusterCounts[cluster].totalItems += 1;
        }
      });
      
      // Calculate proportions and get top 10
      const clusterSummaries: ClusterSummary[] = Object.entries(clusterCounts)
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
  }, [data]);

  if (modelSummaries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Model Data Available</h3>
          <p className="text-sm">No valid model data found in the dataset.</p>
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
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {modelSummaries.map((summary, index) => (
          <div key={summary.modelName} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                  style={getStyleFromTailwind(summary.colors.badgeColor, summary.colors.textColor)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {summary.modelName}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{summary.totalItems}</div>
                  <div className="text-xs text-gray-500">properties</div>
                </div>
              </div>
              
              <div className="flex items-center text-sm text-gray-600">
                <TrendingUp className="h-4 w-4 mr-2" />
                <span>Top clusters by proportion</span>
              </div>
            </div>

            {/* Cluster List */}
            <div className="p-6">
              {summary.topClusters.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <div className="text-sm">No valid clusters found</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.topClusters.map((cluster, clusterIndex) => (
                    <div key={cluster.clusterName} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-medium text-gray-900 leading-relaxed flex-1 pr-2">
                            {cluster.clusterName}
                          </h4>
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              #{clusterIndex + 1}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{cluster.modelItems} / {cluster.totalItems} items</span>
                          <span>Proportion: {cluster.proportion.toFixed(3)}</span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(cluster.percentage, 100)}%`,
                              backgroundColor: summary.colors.chartColor
                            }}
                          ></div>
                        </div>
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