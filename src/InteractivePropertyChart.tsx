import React, { useState, useMemo, useCallback } from 'react';
import { OpenAI } from 'openai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronRight, ArrowLeft, Eye, Home, ChevronLeft, ChevronDown, Filter, BarChart3, Grid, Users, TrendingUp } from 'lucide-react';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only use this for client-side applications
});

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
}

interface InteractivePropertyChartProps {
  data: PropertyData[];
  onViewResponse?: (item: PropertyData) => void;
}

type DrillLevel = 'coarse' | 'fine' | 'property';

interface DrillState {
  level: DrillLevel;
  coarseCluster?: string;
  fineCluster?: string;
  property?: string;
}

type ViewMode = 'all-models' | 'selected-models' | 'heatmap' | 'top-models';

// Generate distinct colors for multiple models
const generateModelColors = (modelCount: number): string[] => {
  const baseColors = [
    "#3b82f6", // blue
    "#f97316", // orange  
    "#10b981", // green
    "#f59e0b", // yellow
    "#8b5cf6", // purple
    "#ef4444", // red
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#f97316", // orange-alt
    "#6366f1", // indigo
    "#ec4899", // pink
    "#14b8a6", // teal
  ];
  
  if (modelCount <= baseColors.length) {
    return baseColors.slice(0, modelCount);
  }
  
  // Generate additional colors using HSL if we need more than base colors
  const colors = [...baseColors];
  const remaining = modelCount - baseColors.length;
  
  for (let i = 0; i < remaining; i++) {
    const hue = (i * 137.5) % 360; // Golden angle for good distribution
    const saturation = 70 + (i % 3) * 10; // Vary saturation slightly
    const lightness = 45 + (i % 4) * 5;   // Vary lightness slightly
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
};

// Helper function to convert hex/hsl to light background color
const getModelBadgeStyle = (color: string, index: number) => {
  // For HSL colors, extract and create light version
  if (color.startsWith('hsl')) {
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      const [, h, s] = hslMatch;
      return {
        backgroundColor: `hsl(${h}, ${Math.min(parseInt(s), 30)}%, 90%)`,
        color: `hsl(${h}, ${s}%, 25%)`
      };
    }
  }
  
  // Predefined light backgrounds for base colors
  const lightStyles = [
    { backgroundColor: '#dbeafe', color: '#1e40af' }, // blue
    { backgroundColor: '#fed7aa', color: '#c2410c' }, // orange
    { backgroundColor: '#d1fae5', color: '#065f46' }, // green
    { backgroundColor: '#fef3c7', color: '#92400e' }, // yellow
    { backgroundColor: '#e9d5ff', color: '#6b21a8' }, // purple
    { backgroundColor: '#fecaca', color: '#b91c1c' }, // red
    { backgroundColor: '#cffafe', color: '#155e75' }, // cyan
    { backgroundColor: '#ecfccb', color: '#365314' }, // lime
    { backgroundColor: '#fed7aa', color: '#c2410c' }, // orange-alt
    { backgroundColor: '#e0e7ff', color: '#3730a3' }, // indigo
    { backgroundColor: '#fce7f3', color: '#be185d' }, // pink
    { backgroundColor: '#ccfbf1', color: '#134e4a' }, // teal
  ];
  
  return lightStyles[index] || { backgroundColor: '#f3f4f6', color: '#374151' };
};

