import React, { useState, useEffect } from 'react';
import { BarChart3, Bot, Database, Brain, X, Eye, ExternalLink, TrendingUp, PenTool, FileSearch, MessageCircle, RefreshCw } from 'lucide-react';
import InteractivePropertyChart from './InteractivePropertyChart';
import SemanticSearch from './SemanticSearch';
import ModelSummaries from './ModelSummaries';
import KeywordSearch from './KeywordSearch';
import ViewResponses from './ViewResponses';
import ContentRenderer from './components/ContentRenderer';
import { getCurrentDataSources, validateDataSources, DATA_CONFIG, getPropertyFileOptions, setSelectedPropertyFile } from './config/dataSources';
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
  
  // Add state for data source selection
  const [selectedDataSource, setSelectedDataSource] = useState<string>('DBSCAN_HIERARCHICAL');
  const [isReloading, setIsReloading] = useState(false);
  
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
      
      console.log('✅ Data loaded successfully. Original count:', processedProperties.length);

      // Data preprocessing: remove outliers
      const filteredProperties = processedProperties.filter(
        p => p.property_description_fine_cluster_label !== "Outliers"
      );
      console.log(`✅ Filtered out ${processedProperties.length - filteredProperties.length} outlier rows. New count: ${filteredProperties.length}`);
      
      // Debug: Show all unique models found
      const allModels = Array.from(new Set([
        ...filteredProperties.map(p => p.model).filter(name => name && name !== 'Unknown')
      ]));
      
      console.log('🎯 All unique models found:', allModels);
      console.log('📊 Total unique models:', allModels.length);
      
      setPropertyData(filteredProperties);
      
      // Initialize global model colors
      const allUniqueModels = Array.from(new Set([
        ...filteredProperties.map(p => p.model).filter(name => name && name !== 'Unknown'),
        ...filteredProperties.map(p => p.model_1_name).filter(name => name && name !== 'Unknown' && name !== ''),
        ...filteredProperties.map(p => p.model_2_name).filter(name => name && name !== 'Unknown' && name !== ''),
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

  // Handle data source change
  const handleDataSourceChange = async (newDataSource: string) => {
    try {
      setIsReloading(true);
      setSelectedDataSource(newDataSource);
      
      // Update the configuration
      setSelectedPropertyFile(newDataSource as keyof typeof import('./config/dataSources').DATA_SOURCES.PROPERTY_FILES);
      
      // Clear existing data
      setPropertyData([]);
      setLoading(true);
      setError(null);
      
      // Reload data with new source
      await loadDataSafely();
      
    } catch (error) {
      console.error('Error changing data source:', error);
      setError(error instanceof Error ? error.message : 'Failed to change data source');
    } finally {
      setIsReloading(false);
    }
  };

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
    { id: 'summaries', label: 'Summaries', icon: TrendingUp },
    { id: 'properties', label: 'Property Analysis', icon: BarChart3 },
    { id: 'keyword-search', label: 'Keyword Search', icon: FileSearch },
    // { id: 'search', label: 'Semantic Search', icon: Brain },
    { id: 'view-responses', label: 'View Responses', icon: MessageCircle }
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
        <div className="max-w-full mx-auto px-2 py-4">
          {/* Data Source Selector */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="h-5 w-5 text-blue-600" />
                <label className="text-sm font-medium text-blue-900">
                  Data Source:
                </label>
                <select
                  value={selectedDataSource}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                  disabled={loading || isReloading}
                  className="border border-blue-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getPropertyFileOptions().map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                {isReloading && (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Reloading...</span>
                  </div>
                )}
                <span className="text-blue-600">
                  {getCurrentDataSources().selectedPropertyConfig?.description}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">The ULTIMATE Vibe Checker</h1>
              <p className="text-gray-600 mt-1">Analyze and explore properties of generative models</p>
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

      <div className="max-w-full mx-auto px-2 py-6">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Bot className="h-8 w-8 text-purple-600 mr-3" />
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
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <PenTool className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {Array.from(new Set([
                          ...propertyData.map(p => p.prompt).filter(prompt => prompt && prompt.trim() !== '')
                        ])).length}
                      </p>
                      <p className="text-sm text-gray-600">Unique Prompts</p>
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
                    <p>• Loaded {propertyData.length} properties</p>
                    <p>• Data source: <strong>{getCurrentDataSources().selectedPropertyConfig?.label}</strong></p>
                    <p>• File: <code className="bg-green-100 px-1 rounded text-xs">{getCurrentDataSources().properties}</code></p>
                    <p>• All interactive charts and analysis tools are now available</p>
                    <p>• OpenAI semantic search is configured and ready</p>
                  </div>
                </div>
              </div>
              
              {/* Analysis Tools Guide */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-4">🧭 Analysis Tools Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedView('summaries')}
                    className="bg-white rounded-lg p-4 border-l-4 border-green-400 hover:bg-green-50 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                      <h4 className="font-medium text-gray-900">Summaries</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Get high-level overviews of how different models perform across property clusters. 
                      See top clusters by proportion for each model with interactive filtering.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedView('properties')}
                    className="bg-white rounded-lg p-4 border-l-4 border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center mb-2">
                      <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
                      <h4 className="font-medium text-gray-900">Property Analysis</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Dive deep into hierarchical clustering data with interactive charts. 
                      Explore coarse/fine clusters, drill down by category, and examine individual properties.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedView('keyword-search')}
                    className="bg-white rounded-lg p-4 border-l-4 border-purple-400 hover:bg-purple-50 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center mb-2">
                      <FileSearch className="h-5 w-5 text-purple-600 mr-2" />
                      <h4 className="font-medium text-gray-900">Keyword Search</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Find property clusters using keyword search with smart relevance scoring. 
                      Search cluster names and descriptions, see model distributions with expandable details.
                    </p>
                  </button>

                  <button
                    onClick={() => setSelectedView('view-responses')}
                    className="bg-white rounded-lg p-4 border-l-4 border-orange-400 hover:bg-orange-50 hover:shadow-md transition-all duration-200 text-left cursor-pointer"
                  >
                    <div className="flex items-center mb-2">
                      <MessageCircle className="h-5 w-5 text-orange-600 mr-2" />
                      <h4 className="font-medium text-gray-900">View Responses</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Compare actual model conversations side-by-side. Search for specific prompts 
                      or use "Surprise Me!" to randomly explore model battles and responses.
                    </p>
                  </button>
                </div>
              </div>
              
              {/* Model List */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-3">🤖 Models in Dataset</h3>
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

          {selectedView === 'summaries' && propertyData.length > 0 && (
            <ModelSummaries 
              data={propertyData} 
              onViewResponse={handleViewProperty}
            />
          )}

          {selectedView === 'keyword-search' && propertyData.length > 0 && (
            <KeywordSearch 
              data={propertyData}
              onViewResponse={handleViewProperty}
            />
          )}

          {selectedView === 'view-responses' && propertyData.length > 0 && (
            <ViewResponses 
              data={propertyData}
              onViewResponse={handleViewProperty}
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

                      {/* Always show prompt section prominently */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Prompt</h3>
                        <div className="p-3 rounded-md border-l-4 border-gray-400 bg-gray-50">
                          {selectedItem.prompt ? (
                            <ContentRenderer content={selectedItem.prompt} className="!bg-transparent !p-0" />
                          ) : (
                            <p className="text-gray-500 italic">No prompt available</p>
                          )}
                        </div>
                      </div>

                      {selectedItem.reason && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Reason</h3>
                          <div className={`p-3 rounded-md border-l-4 ${getModelColor(selectedItem.model).backgroundColor} ${getModelColor(selectedItem.model).borderColor}`}>
                            <ContentRenderer content={selectedItem.reason} className="!bg-transparent !p-0" />
                          </div>
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