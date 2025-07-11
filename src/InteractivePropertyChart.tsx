import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronRight, ArrowLeft, Eye, Home, ChevronLeft, ChevronDown, Filter, BarChart3, Grid, Users, TrendingUp } from 'lucide-react';
import { getOpenAIApiKey, hasValidApiKey, initializeOpenAIClient, getOpenAIClient } from './config/apiConfig';
import { getModelColor, getModelChartColors, getAllModelNames } from './config/modelColors';
import { PropertyData } from './types';

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

type ViewMode = 'selected-models' | 'heatmap';

const InteractivePropertyChart: React.FC<InteractivePropertyChartProps> = ({ 
  data, 
  onViewResponse 
}) => {
  const [drillState, setDrillState] = useState<DrillState>({ level: 'coarse' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [tableSearch, setTableSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('selected-models');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showDiscrepancyOnly, setShowDiscrepancyOnly] = useState(false);
  const [discrepancyThreshold, setDiscrepancyThreshold] = useState(1.0);
  const [showUnexpectedOnly, setShowUnexpectedOnly] = useState(false);
  
  const dataWithoutOutliers = useMemo(() => {
    const initialCount = data.length;
    const filtered = data.filter(
      p => p.property_description_coarse_cluster_label !== "Outliers"
    );
    if (initialCount > filtered.length) {
      console.log(`[InteractivePropertyChart] Filtered out ${initialCount - filtered.length} coarse cluster outlier rows. New count: ${filtered.length}`);
    }
    return filtered;
  }, [data]);

  const modelTotalBattleCounts = useMemo(() => {
    const conversationMap = new Map<string, PropertyData>();
    dataWithoutOutliers.forEach(item => {
      const conversationKey = `${item.prompt}|||${item.differences}`;
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, item);
      }
    });
    const uniqueConversations = Array.from(conversationMap.values());
    
    const modelBattleCounts = new Map<string, number>();
    uniqueConversations.forEach(conversation => {
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
    console.log('📊 Memoized global model battle counts:', Array.from(modelBattleCounts.entries()).slice(0, 5));
    return modelBattleCounts;
  }, [dataWithoutOutliers]);

  // Add state for group by prompt functionality
  const [groupByPrompt, setGroupByPrompt] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  
  // Add new state for battle model filtering
  const [filterBattleModels, setFilterBattleModels] = useState(false);

  // Get unique model names from the data
  const modelNames = useMemo(() => {
    const uniqueModels = Array.from(new Set(dataWithoutOutliers.map(item => item.model)))
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
  }, [dataWithoutOutliers]);

  // Initialize selectedModels to all models by default (except "Unknown")
  useEffect(() => {
    if (modelNames.length > 0 && selectedModels.length === 0) {
      const modelsToSelect = modelNames.filter(model => model !== 'Unknown');
      setSelectedModels(modelsToSelect);
    }
  }, [modelNames, selectedModels.length]);

  // Get active models based on view mode
  const activeModels = useMemo(() => {
    if (viewMode === 'heatmap') {
      return modelNames;
    }
    // For selected-models view mode
    return selectedModels.length > 0 ? selectedModels : modelNames;
  }, [viewMode, modelNames, selectedModels]);

  // Generate colors for active models using shared color system
  const modelColors = useMemo(() => {
    return activeModels.map(model => getModelColor(model).chartColor);
  }, [activeModels]);

  // Get model badge style using shared color system
  const getModelBadgeStyle = useCallback((modelName: string) => {
    const colors = getModelColor(modelName);
    
    // Convert Tailwind classes to CSS values
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
      backgroundColor: bgColorMap[colors.badgeColor] || '#f3f4f6',
      color: textColorMap[colors.textColor] || '#1f2937'
    };
  }, []);

  // Calculate chart data based on current drill level (memoized for performance)
  // Step 1: Calculate base chart data before any discrepancy filtering is applied
  const baseChartData = useMemo(() => {
    let filteredData = dataWithoutOutliers;

    // Apply filters based on drill state
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.property_description_coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.property_description_fine_cluster_label === drillState.fineCluster);
    }

    // Debug logging for drill state
    console.log('🔍 Drill State:', drillState);
    console.log('📊 Filtered Data Count:', filteredData.length);
    console.log('📊 Sample Filtered Data:', filteredData.slice(0, 3));

    // Filter by unexpected behavior if enabled
    if (showUnexpectedOnly) {
      filteredData = filteredData.filter(item => 
        item.unexpected_behavior && 
        item.unexpected_behavior.toLowerCase() === 'true'
      );
      console.log('🚨 After unexpected filter:', filteredData.length);
    }

    // Filter by active models (except in heatmap mode where we want to see all)
    // Skip this filter if battle model filtering is enabled - let battle filtering handle model selection
    if (viewMode !== 'heatmap' && !(filterBattleModels && viewMode === 'selected-models' && selectedModels.length > 0)) {
      filteredData = filteredData.filter(item => activeModels.includes(item.model));
    }

    // Add battle model filtering - only show battles where both participants are in selected models
    if (filterBattleModels && viewMode === 'selected-models' && selectedModels.length > 0) {
      filteredData = filteredData.filter(item => 
        selectedModels.includes(item.model_1_name) && selectedModels.includes(item.model_2_name)
      );
      console.log('⚔️ After battle model filter:', filteredData.length, 'selectedModels:', selectedModels);
    }

    // NEW APPROACH: Calculate battle-based proportions
    
    // Step 1: Deduplicate by (prompt, differences) to get unique conversations
    const conversationMap = new Map<string, PropertyData>();
    filteredData.forEach(item => {
      const conversationKey = `${item.prompt}|||${item.differences}`;
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, item);
      }
    });
    const uniqueConversations = Array.from(conversationMap.values());
    console.log('📊 Unique conversations after deduplication:', uniqueConversations.length);

    // Step 2: For each model, calculate total battles participated in - This is now done globally above
    
    // Step 3: Group conversations by cluster/property and calculate proportions
    const clusterBattles = new Map<string, Map<string, Set<string>>>();
    
    uniqueConversations.forEach(conversation => {
      // Determine cluster key based on drill level
      let clusterKey = '';
      switch (drillState.level) {
        case 'coarse':
          clusterKey = conversation.property_description_coarse_cluster_label;
          break;
        case 'fine':
          clusterKey = conversation.property_description_fine_cluster_label;
          break;
        case 'property':
          clusterKey = conversation.property_description;
          break;
      }
      
      if (!clusterKey || clusterKey === 'Unknown' || clusterKey === '') return;

      // Initialize cluster tracking
      if (!clusterBattles.has(clusterKey)) {
        clusterBattles.set(clusterKey, new Map());
      }
      
      const clusterMap = clusterBattles.get(clusterKey)!;
      const conversationKey = `${conversation.prompt}|||${conversation.differences}`;
      
      // For each battle, track which models participated
      const modelWithProperty = conversation.model;
      if (modelWithProperty && modelWithProperty !== 'Unknown') {
        // Skip if model is not in active models list (when not battle filtering)
        const useBattleFiltering = filterBattleModels && viewMode === 'selected-models' && selectedModels.length > 0;
        if (!useBattleFiltering && viewMode !== 'heatmap' && !activeModels.includes(modelWithProperty)) {
          return;
        }
        
        if (!clusterMap.has(modelWithProperty)) {
          clusterMap.set(modelWithProperty, new Set());
        }
        clusterMap.get(modelWithProperty)!.add(conversationKey);
      }
    });

    // Step 4: Calculate proportions for chart data
    let chartEntries: any[] = [];
    
    clusterBattles.forEach((modelBattles, clusterName) => {
      const entry: any = { 
        name: clusterName, 
        total_battles: 0,
        battle_counts: new Map<string, number>()
      };
      
      // Calculate proportions for each model
      modelBattles.forEach((battleSet, modelName) => {
        const battlesWithProperty = battleSet.size;
        const totalBattles = modelTotalBattleCounts.get(modelName) || 0;
        
        if (totalBattles > 0) {
          const proportion = (battlesWithProperty / totalBattles) * 100; // Convert to percentage
          entry[`${modelName}_percentage`] = Math.round(proportion * 10) / 10; // Round to 1 decimal
          entry[`${modelName}_battle_count`] = battlesWithProperty;
          entry[`${modelName}_total_battles`] = totalBattles;
          entry.battle_counts.set(modelName, battlesWithProperty);
        } else {
          entry[`${modelName}_percentage`] = 0;
          entry[`${modelName}_battle_count`] = 0;
          entry[`${modelName}_total_battles`] = 0;
        }
      });
      
      // Calculate total unique battles for this cluster (across all models)
      const allBattles = new Set<string>();
      modelBattles.forEach(battleSet => {
        battleSet.forEach(battle => allBattles.add(battle));
      });
      entry.total_battles = allBattles.size;
      
      chartEntries.push(entry);
    });

    console.log('📈 Base Chart Entries Count:', chartEntries.length);
    return chartEntries;
  }, [dataWithoutOutliers, drillState, activeModels, viewMode, showUnexpectedOnly, filterBattleModels, selectedModels, modelTotalBattleCounts]);

  // Step 2: Calculate the dynamic range for the discrepancy slider based on the data
  const cvDiscrepancyStats = useMemo(() => {
    if (baseChartData.length === 0) {
      return { min: 0, max: 2, step: 0.1, hasData: false };
    }

    const allCVs = baseChartData
      .map(entry => {
        const modelPercentages = activeModels.map(model => entry[`${model}_percentage`] || 0);
        if (modelPercentages.length < 2) return 0;
        
        const totalPercentage = modelPercentages.reduce((sum, p) => sum + p, 0);
        if (totalPercentage === 0) return 0;

        const mean = totalPercentage / modelPercentages.length;
        if (mean === 0) return 0;

        const stddev = Math.sqrt(
          modelPercentages.map(p => Math.pow(p - mean, 2)).reduce((sum, v) => sum + v, 0) / modelPercentages.length
        );
        const cv = stddev / mean;
        return cv;
      })
      .filter(cv => cv > 0 && isFinite(cv));

    if (allCVs.length === 0) {
      return { min: 0, max: 2, step: 0.1, hasData: false };
    }

    const min = Math.min(...allCVs);
    const max = Math.max(...allCVs);

    const sliderMin = Math.floor(min * 100) / 100;
    const sliderMax = Math.ceil(max * 100) / 100;
    
    const step = (sliderMax - sliderMin) > 0 ? (sliderMax - sliderMin) / 100 : 0.01;

    return { min: sliderMin, max: sliderMax, step: Math.max(step, 0.01), hasData: true };
  }, [baseChartData, activeModels]);

  // Step 3: Ensure the slider's value is valid when the range changes
  useEffect(() => {
    if (cvDiscrepancyStats.hasData) {
      setDiscrepancyThreshold(prev => Math.max(cvDiscrepancyStats.min, Math.min(prev, cvDiscrepancyStats.max)));
    }
  }, [cvDiscrepancyStats]);
  
  // Step 4: Apply the discrepancy filter to get the final chart data
  const chartData = useMemo(() => {
    let chartEntries = [...baseChartData];

    // Filter out any cluster where the top model has fewer than 10 instances, to reduce noise.
    const countBeforeMinFilter = chartEntries.length;
    chartEntries = chartEntries.filter(entry => {
      if (activeModels.length === 0) return false;
      const maxCount = Math.max(...activeModels.map(model => entry[`${model}_battle_count`] || 0));
      return maxCount >= 10;
    });
    if (countBeforeMinFilter > chartEntries.length) {
      console.log(`📊 Filtered out ${countBeforeMinFilter - chartEntries.length} categories where max model count was < 10.`);
    }

    // Store total before filtering for comparison
    const totalBeforeFilter = chartEntries.length;

    // Apply discrepancy filtering if enabled
    if (showDiscrepancyOnly && activeModels.length >= 2 && drillState.level === 'coarse') {
      chartEntries = chartEntries.filter(entry => {
        // Get model counts to ensure we are not looking at a very sparse category
        const modelCounts = activeModels.map(model => entry[`${model}_battle_count`] || 0);
        const totalCount = modelCounts.reduce((sum, count) => sum + count, 0);

        // Don't calculate for very sparse categories to avoid noise
        if (totalCount < 3) { 
            return false;
        }

        // Get all model percentages for this category for active models
        const modelPercentages = activeModels.map(model => entry[`${model}_percentage`] || 0);
        
        // We need at least 2 models to have a discrepancy
        if (modelPercentages.length < 2) {
          return false;
        }

        // Calculate Coefficient of Variation (CV) on the propensities (percentages)
        const totalPercentage = modelPercentages.reduce((sum, p) => sum + p, 0);
        // If all propensities are 0, there's no discrepancy to show.
        if (totalPercentage === 0) {
            return false;
        }

        const mean = totalPercentage / modelPercentages.length;
        if (mean === 0) {
          return false; // No data, no discrepancy
        }
        const stddev = Math.sqrt(
          modelPercentages.map(p => Math.pow(p - mean, 2)).reduce((sum, v) => sum + v, 0) / modelPercentages.length
        );
        const cv = stddev / mean;
        
        // Use the threshold from the slider (now representing CV)
        const threshold = discrepancyThreshold;
        
        return cv >= threshold;
      });
      
      // Add debugging info to help track filter effectiveness
      console.log(`Discrepancy filter: ${totalBeforeFilter} -> ${chartEntries.length} categories (threshold: ${discrepancyThreshold})`);
    }

    const finalData = chartEntries.sort((a, b) => b.total_battles - a.total_battles);
    console.log('📊 Final Chart Data:', finalData.length, 'items');
    
    // If we have no data, log a warning
    if (finalData.length === 0) {
      console.warn('⚠️ No chart data generated! Check filters and data structure.');
      console.warn('Current drill state:', drillState);
      console.warn('Active models:', activeModels);
      console.warn('Original data count:', dataWithoutOutliers.length);
    }
    
    return finalData;
  }, [baseChartData, activeModels, showDiscrepancyOnly, discrepancyThreshold, drillState.level]);

  // Generate heatmap data for heatmap view
  const heatmapData = useMemo(() => {
    if (viewMode !== 'heatmap') return [];
    
    let filteredData = dataWithoutOutliers;
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

    // Add battle model filtering for heatmap
    if (filterBattleModels && selectedModels.length > 0) {
      filteredData = filteredData.filter(item => 
        selectedModels.includes(item.model_1_name) && selectedModels.includes(item.model_2_name)
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
  }, [dataWithoutOutliers, drillState, modelNames, viewMode, showUnexpectedOnly, filterBattleModels, selectedModels]);

  // Get filtered data for the table view (memoized and with search)
  const filteredTableData = useMemo(() => {
    let filteredData = dataWithoutOutliers;
    
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
    if (viewMode !== 'heatmap' && !(filterBattleModels && viewMode === 'selected-models' && selectedModels.length > 0)) {
      filteredData = filteredData.filter(item => activeModels.includes(item.model));
    }
    
    // Add battle model filtering for table data
    if (filterBattleModels && viewMode === 'selected-models' && selectedModels.length > 0) {
      filteredData = filteredData.filter(item => 
        selectedModels.includes(item.model_1_name) && selectedModels.includes(item.model_2_name)
      );
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
    
    // Shuffle the data to randomize order
    const shuffledData = [...filteredData].sort(() => Math.random() - 0.5);
    
    // Debug: Log some info about the filtered data
    console.log('🔍 Filtered table data:', {
      totalItems: shuffledData.length,
      sampleItems: shuffledData.slice(0, 5).map(item => ({
        row_id: item.row_id,
        model: item.model,
        property_desc: item.property_description?.substring(0, 30) + '...'
      })),
      uniqueRowIds: Array.from(new Set(shuffledData.map(item => item.row_id))).slice(0, 10),
      uniqueModels: Array.from(new Set(shuffledData.map(item => item.model))).slice(0, 5)
    });
    
    return shuffledData;
  }, [dataWithoutOutliers, drillState, tableSearch, viewMode, activeModels, showUnexpectedOnly, filterBattleModels, selectedModels]);

  // Paginated table data
  const paginatedTableData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTableData.slice(startIndex, endIndex);
  }, [filteredTableData, currentPage, itemsPerPage]);

  // Process data for grouping by prompt
  const groupedTableData = useMemo(() => {
    if (!groupByPrompt) return null;
    
    const groups: Record<string, PropertyData[]> = {};
    filteredTableData.forEach(item => {
      const prompt = item.prompt || 'No Prompt';
      if (!groups[prompt]) {
        groups[prompt] = [];
      }
      groups[prompt].push(item);
    });
    
    const result = Object.entries(groups)
      .map(([prompt, items]) => ({
        prompt,
        items,
        count: items.length
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
    
    // Debug: Log some info about the grouped data
    console.log('🔍 Grouped data created:', {
      totalGroups: result.length,
      sampleGroup: result[0] ? {
        prompt: result[0].prompt.substring(0, 50) + '...',
        itemCount: result[0].items.length,
        sampleItems: result[0].items.slice(0, 3).map(item => ({
          row_id: item.row_id,
          model: item.model,
          property_desc: item.property_description?.substring(0, 30) + '...'
        }))
      } : null
    });
    
    return result;
  }, [filteredTableData, groupByPrompt]);

  // Handle prompt group expansion
  const togglePromptExpansion = useCallback((prompt: string) => {
    setExpandedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prompt)) {
        newSet.delete(prompt);
      } else {
        newSet.add(prompt);
      }
      return newSet;
    });
  }, []);

  // Expand all prompts
  const expandAllPrompts = useCallback(() => {
    if (groupedTableData) {
      setExpandedPrompts(new Set(groupedTableData.map(group => group.prompt)));
    }
  }, [groupedTableData]);

  // Collapse all prompts
  const collapseAllPrompts = useCallback(() => {
    setExpandedPrompts(new Set());
  }, []);

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
              {model}: {data[`${model}_battle_count`]} battles
            </p>
          ))}
          <p className="text-sm text-gray-600 mt-1 pt-1 border-t">
            Total: {data.total_battles} battles
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
    if (!hasValidApiKey()) {
      throw new Error('OpenAI API key not available - please configure OPENAI_API_KEY environment variable');
    }
    
    // Initialize OpenAI client if not already done
    const initialized = await initializeOpenAIClient();
    const openai = getOpenAIClient();
    if (!initialized || !openai) {
      throw new Error('OpenAI client not initialized - please check your configuration');
    }
    
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Calculate dynamic Y-axis range based on actual data
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    let maxValue = 0;
    chartData.forEach(entry => {
      activeModels.forEach(model => {
        const value = entry[`${model}_percentage`] || 0;
        if (value > maxValue) {
          maxValue = value;
        }
      });
    });
    
    // Add 20% padding above the maximum value, with a minimum of 10%
    const paddedMax = Math.max(maxValue * 1.2, 10);
    // Round up to the nearest 5 for cleaner axis labels
    const roundedMax = Math.ceil(paddedMax / 5) * 5;
    
    return [0, roundedMax];
  }, [chartData, activeModels]);

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
                Showing {chartData.length} categories with discrepancy ≥ {discrepancyThreshold.toFixed(1)} Coefficient of Variation (CV)
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
        
        <div className="grid grid-cols-[200px_1fr_1fr] gap-6">
          {/* Column 1: View Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">View Mode</label>
            <div className="grid grid-cols-1 gap-2">
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
            </div>
          </div>

          {/* Column 2: Model Selection */}
          <div>
            {viewMode === 'selected-models' ? (
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
            ) : (
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Heatmap View</p>
                <p>Shows intensity of model activity across categories. Darker colors indicate higher activity.</p>
              </div>
            )}
          </div>

          {/* Column 3: Advanced Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Advanced Filters</label>
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
              
              {viewMode === 'selected-models' && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterBattleModels}
                    onChange={(e) => setFilterBattleModels(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Only show where both models are selected</span>
                </label>
              )}
              
              {showDiscrepancyOnly && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Minimum Discrepancy (Coefficient of Variation): {discrepancyThreshold.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min={cvDiscrepancyStats.min}
                    max={cvDiscrepancyStats.max}
                    step={cvDiscrepancyStats.step}
                    value={discrepancyThreshold}
                    onChange={(e) => setDiscrepancyThreshold(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    disabled={!cvDiscrepancyStats.hasData}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{cvDiscrepancyStats.min.toFixed(2)}</span>
                    <span>{cvDiscrepancyStats.max.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
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
          
          {heatmapData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                <p className="text-sm">
                  No data matches the current filters and drill-down selection.
                  <br />
                  Try adjusting your filters or navigate back to a higher level.
                </p>
              </div>
            </div>
          ) : (
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
          )}
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
          
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
            <strong>Propensity calculation:</strong> Each bar shows what percentage of a model's total battles resulted in that behavioral pattern. 
            For example, 5% propensity means the model exhibited this behavior in 5 out of every 100 battles it participated in.
          </div>
          
          {chartData.length === 0 ? (
            drillState.level === 'property' ? (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">View Conversations</h3>
                  <p className="text-sm">
                    Click on conversations in the table below to explore conversations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                  <p className="text-sm mb-4">
                    No data matches the current filters and drill-down selection.
                    <br />
                    Try adjusting your filters or navigate back to a higher level.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-md mx-auto">
                    <h4 className="font-medium text-yellow-800 mb-2">Debugging Information:</h4>
                    <div className="text-xs text-yellow-700 space-y-1">
                      <p>• Current level: {drillState.level}</p>
                      <p>• Coarse cluster: {drillState.coarseCluster || 'None'}</p>
                      <p>• Fine cluster: {drillState.fineCluster || 'None'}</p>
                      <p>• Active models: {activeModels.length}</p>
                      <p>• View mode: {viewMode}</p>
                      <p>• Show discrepancy only: {showDiscrepancyOnly ? 'Yes' : 'No'}</p>
                      <p>• Show unexpected only: {showUnexpectedOnly ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <ResponsiveContainer width="100%" height={600}>
              <BarChart 
                data={chartData} 
                margin={{ bottom: 120, top: 20 }}
                barGap={1}
                barCategoryGap={7}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  label={{ value: 'Propensity (%)', angle: -90, position: 'insideLeft' }} 
                  domain={yAxisDomain}
                />
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
                    dataKey={`${model}_percentage`}
                    name={model}
                    fill={modelColors[index]} 
                    cursor={canDrillDown ? "pointer" : "default"}
                    onClick={canDrillDown ? handleBarClick : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
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
              
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={groupByPrompt}
                  onChange={(e) => setGroupByPrompt(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Group by Prompt</span>
              </label>
              
              {groupByPrompt && groupedTableData && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={expandAllPrompts}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAllPrompts}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              )}
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
              {groupByPrompt && groupedTableData ? (
                // Grouped view
                groupedTableData.map((group) => (
                  <React.Fragment key={group.prompt}>
                    {/* Group header row */}
                    <tr 
                      className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      onClick={() => togglePromptExpansion(group.prompt)}
                    >
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <ChevronRight 
                              className={`h-4 w-4 transition-transform ${
                                expandedPrompts.has(group.prompt) ? 'rotate-90' : ''
                              }`}
                            />
                            <span className="font-medium text-gray-900">
                              {group.prompt.length > 100 ? `${group.prompt.substring(0, 100)}...` : group.prompt}
                            </span>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {group.count} {group.count === 1 ? 'property' : 'properties'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Group items (when expanded) */}
                    {expandedPrompts.has(group.prompt) && group.items.map((item, index) => (
                      <tr key={`${group.prompt}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-md">{item.property_description}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={getModelBadgeStyle(item.model)}
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
                              onClick={() => {
                                console.log('🔍 Grouped View - Clicking View button for item:', {
                                  model: item.model,
                                  prompt: item.prompt?.substring(0, 50) + '...',
                                  property_description: item.property_description?.substring(0, 50) + '...',
                                  row_id: item.row_id,
                                  model_1_name: item.model_1_name,
                                  model_2_name: item.model_2_name
                                });
                                onViewResponse(item);
                              }}
                              className="flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              <span>View</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                // Regular ungrouped view
                paginatedTableData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-md">{item.property_description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={getModelBadgeStyle(item.model)}
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
                          onClick={() => {
                            console.log('🔍 Grouped View - Clicking View button for item:', {
                              model: item.model,
                              prompt: item.prompt?.substring(0, 50) + '...',
                              property_description: item.property_description?.substring(0, 50) + '...',
                              row_id: item.row_id,
                              model_1_name: item.model_1_name,
                              model_2_name: item.model_2_name
                            });
                            onViewResponse(item);
                          }}
                          className="flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          <span>View</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!groupByPrompt && totalPages > 1 && (
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

        {/* Grouped view summary */}
        {groupByPrompt && groupedTableData && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {groupedTableData.length} unique prompts with {totalItems} total properties
              {expandedPrompts.size > 0 && (
                <span className="ml-2">
                  • {expandedPrompts.size} prompt{expandedPrompts.size !== 1 ? 's' : ''} expanded
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractivePropertyChart; 