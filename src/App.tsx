import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Database, Brain, X, Eye, ExternalLink } from 'lucide-react';
import InteractiveHierarchicalChart from './InteractiveHierarchicalChart';
import InteractivePropertyChart from './InteractivePropertyChart';
import SemanticSearch from './SemanticSearch';
import ContentRenderer from './components/ContentRenderer';
import { getCurrentDataSources, validateDataSources, DATA_CONFIG } from './config/dataSources';
import { initializeModelColors, getModelColor } from './config/modelColors';
import { dataLoader, PropertyData, LoadingProgress } from './services/dataLoader';

const ModelDifferenceAnalyzer = () => {
  const [propertyData, setPropertyData] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('overview');
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    status: 'Starting...',
    progress: 0,
    loaded: 0,
    total: 0
  });
  
  // Add state for side panel
  const [selectedItem, setSelectedItem] = useState<PropertyData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add error boundary state
  const [hasRenderError, setHasRenderError] = useState(false);

  // Error boundary effect
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('🚨 Render error caught:', event.error);
      setHasRenderError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasRenderError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="bg-red-100 text-red-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Application Error</h2>
            <p className="mb-4">Something went wrong. Please refresh the page to try again.</p>
            <button 
              onClick={() => {
                setHasRenderError(false);
                window.location.reload();
              }} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const loadDataSafely = async () => {
    try {
      console.log('🔄 Starting optimized data loading process');
      
      // Validate data sources configuration
      validateDataSources();
      const dataSources = getCurrentDataSources();
      console.log('📋 Using data sources:', dataSources);
      
      // Load data using the optimized data loader
      const processedProperties = await dataLoader.loadTableData((progress) => {
        setLoadingProgress(progress);
      });
      
      console.log('✅ Data loaded successfully. Final count:', processedProperties.length);
      
      // Debug: Show all unique models found
      const allModels = Array.from(new Set([
        ...processedProperties.map(p => p.model).filter(name => name && name !== 'Unknown')
      ]));
      
      console.log('🎯 All unique models found:', allModels);
      console.log('📊 Total unique models:', allModels.length);
      
      // Get data index for additional info
      const dataIndex = dataLoader.getDataIndex();
      if (dataIndex) {
        console.log('📊 Data index:', dataIndex);
      }
      
      setPropertyData(processedProperties);
      
      // Initialize global model colors
      const allUniqueModels = Array.from(new Set([
        ...processedProperties.map(p => p.model).filter(name => name && name !== 'Unknown'),
        ...processedProperties.map(p => p.model_1_name).filter(name => name && name !== 'Unknown' && name !== ''),
        ...processedProperties.map(p => p.model_2_name).filter(name => name && name !== 'Unknown' && name !== ''),
      ]));
      initializeModelColors(allUniqueModels);
      
      setLoading(false);
      setError(null);
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!mounted) return;
      
      try {
        await loadDataSafely();
      } catch (error) {
        if (mounted) {
          console.error('💥 Critical error in data loading:', error);
          setError('Failed to load data. Please check your data files and try again.');
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Data</h2>
          <p className="text-gray-600 mb-4">{loadingProgress.status}</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress.progress}%` }}
            ></div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800 font-medium mb-2">📊 Loading Progress:</p>
            <div className="text-blue-700 text-sm space-y-1">
              <p>• Progress: {loadingProgress.progress.toFixed(1)}%</p>
              <p>• Data loaded: {loadingProgress.loaded.toLocaleString()} / {loadingProgress.total.toLocaleString()}</p>
              <p>• Status: {loadingProgress.status}</p>
              <p>• Using optimized loading with caching</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="bg-red-100 text-red-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Data Loading Error</h2>
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
                loadDataSafely();
              }} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: Database },
    { id: 'properties', label: 'Property Analysis', icon: BarChart3 },
    { id: 'search', label: 'Semantic Search', icon: Brain }
  ];

  // Get data sources for display
  const dataSources = getCurrentDataSources();

  // Add handlers for viewing responses with lazy loading
  const handleViewProperty = async (item: PropertyData) => {
    console.log('🔍 handleViewProperty called with item:', item);
    console.log('🔍 Item row_id:', item.row_id);
    console.log('🔍 Item model (from table):', item.model);
    console.log('🔍 Item model_1_name:', item.model_1_name);
    console.log('🔍 Item model_2_name:', item.model_2_name);
    console.log('🔍 Item property_description (first 100 chars):', item.property_description?.substring(0, 100));
    console.log('🔍 Item has model_1_response:', !!item.model_1_response);
    console.log('🔍 Item has model_2_response:', !!item.model_2_response);
    console.log('🔍 Loading strategy:', dataLoader.getLoadingStrategy());
    
    // Try to load detailed data if available
    if (item.row_id !== undefined) {
      try {
        console.log('🔍 Attempting to load detail data for row_id:', item.row_id);
        const detailedItem = await dataLoader.loadDetailData(item.row_id);
        console.log('🔍 Detailed item result:', detailedItem);
        console.log('🔍 Detailed item model (after loading):', detailedItem?.model);
        console.log('🔍 Detailed item property_description (first 100 chars):', detailedItem?.property_description?.substring(0, 100));
        console.log('🔍 Detailed item has model_1_response:', !!detailedItem?.model_1_response);
        console.log('🔍 Are items the same object?', detailedItem === item);
        setSelectedItem(detailedItem || item);
      } catch (error) {
        console.warn('Could not load detailed data:', error);
        setSelectedItem(item);
      }
    } else {
      console.log('🔍 No row_id found, using original item');
    setSelectedItem(item);
    }
    
    console.log('🔍 Opening sidebar');
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Model Property Analyzer</h1>
              <p className="text-gray-600 mt-1">Analyze and explore language model properties</p>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>{propertyData.length.toLocaleString()} properties</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                Dataset Loaded
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <nav className="flex space-x-8 px-6 py-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedView(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedView === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {selectedView === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{propertyData.length}</p>
                      <p className="text-sm text-gray-600">Properties</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {Array.from(new Set([
                          ...propertyData.map(p => p.model).filter(name => name && name !== 'Unknown')
                        ])).length}
                      </p>
                      <p className="text-sm text-gray-600">Unique Models</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">✅ Successfully Loaded Real Data!</h3>
                <div className="text-green-700 space-y-2">
                  <p>
                    Your model property dashboard is now ready with real data from your CSV files.
                  </p>
                  <div className="text-sm">
                    <p>• Loaded {propertyData.length} properties from {dataSources.properties}</p>
                    <p>• All interactive charts and analysis tools are now available</p>
                    <p>• OpenAI semantic search is configured and ready</p>
                  </div>
                </div>
              </div>
              
              {/* Model List */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-3">🤖 Models in Dataset</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Array.from(new Set([
                    ...propertyData.map(p => p.model).filter(name => name && name !== 'Unknown')
                  ])).sort().map((model, index) => (
                    <div key={index} className="text-sm px-2 py-1 bg-white rounded border">
                      {model}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedView === 'properties' && propertyData.length > 0 && (
            <InteractivePropertyChart 
              data={propertyData} 
              onViewResponse={handleViewProperty} 
            />
          )}

          {selectedView === 'search' && (
            <SemanticSearch 
              onViewResponse={(item) => {
                console.log('View search result:', item);
                setSelectedItem(item);
                setSidebarOpen(true);
              }} 
            />
          )}
        </div>
      </div>

      {/* Side Panel */}
      {sidebarOpen && selectedItem && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeSidebar}
            ></div>
            
            {/* Panel */}
            <section className="absolute inset-y-0 right-0 pl-8 max-w-full flex">
              <div className="relative w-screen max-w-6xl">
                <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
                  {/* Header */}
                  <div className="px-4 py-6 bg-gray-50 sm:px-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Eye className="h-6 w-6 text-gray-400" />
                        <h2 className="text-lg font-medium text-gray-900">
                          Property Details
                        </h2>
                      </div>
                      <div className="ml-3 h-7 flex items-center">
                        <button
                          onClick={closeSidebar}
                          className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <span className="sr-only">Close panel</span>
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-4 py-6 sm:px-6">
                    {selectedItem ? (
                    <div className="space-y-6">
                      {/* Property Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Model</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModelColor(selectedItem.model).badgeColor} ${getModelColor(selectedItem.model).textColor}`}>
                            {selectedItem.model}
                          </span>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Category</h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {selectedItem.category}
                          </span>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Impact</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedItem.impact === 'High' ? 'bg-red-100 text-red-800' :
                            selectedItem.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {selectedItem.impact}
                          </span>
                        </div>

                        {selectedItem.type && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Type</h4>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {selectedItem.type}
                            </span>
                          </div>
                        )}

                        {selectedItem.unexpected_behavior && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Unexpected Behavior</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedItem.unexpected_behavior.toLowerCase() === 'true' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {selectedItem.unexpected_behavior}
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Property Description</h3>
                        <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model).backgroundColor} ${getModelColor(selectedItem.model).borderColor}`}>
                          <ContentRenderer content={selectedItem.property_description} className="!bg-transparent !p-0" />
                        </div>
                      </div>

                      {selectedItem.evidence && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Evidence</h3>
                          <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model).backgroundColor} ${getModelColor(selectedItem.model).borderColor}`}>
                            <ContentRenderer content={selectedItem.evidence} className="!bg-transparent !p-0" />
                          </div>
                        </div>
                      )}

                      {selectedItem.reason && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Reason</h3>
                          <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model).backgroundColor} ${getModelColor(selectedItem.model).borderColor}`}>
                            <ContentRenderer content={selectedItem.reason} className="!bg-transparent !p-0" />
                          </div>
                        </div>
                      )}

                      {selectedItem.prompt && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Prompt</h3>
                          <ContentRenderer content={selectedItem.prompt} />
                        </div>
                      )}

                      {(selectedItem.model_1_response || selectedItem.model_2_response) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedItem.model_1_response && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {selectedItem.model_1_name} Response
                              </h3>
                              <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model_1_name || 'Model 1').backgroundColor} ${getModelColor(selectedItem.model_1_name || 'Model 1').borderColor}`}>
                                <ContentRenderer content={selectedItem.model_1_response} className="!bg-transparent !p-0" />
                              </div>
                            </div>
                          )}
                          
                          {selectedItem.model_2_response && (
                            <div>
                              <h3 className="text-sm font-medium text-gray-900 mb-2">
                                {selectedItem.model_2_name} Response
                              </h3>
                              <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model_2_name || 'Model 2').backgroundColor} ${getModelColor(selectedItem.model_2_name || 'Model 2').borderColor}`}>
                                <ContentRenderer content={selectedItem.model_2_response} className="!bg-transparent !p-0" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedItem.differences && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Differences</h3>
                          <ContentRenderer content={selectedItem.differences} />
                        </div>
                      )}

                      {selectedItem.parsed_differences && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Parsed Differences</h3>
                          <ContentRenderer content={selectedItem.parsed_differences} />
                        </div>
                      )}
                    </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Placeholder for loading */}
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDifferenceAnalyzer;