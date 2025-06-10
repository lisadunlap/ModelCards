import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Database, Brain, X, Eye, ExternalLink } from 'lucide-react';
import InteractiveHierarchicalChart from './InteractiveHierarchicalChart';
import InteractivePropertyChart from './InteractivePropertyChart';
import SemanticSearch from './SemanticSearch';
import ContentRenderer from './components/ContentRenderer';
import { getCurrentDataSources, validateDataSources, DATA_CONFIG } from './config/dataSources';

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

const ModelDifferenceAnalyzer = () => {
  const [propertyData, setPropertyData] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('overview');
  const [loadingStatus, setLoadingStatus] = useState<string>('Starting...');
  
  // Add state for side panel
  const [selectedItem, setSelectedItem] = useState<PropertyData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Track model color assignments to detect collisions
  const modelColorAssignments = React.useRef<Map<string, { color: string; models: string[] }>>(new Map());

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
      setLoadingStatus('Validating data source configuration...');
      console.log('🔄 Starting data loading process');
      
      // Validate data sources configuration
      validateDataSources();
      const dataSources = getCurrentDataSources();
      console.log('📋 Using data sources:', dataSources);
      
      // Test if properties CSV file is accessible
      setLoadingStatus('Checking properties CSV file...');
      const response = await fetch(dataSources.properties);
      console.log('📁 Properties CSV response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Properties CSV file not accessible: ${response.status} ${response.statusText}. Path: ${dataSources.properties}`);
      }
      
      // Load Papa Parse library
      setLoadingStatus('Loading CSV parser...');
      console.log('📚 Loading Papa Parse library');
      const Papa = (await import('papaparse')).default;
      console.log('✅ Papa Parse loaded successfully');
      
      // Helper function to randomly sample rows from parsed data
      const randomSample = (data: any[], maxRows: number = 10000): any[] => {
        if (data.length <= maxRows) {
          return data;
        }
        
        console.log(`🎲 Randomly sampling ${maxRows} rows from ${data.length} total rows`);
        const shuffled = [...data];
        
        // Fisher-Yates shuffle algorithm for random sampling
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled.slice(0, maxRows);
      };
      
      // Load and parse properties CSV with size check
      setLoadingStatus('Reading properties CSV content...');
      console.log('📖 Reading properties CSV content');
      const csvContent = await response.text();
      const csvSizeMB = csvContent.length / (1024 * 1024);
      console.log('📊 Properties CSV size:', csvContent.length, 'characters', `(${csvSizeMB.toFixed(2)} MB)`);
      
      setLoadingStatus('Parsing properties CSV...');
      console.log('🔍 Parsing properties CSV');
      
      // Parse without preview limit first to get full dataset for sampling
      const parsedData = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: DATA_CONFIG.ENABLE_DYNAMIC_TYPING,
        skipEmptyLines: DATA_CONFIG.SKIP_EMPTY_LINES,
      }) as any;
      
      console.log('📈 Properties CSV parsed. Total rows found:', parsedData.data?.length || 0);
      
      if (parsedData.errors && parsedData.errors.length > 0) {
        console.warn('⚠️ Parsing errors in properties CSV:', parsedData.errors);
      }
      
      // Apply random sampling if dataset is large
      const MAX_ROWS = 10000;
      let sampledData = parsedData.data || [];
      let wasDataSampled = false;
      
      if (sampledData.length > MAX_ROWS) {
        setLoadingStatus(`Dataset is large (${sampledData.length} rows). Randomly sampling ${MAX_ROWS} rows...`);
        sampledData = randomSample(sampledData, MAX_ROWS);
        wasDataSampled = true;
        console.log(`🎯 Sampled ${sampledData.length} rows from properties CSV`);
      }
      
      setLoadingStatus('Processing properties data...');
      const processedProperties = sampledData
        .filter((row: any) => row && row.property_description)
        .map((row: any) => ({
          prompt: row.prompt || '',
          model_1_response: row.model_1_response || '',
          model_2_response: row.model_2_response || '',
          model_1_name: row.model_1_name || '',
          model_2_name: row.model_2_name || '',
          differences: row.differences || '',
          parsed_differences: row.parsed_differences || '',
          parse_error: row.parse_error,
          model: row.model || 'Unknown',
          property_description: row.property_description || '',
          category: row.category || 'Unknown',
          evidence: row.evidence || '',
          type: row.type || '',
          reason: row.reason || '',
          impact: row.impact || 'Low',
          unexpected_behavior: row.unexpected_behavior,
          property_description_coarse_cluster_label: row.property_description_coarse_cluster_label || 'Unknown',
          property_description_fine_cluster_label: row.property_description_fine_cluster_label || 'Unknown',
          property_description_coarse_cluster_id: row.property_description_coarse_cluster_id || 0,
          property_description_fine_cluster_id: row.property_description_fine_cluster_id || 0
        })) as PropertyData[];
      
      console.log('✅ Properties CSV processed successfully. Final count:', processedProperties.length);
      if (wasDataSampled) {
        console.log('🎲 Properties CSV was randomly sampled to prevent performance issues');
      }
      setPropertyData(processedProperties);
      
      // Debug: Show all unique models found
      const allModels = Array.from(new Set([
        ...processedProperties.map(p => p.model).filter(name => name && name !== 'Unknown')
      ]));
      
      console.log('🎯 All unique models found:', allModels);
      console.log('📊 Total unique models:', allModels.length);
      
      // Update loading status with sampling information
      let statusMessage = 'Data loading completed successfully!';
      if (wasDataSampled) {
        statusMessage += ' Large dataset was randomly sampled for optimal performance.';
      }
      setLoadingStatus(statusMessage);
      
      console.log('🎉 All data loaded successfully!');
      console.log('📊 Final count - Properties:', processedProperties.length);
      if (wasDataSampled) {
        console.log('🎲 Data was randomly sampled to prevent performance issues');
      }
      
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
          <p className="text-gray-600 mb-4">{loadingStatus}</p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800 font-medium mb-2">📊 What's Loading:</p>
            <div className="text-blue-700 text-sm space-y-1">
              <p>• Data loaded so far: {propertyData.length} properties</p>
              <p>• Processing and validating CSV files</p>
              <p>• Preparing interactive visualizations</p>
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

  // Add handlers for viewing responses
  const handleViewProperty = (item: PropertyData) => {
    console.log('View property:', item);
    setSelectedItem(item);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedItem(null);
  };

  // Generate light background color for model identification
  const getModelColor = (modelName: string | undefined | null): { backgroundColor: string; borderColor: string } => {
    if (!modelName || modelName === 'Unknown') {
      return { backgroundColor: 'bg-neutral-50', borderColor: 'border-neutral-200' };
    }
    
    // Enhanced hash function with better collision resistance
    let hash = 0;
    const str = modelName.toLowerCase().trim(); // Normalize case and trim whitespace
    
    // Use multiple hash passes for better distribution
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Additional mixing with different constants to reduce patterns
    hash = Math.abs(hash);
    const mixed1 = (hash * 2654435761) % (2 ** 32); // Large prime multiplier
    const mixed2 = (mixed1 * 16777619) % (2 ** 32);  // FNV prime for additional mixing
    const finalHash = mixed2 ^ (mixed2 >>> 16);       // XOR with shifted version for better distribution
    
    // Vibrant color schemes only - no grey/neutral colors to avoid confusion
    const colorSchemes = [
      { backgroundColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      { backgroundColor: 'bg-green-50', borderColor: 'border-green-200' },
      { backgroundColor: 'bg-purple-50', borderColor: 'border-purple-200' },
      { backgroundColor: 'bg-orange-50', borderColor: 'border-orange-200' },
      { backgroundColor: 'bg-pink-50', borderColor: 'border-pink-200' },
      { backgroundColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
      { backgroundColor: 'bg-teal-50', borderColor: 'border-teal-200' },
      { backgroundColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
      { backgroundColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
      { backgroundColor: 'bg-amber-50', borderColor: 'border-amber-200' },
      { backgroundColor: 'bg-lime-50', borderColor: 'border-lime-200' },
      { backgroundColor: 'bg-rose-50', borderColor: 'border-rose-200' },
      { backgroundColor: 'bg-violet-50', borderColor: 'border-violet-200' },
      { backgroundColor: 'bg-sky-50', borderColor: 'border-sky-200' },
      { backgroundColor: 'bg-red-50', borderColor: 'border-red-200' },
      { backgroundColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
      { backgroundColor: 'bg-fuchsia-50', borderColor: 'border-fuchsia-200' },
      { backgroundColor: 'bg-emerald-100', borderColor: 'border-emerald-300' }, // Slightly deeper variants
      { backgroundColor: 'bg-blue-100', borderColor: 'border-blue-300' },
      { backgroundColor: 'bg-purple-100', borderColor: 'border-purple-300' },
    ];
    
    const colorIndex = finalHash % colorSchemes.length;
    const selectedColor = colorSchemes[colorIndex];
    
    // Track color assignments to detect collisions
    const colorKey = selectedColor.backgroundColor;
    const assignments = modelColorAssignments.current;
    
    if (assignments.has(colorKey)) {
      const existing = assignments.get(colorKey)!;
      if (!existing.models.includes(modelName)) {
        existing.models.push(modelName);
        // Log collision warning
        console.warn(`🚨 COLOR COLLISION DETECTED! Color ${colorKey} assigned to multiple models:`, existing.models);
      }
    } else {
      assignments.set(colorKey, { color: colorKey, models: [modelName] });
    }
    
    // Enhanced debug logging to track potential collisions and help identify grey assignments
    console.log(`🎨 Model Color Assignment: "${modelName}" -> Hash: ${hash} -> Final: ${finalHash} -> Index: ${colorIndex} -> ${selectedColor.backgroundColor}`);
    
    return selectedColor;
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
            <section className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="relative w-screen max-w-4xl">
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                        <ContentRenderer content={selectedItem.property_description} />
                      </div>

                      {selectedItem.evidence && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Evidence</h3>
                          <ContentRenderer content={selectedItem.evidence} />
                        </div>
                      )}

                      {selectedItem.reason && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">Reason</h3>
                          <ContentRenderer content={selectedItem.reason} />
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