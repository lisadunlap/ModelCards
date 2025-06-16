import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronRight, ArrowLeft, Eye, Home } from 'lucide-react';
import InfoTooltip from './components/InfoTooltip.tsx';

interface DifferenceData {
  difference: string;
  category: string;
  coarse_cluster_label?: string;
  fine_cluster_label?: string;
  impact: string;
  reason?: string;
  type?: string;
  prompt?: string;
  a_evidence?: string;
  b_evidence?: string;
  model_1_response?: string;
  model_2_response?: string;
  unexpected_behavior?: string;
}

interface InteractiveHierarchicalChartProps {
  data: DifferenceData[];
  onViewResponse?: (item: DifferenceData) => void;
}

type DrillLevel = 'coarse' | 'fine' | 'category';

interface DrillState {
  level: DrillLevel;
  coarseCluster?: string;
  fineCluster?: string;
  category?: string;
}

const InteractiveHierarchicalChart: React.FC<InteractiveHierarchicalChartProps> = ({ 
  data, 
  onViewResponse 
}) => {
  const [drillState, setDrillState] = useState<DrillState>({ level: 'coarse' });

  // Calculate chart data based on current drill level
  const chartData = useMemo(() => {
    let filteredData = data;

    // Apply filters based on drill state
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.fine_cluster_label === drillState.fineCluster);
    }

    // Group data based on current level
    let groupedData: Record<string, number> = {};
    
    switch (drillState.level) {
      case 'coarse':
        groupedData = filteredData.reduce((acc, item) => {
          if (item.coarse_cluster_label) {
            acc[item.coarse_cluster_label] = (acc[item.coarse_cluster_label] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        break;
      case 'fine':
        groupedData = filteredData.reduce((acc, item) => {
          if (item.fine_cluster_label) {
            acc[item.fine_cluster_label] = (acc[item.fine_cluster_label] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        break;
      case 'category':
        groupedData = filteredData.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        break;
    }

    return Object.entries(groupedData)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, drillState]);

  // Get filtered data for the table view (always shown)
  const tableData = useMemo(() => {
    let filteredData = data;
    
    if (drillState.coarseCluster) {
      filteredData = filteredData.filter(item => item.coarse_cluster_label === drillState.coarseCluster);
    }
    if (drillState.fineCluster) {
      filteredData = filteredData.filter(item => item.fine_cluster_label === drillState.fineCluster);
    }
    if (drillState.category) {
      filteredData = filteredData.filter(item => item.category === drillState.category);
    }
    
    // Shuffle the data to randomize order
    return [...filteredData].sort(() => Math.random() - 0.5);
  }, [data, drillState]);

  const handleBarClick = (data: any) => {
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
          level: 'category',
          fineCluster: clickedName
        });
        break;
      case 'category':
        setDrillState({
          ...drillState,
          category: clickedName
        });
        break;
    }
  };

  const navigateUp = () => {
    switch (drillState.level) {
      case 'fine':
        setDrillState({ level: 'coarse' });
        break;
      case 'category':
        if (drillState.category) {
          // If we're showing a specific category, go back to showing all categories in this fine cluster
          setDrillState({
            level: 'category',
            coarseCluster: drillState.coarseCluster,
            fineCluster: drillState.fineCluster
          });
        } else {
          // If we're showing all categories, go back to fine level
          setDrillState({
            level: 'fine',
            coarseCluster: drillState.coarseCluster
          });
        }
        break;
    }
  };

  const navigateToRoot = () => {
    setDrillState({ level: 'coarse' });
  };

  const getLevelTitle = () => {
    switch (drillState.level) {
      case 'coarse':
        return 'Coarse Clusters';
      case 'fine':
        return `Fine Clusters in "${drillState.coarseCluster}"`;
      case 'category':
        return `Categories in "${drillState.fineCluster}"`;
      default:
        return 'Unknown Level';
    }
  };

  const getTableTitle = () => {
    if (drillState.category) {
      return `Items in "${drillState.coarseCluster}" → "${drillState.fineCluster}" → "${drillState.category}"`;
    } else if (drillState.coarseCluster && drillState.fineCluster) {
      return `All items in "${drillState.coarseCluster}" → "${drillState.fineCluster}"`;
    } else if (drillState.coarseCluster) {
      return `All items in "${drillState.coarseCluster}"`;
    } else {
      return 'All items';
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
    
    if (drillState.fineCluster && !drillState.category) {
      breadcrumbs.push({ 
        label: drillState.fineCluster, 
        onClick: () => setDrillState({ 
          level: 'category', 
          coarseCluster: drillState.coarseCluster, 
          fineCluster: drillState.fineCluster 
        }) 
      });
    }
    
    if (drillState.category) {
      breadcrumbs.push({ 
        label: drillState.fineCluster!, 
        onClick: () => setDrillState({ 
          level: 'category', 
          coarseCluster: drillState.coarseCluster, 
          fineCluster: drillState.fineCluster 
        }) 
      });
      breadcrumbs.push({ 
        label: drillState.category, 
        onClick: () => {} 
      });
    }
    
    return breadcrumbs;
  };

  const canDrillDown = drillState.level !== 'category' || !drillState.category;

  const countTooltipContent = "Charts show absolute counts of property instances. Each data point represents one identified property difference between model responses.";

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

      {/* Bar Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">{getLevelTitle()}</h3>
            <InfoTooltip content={countTooltipContent} />
          </div>
          <div className="text-sm text-gray-600">
            {canDrillDown ? 'Click bars to drill down' : 'Deepest level reached'} • {chartData.length} categories
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Bar 
              dataKey="count" 
              fill="#3b82f6" 
              cursor={canDrillDown ? "pointer" : "default"}
              onClick={canDrillDown ? handleBarClick : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtered Data Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900">Filtered Data: {getTableTitle()}</h3>
              <InfoTooltip content="Table shows all individual property instances that match the current filter criteria." />
            </div>
            <div className="text-sm text-gray-600">
              {tableData.length} items
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category Hierarchy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unexpected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-md">{item.difference}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="space-y-1">
                      {item.coarse_cluster_label && (
                        <div className="text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {item.coarse_cluster_label}
                          </span>
                        </div>
                      )}
                      {item.fine_cluster_label && (
                        <div className="text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                            {item.fine_cluster_label}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.category}
                        </span>
                      </div>
                    </div>
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
                    {item.unexpected_behavior && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {item.unexpected_behavior}
                      </span>
                    )}
                  </td>
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
      </div>
    </div>
  );
};

export default InteractiveHierarchicalChart;