const InteractivePropertyChart: React.FC<InteractivePropertyChartProps> = ({ 
  data, 
  onViewResponse 
}) => {
  const [drillState, setDrillState] = useState<DrillState>({ level: 'coarse' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [tableSearch, setTableSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('top-models');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [topModelCount, setTopModelCount] = useState(5);
  const [showDiscrepancyOnly, setShowDiscrepancyOnly] = useState(false);
  const [discrepancyThreshold, setDiscrepancyThreshold] = useState(2);
  const [showUnexpectedOnly, setShowUnexpectedOnly] = useState(false);

  // Get unique model names from the data
  const modelNames = useMemo(() => {
    const uniqueModels = Array.from(new Set(data.map(item => item.model)))
      .filter(model => {
        // Filter out invalid model names
        if (!model || typeof model !== 'string') return false;
        
        // Remove obviously invalid model names
        const invalidNames = ['numm count', 'null', 'undefined', '', 'NaN'];
        if (invalidNames.includes(model.toLowerCase().trim())) {
          console.warn(`Filtering out invalid model name: "${model}"`);
          return false;
        }
        
        // Remove very short names that are likely errors
        if (model.trim().length < 2) {
          console.warn(`Filtering out too-short model name: "${model}"`);
          return false;
        }
        
        return true;
      });
    
    console.log(`Found ${uniqueModels.length} valid model names:`, uniqueModels);
    return uniqueModels.sort();
  }, [data]);

  // Get top models by frequency
  const topModels = useMemo(() => {
    const modelCounts = modelNames.map(model => ({
      model,
      count: data.filter(item => item.model === model).length
    }));
    return modelCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, topModelCount)
      .map(item => item.model);
  }, [data, modelNames, topModelCount]);

  // Get active models based on view mode
  const activeModels = useMemo(() => {
    switch (viewMode) {
      case 'all-models':
        return modelNames;
      case 'selected-models':
        return selectedModels.length > 0 ? selectedModels : modelNames;
      case 'top-models':
        return topModels;
      case 'heatmap':
        return modelNames;
      default:
        return topModels;
    }
  }, [viewMode, modelNames, selectedModels, topModels]);

  // Generate colors for active models only
  const modelColors = useMemo(() => generateModelColors(activeModels.length), [activeModels.length]);

  // Calculate chart data based on current drill level (memoized for performance)
  const chartData = useMemo(() => {
    let filteredData = data;

    // Apply filters based on drill state
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.property_description_coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.property_description_fine_cluster_label === drillState.fineCluster);
    }

    // Filter by unexpected behavior if enabled
    if (showUnexpectedOnly) {
      filteredData = filteredData.filter(item => 
        item.unexpected_behavior && 
        item.unexpected_behavior.toLowerCase() === 'true'
      );
    }

    // Filter by active models only (except for heatmap view)
    if (viewMode !== 'heatmap') {
      filteredData = filteredData.filter(item => activeModels.includes(item.model));
    }

    // Group data based on current level and split by model
    let groupedData: Record<string, Record<string, number> & { total: number }> = {};
    
    switch (drillState.level) {
      case 'coarse':
        filteredData.forEach(item => {
          const key = item.property_description_coarse_cluster_label;
          if (!groupedData[key]) {
            groupedData[key] = { total: 0 };
            activeModels.forEach(model => {
              groupedData[key][model] = 0;
            });
          }
          if (activeModels.includes(item.model)) {
            groupedData[key][item.model] = (groupedData[key][item.model] || 0) + 1;
            groupedData[key].total += 1;
          }
        });
        break;
      case 'fine':
        filteredData.forEach(item => {
          const key = item.property_description_fine_cluster_label;
          if (!groupedData[key]) {
            groupedData[key] = { total: 0 };
            activeModels.forEach(model => {
              groupedData[key][model] = 0;
            });
          }
          if (activeModels.includes(item.model)) {
            groupedData[key][item.model] = (groupedData[key][item.model] || 0) + 1;
            groupedData[key].total += 1;
          }
        });
        break;
      case 'property':
        filteredData.forEach(item => {
          const key = item.property_description;
          if (!groupedData[key]) {
            groupedData[key] = { total: 0 };
            activeModels.forEach(model => {
              groupedData[key][model] = 0;
            });
          }
          if (activeModels.includes(item.model)) {
            groupedData[key][item.model] = (groupedData[key][item.model] || 0) + 1;
            groupedData[key].total += 1;
          }
        });
        break;
    }

    // Convert to chart data format
    let chartEntries = Object.entries(groupedData)
      .map(([name, counts]) => {
        const result: any = { name, total_count: counts.total };
        
        activeModels.forEach(model => {
          result[`${model}_percentage`] = counts.total > 0 ? Math.round((counts[model] / counts.total) * 100) : 0;
          result[`${model}_count`] = counts[model] || 0;
        });
        
        return result;
      });

    // Store total before filtering for comparison
    const totalBeforeFilter = chartEntries.length;

    // Apply discrepancy filtering if enabled
    if (showDiscrepancyOnly && activeModels.length >= 2) {
      chartEntries = chartEntries.filter(entry => {
        // Get all model counts for this category
        const modelCounts = activeModels.map(model => entry[`${model}_count`] || 0);
        
        // Remove zero counts for ratio calculation
        const nonZeroCounts = modelCounts.filter(count => count > 0);
        
        // Need at least 2 models with data to calculate discrepancy
        if (nonZeroCounts.length < 2) {
          // Show entries where one model has significant data while others have none
          const maxCount = Math.max(...modelCounts);
          return maxCount >= 3; // At least 3 items in one model
        }
        
        // Calculate the ratio between highest and lowest counts
        const maxCount = Math.max(...nonZeroCounts);
        const minCount = Math.min(...nonZeroCounts);
        const ratio = maxCount / minCount;
        
        // Use the threshold from the slider
        const threshold = viewMode === 'all-models' ? 
          Math.max(discrepancyThreshold, 2) : // Minimum 2x for all-models to avoid too strict filtering
          discrepancyThreshold;
        
        return ratio >= threshold;
      });
      
      // Add debugging info to help track filter effectiveness
      console.log(`Discrepancy filter: ${totalBeforeFilter} -> ${chartEntries.length} categories (threshold: ${discrepancyThreshold})`);
    }

    return chartEntries.sort((a, b) => b.total_count - a.total_count);
  }, [data, drillState, activeModels, viewMode, showDiscrepancyOnly, discrepancyThreshold, showUnexpectedOnly]);

  // Generate heatmap data for heatmap view
  const heatmapData = useMemo(() => {
    if (viewMode !== 'heatmap') return [];
    
    let filteredData = data;
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.property_description_coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.property_description_fine_cluster_label === drillState.fineCluster);
    }

    // Filter by unexpected behavior if enabled
    if (showUnexpectedOnly) {
      filteredData = filteredData.filter(item => 
        item.unexpected_behavior && 
        item.unexpected_behavior.toLowerCase() === 'true'
      );
    }

    const heatmapGrid: { category: string; model: string; count: number; percentage: number }[] = [];
    
    // Get categories based on drill level
    const categories = Array.from(new Set(filteredData.map(item => {
      switch (drillState.level) {
        case 'coarse':
          return item.property_description_coarse_cluster_label;
        case 'fine':
          return item.property_description_fine_cluster_label;
        case 'property':
          return item.property_description;
        default:
          return item.property_description_coarse_cluster_label;
      }
    })));

    categories.forEach(category => {
      const categoryData = filteredData.filter(item => {
        switch (drillState.level) {
          case 'coarse':
            return item.property_description_coarse_cluster_label === category;
          case 'fine':
            return item.property_description_fine_cluster_label === category;
          case 'property':
            return item.property_description === category;
          default:
            return item.property_description_coarse_cluster_label === category;
        }
      });
      
      const totalInCategory = categoryData.length;
      
      modelNames.forEach(model => {
        const modelCount = categoryData.filter(item => item.model === model).length;
        const percentage = totalInCategory > 0 ? (modelCount / totalInCategory) * 100 : 0;
        
        heatmapGrid.push({
          category,
          model,
          count: modelCount,
          percentage
        });
      });
    });

    return heatmapGrid;
  }, [data, drillState, modelNames, viewMode, showUnexpectedOnly]);

  // Get filtered data for the table view (memoized and with search)
  const filteredTableData = useMemo(() => {
    let filteredData = data;
    
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.property_description_coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.property_description_fine_cluster_label === drillState.fineCluster);
    }
    if (drillState.property) {
      filteredData = filteredData.filter(item => item.property_description === drillState.property);
    }
    
    // Filter by unexpected behavior if enabled
    if (showUnexpectedOnly) {
      filteredData = filteredData.filter(item => 
        item.unexpected_behavior && 
        item.unexpected_behavior.toLowerCase() === 'true'
      );
    }
    
    // Filter by active models (except in heatmap mode where we want to see all)
    if (viewMode !== 'heatmap' && viewMode !== 'all-models') {
      filteredData = filteredData.filter(item => activeModels.includes(item.model));
    }
    
    // Apply search filter
    if (tableSearch.trim()) {
      const searchLower = tableSearch.toLowerCase();
      filteredData = filteredData.filter(item => 
        item.property_description.toLowerCase().includes(searchLower) ||
        item.model.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        item.type.toLowerCase().includes(searchLower)
      );
    }
    
    return filteredData;
  }, [data, drillState, tableSearch, viewMode, activeModels, showUnexpectedOnly]);

  // Paginated table data
  const paginatedTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTableData.slice(startIndex, endIndex);
  }, [filteredTableData, currentPage, itemsPerPage]);

  // Calculate pagination info
  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage);
  const totalItems = filteredTableData.length;

  // Reset page when drill state or search changes
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Handle drill state changes and reset pagination
  const handleBarClick = useCallback((data: any) => {
    const clickedName = data.name;
    
    switch (drillState.level) {
      case 'coarse':
        setDrillState({
          level: 'fine',
          coarseCluster: clickedName
        });
        break;
      case 'fine':
        setDrillState({
          ...drillState,
          level: 'property',
          fineCluster: clickedName
        });
        break;
      case 'property':
        setDrillState({
          ...drillState,
          property: clickedName
        });
        break;
    }
    resetPagination();
  }, [drillState, resetPagination]);

  const navigateUp = useCallback(() => {
    switch (drillState.level) {
      case 'fine':
        setDrillState({ level: 'coarse' });
        break;
      case 'property':
        if (drillState.property) {
          setDrillState({
            level: 'property',
            coarseCluster: drillState.coarseCluster,
            fineCluster: drillState.fineCluster
          });
        } else {
          setDrillState({
            level: 'fine',
            coarseCluster: drillState.coarseCluster
          });
        }
        break;
    }
    resetPagination();
  }, [drillState, resetPagination]);

  const navigateToRoot = useCallback(() => {
    setDrillState({ level: 'coarse' });
    resetPagination();
  }, [resetPagination]);

  // Handle search changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTableSearch(e.target.value);
    resetPagination();
  }, [resetPagination]);

  // Handle page changes
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(parseInt(e.target.value));
    resetPagination();
  }, [resetPagination]);

  const getLevelTitle = () => {
    switch (drillState.level) {
      case 'coarse':
        return 'Coarse Property Clusters';
      case 'fine':
        return `Fine Property Clusters in "${drillState.coarseCluster}"`;
      case 'property':
        return `Properties in "${drillState.fineCluster}"`;
      default:
        return 'Unknown Level';
    }
  };

  const getTableTitle = () => {
    if (drillState.property) {
      return `Properties in "${drillState.coarseCluster}" → "${drillState.fineCluster}" → "${drillState.property}"`;
    } else if (drillState.coarseCluster && drillState.fineCluster) {
      return `All properties in "${drillState.coarseCluster}" → "${drillState.fineCluster}"`;
    } else if (drillState.coarseCluster) {
      return `All properties in "${drillState.coarseCluster}"`;
    } else {
      return 'All properties';
    }
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    
    if (drillState.level !== 'coarse') {
      breadcrumbs.push({ label: 'Coarse Clusters', onClick: () => setDrillState({ level: 'coarse' }) });
    }
    
    if (drillState.coarseCluster && drillState.level !== 'fine') {
      breadcrumbs.push({ 
        label: drillState.coarseCluster, 
        onClick: () => setDrillState({ level: 'fine', coarseCluster: drillState.coarseCluster }) 
      });
    }
    
    if (drillState.fineCluster && !drillState.property) {
      breadcrumbs.push({ 
        label: drillState.fineCluster, 
        onClick: () => setDrillState({ 
          level: 'property', 
          coarseCluster: drillState.coarseCluster, 
          fineCluster: drillState.fineCluster 
        }) 
      });
    }
    
    if (drillState.property) {
      breadcrumbs.push({ 
        label: drillState.fineCluster!, 
        onClick: () => setDrillState({ 
          level: 'property', 
          coarseCluster: drillState.coarseCluster, 
          fineCluster: drillState.fineCluster 
        }) 
      });
      breadcrumbs.push({ 
        label: drillState.property, 
        onClick: () => {} 
      });
    }
    
    return breadcrumbs;
  };

  const canDrillDown = drillState.level !== 'property' || !drillState.property;

  // Custom tooltip for dual bar chart
  const CustomTooltip = ({ active, payload, label, coordinate }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div 
          className="bg-white p-3 border border-gray-300 rounded shadow-lg max-w-xs relative"
          style={{
            zIndex: 1000,
            marginLeft: '20px', // Offset to the right to avoid covering bars
            marginTop: '-10px'   // Slight upward offset
          }}
        >
          <p className="font-medium text-sm mb-2">{label}</p>
          {activeModels.map((model, index) => (
            <p key={model} className="text-sm" style={{ color: modelColors[index] }}>
              {model}: {data[`${model}_count`]} items ({data[`${model}_percentage`]}%)
            </p>
          ))}
          <p className="text-sm text-gray-600 mt-1 pt-1 border-t">
            Total: {data.total_count} items
          </p>
        </div>
      );
    }
    return null;
  };

  // Handle model selection for custom view
  const handleModelToggle = useCallback((model: string) => {
    setSelectedModels(prev => {
      if (prev.includes(model)) {
        return prev.filter(m => m !== model);
      } else {
        return [...prev, model];
      }
    });
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'selected-models' && selectedModels.length === 0) {
      setSelectedModels(modelNames); // Default to all models
    }
  }, [selectedModels.length, modelNames]);

  const embedQuery = async (query: string): Promise<number[]> => {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    return response.data[0].embedding;
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={navigateToRoot}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="text-sm">Root</span>
          </button>
          
          {getBreadcrumbs().map((breadcrumb, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <button
                onClick={breadcrumb.onClick}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors max-w-xs truncate"
                title={breadcrumb.label}
              >
                {breadcrumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {drillState.level !== 'coarse' && (
          <button
            onClick={navigateUp}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
        )}
      </div>

      {/* View Mode Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Visualization Options</h3>
          <div className="text-sm text-gray-600">
            {modelNames.length} total models • {activeModels.length} showing
            {showDiscrepancyOnly ? (
              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                Showing {chartData.length} categories with discrepancies ≥ {
                  viewMode === 'all-models' ? 
                    Math.max(discrepancyThreshold, 2) : 
                    discrepancyThreshold
                }x ratio
              </span>
            ) : (
              <span> • {chartData.length} categories</span>
            )}
            {showUnexpectedOnly && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                Unexpected Behavior Only
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* View Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">View Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleViewModeChange('top-models')}
                className={`flex items-center justify-center px-3 py-2 text-sm rounded-md border transition-colors ${
                  viewMode === 'top-models'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                Top Models
              </button>
              
              <button
                onClick={() => handleViewModeChange('selected-models')}
                className={`flex items-center justify-center px-3 py-2 text-sm rounded-md border transition-colors ${
                  viewMode === 'selected-models'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Custom Selection
              </button>
              
              <button
                onClick={() => handleViewModeChange('heatmap')}
                className={`flex items-center justify-center px-3 py-2 text-sm rounded-md border transition-colors ${
                  viewMode === 'heatmap'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Grid className="h-4 w-4 mr-2" />
                Heatmap View
              </button>
              
              <button
                onClick={() => handleViewModeChange('all-models')}
                className={`flex items-center justify-center px-3 py-2 text-sm rounded-md border transition-colors ${
                  viewMode === 'all-models'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                All Models
              </button>
            </div>
          </div>

          {/* Discrepancy Filter Controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Advanced Filters</span>
              </div>
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showUnexpectedOnly}
                  onChange={(e) => setShowUnexpectedOnly(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">Show only unexpected behaviors</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showDiscrepancyOnly}
                  onChange={(e) => setShowDiscrepancyOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show only categories with significant discrepancies</span>
              </label>
              
              {showDiscrepancyOnly && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {viewMode === 'all-models' ? 
                      `Minimum ratio (higher/lower): ${Math.max(discrepancyThreshold, 2)}x (enhanced for all-models)` :
                      `Minimum ratio (higher/lower): ${discrepancyThreshold}x`
                    }
                  </label>
                  <input
                    type="range"
                    min="1.5"
                    max="10"
                    step="0.5"
                    value={discrepancyThreshold}
                    onChange={(e) => setDiscrepancyThreshold(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1.5x</span>
                    <span>10x</span>
                  </div>
                  
                  {viewMode === 'all-models' && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      <strong>All-models mode:</strong> Enhanced filtering applies stricter criteria, requiring meaningful absolute differences and focusing on categories where models actually have data.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mode-specific Controls */}
          <div>
            {viewMode === 'top-models' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Top Models: {topModelCount}
                </label>
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={topModelCount}
                  onChange={(e) => setTopModelCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>3</span>
                  <span>8</span>
                </div>
              </div>
            )}
            
            {viewMode === 'selected-models' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Models ({selectedModels.length} selected)
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {modelNames.map(model => (
                    <label key={model} className="flex items-center space-x-2 text-xs py-1">
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model)}
                        onChange={() => handleModelToggle(model)}
                        className="rounded"
                      />
                      <span className="truncate" title={model}>{model}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {viewMode === 'heatmap' && (
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Heatmap View</p>
                <p>Shows intensity of model activity across categories. Darker colors indicate higher activity.</p>
              </div>
            )}
            
            {viewMode === 'all-models' && (
              <div className="text-sm text-orange-600">
                <p className="font-medium mb-2">⚠️ All Models View</p>
                <p>Showing all {modelNames.length} models. This may be cluttered with many models.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {viewMode === 'heatmap' ? (
        /* Heatmap Visualization */
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{getLevelTitle()} - Heatmap</h3>
            <div className="text-sm text-gray-600">
              {canDrillDown ? 'Click cells to drill down' : 'Deepest level reached'}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Heatmap Header */}
              <div className="flex" style={{ height: '80px', alignItems: 'flex-end' }}>
                <div className="w-48 flex-shrink-0"></div> {/* Empty corner */}
                {modelNames.map(model => (
                  <div key={model} className="w-24 text-center text-xs font-medium text-gray-700 p-2 transform -rotate-45 origin-bottom-left" style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div className="whitespace-nowrap">{model.includes('_') ? model.split('_').slice(1).join('_') : model}</div>
                  </div>
                ))}
              </div>
              
              {/* Heatmap Body */}
              {Array.from(new Set(heatmapData.map(item => item.category))).map(category => (
                <div key={category} className="flex items-center">
                  <div className="w-48 flex-shrink-0 text-sm text-gray-900 p-2 text-right border-r">
                    <button
                      onClick={() => canDrillDown && handleBarClick({ name: category })}
                      className={`text-left truncate w-full ${canDrillDown ? 'hover:text-blue-600 cursor-pointer' : ''}`}
                      title={category}
                    >
                      {category}
                    </button>
                  </div>
                  {modelNames.map(model => {
                    const cellData = heatmapData.find(item => item.category === category && item.model === model);
                    const intensity = cellData ? cellData.percentage : 0;
                    const count = cellData ? cellData.count : 0;
                    
                    return (
                      <div
                        key={`${category}-${model}`}
                        className="w-24 h-12 border border-gray-200 flex items-center justify-center text-xs"
                        style={{
                          backgroundColor: intensity > 0 ? `rgba(59, 130, 246, ${Math.min(intensity / 100, 0.8)})` : '#f9fafb',
                          color: intensity > 50 ? 'white' : '#374151'
                        }}
                        title={`${model} in ${category}: ${count} items (${intensity.toFixed(1)}%)`}
                      >
                        {count > 0 && (
                          <div className="text-center">
                            <div className="font-medium">{count}</div>
                            <div className="text-xs opacity-75">{intensity.toFixed(0)}%</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {/* Legend */}
              <div className="mt-4 flex items-center justify-center space-x-4 text-sm text-gray-600">
                <span>Legend:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-100 border"></div>
                  <span>0%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}></div>
                  <span>30%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }}></div>
                  <span>60%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border" style={{ backgroundColor: 'rgba(59, 130, 246, 0.8)' }}></div>
                  <span>80%+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Bar Chart Visualization */
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{getLevelTitle()}</h3>
            <div className="text-sm text-gray-600">
              {canDrillDown ? 'Click bars to drill down' : 'Deepest level reached'} • {chartData.length} categories
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={600}>
            <BarChart data={chartData} margin={{ bottom: 120, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={120}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                position={{ x: undefined, y: undefined }}
                allowEscapeViewBox={{ x: true, y: true }}
                offset={20}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Legend 
                verticalAlign="top" 
                height={60}
                iconType="rect"
                wrapperStyle={{ paddingBottom: '20px', paddingTop: '5px' }}
              />
              {activeModels.map((model, index) => (
                <Bar 
                  key={model}
                  dataKey={`${model}_count`}
                  name={model}
                  fill={modelColors[index]} 
                  cursor={canDrillDown ? "pointer" : "default"}
                  onClick={canDrillDown ? handleBarClick : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtered Data Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtered Data: {getTableTitle()}</h3>
            <div className="text-sm text-gray-600">
              {totalItems} items
            </div>
          </div>
          
          {/* Search and Controls */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search properties, models, categories..."
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
                value={tableSearch}
                onChange={handleSearchChange}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Items per page:</label>
                <select
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cluster Hierarchy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTableData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-md">{item.property_description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={(() => {
                        const modelIndex = activeModels.indexOf(item.model);
                        if (modelIndex >= 0) {
                          return getModelBadgeStyle(modelColors[modelIndex], modelIndex);
                        }
                        // Fallback for models not in active list (heatmap/all-models view)
                        const allModelIndex = modelNames.indexOf(item.model);
                        return getModelBadgeStyle('#6b7280', allModelIndex);
                      })()}
                    >
                      {item.model}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {item.property_description_coarse_cluster_label}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {item.property_description_fine_cluster_label}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.impact === 'High' ? 'bg-red-100 text-red-800' :
                      item.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.impact}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.type}</td>
                  <td className="px-6 py-4 text-sm">
                    {onViewResponse && (
                      <button
                        onClick={() => onViewResponse(item)}
                        className="flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        <span>View</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              
              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractivePropertyChart; 