import React, { useState, useEffect } from 'react';
import { BarChart3, Users, GitCompare, Brain, Database } from 'lucide-react';
import InteractiveHierarchicalChart from './InteractiveHierarchicalChart';
import InteractivePropertyChart from './InteractivePropertyChart';
import SemanticSearch from './SemanticSearch';

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
  model_1_name?: string;
  model_2_name?: string;
  unexpected_behavior?: string;
}

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
  const [data, setData] = useState<DifferenceData[]>([]);
  const [propertyData, setPropertyData] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string>('overview');
  const [loadingStatus, setLoadingStatus] = useState<string>('Starting...');

  const loadDataSafely = async () => {
    try {
      setLoadingStatus('Testing CSV file availability...');
      console.log('🔄 Starting data loading process');
      
      // Test if CSV files are accessible
      setLoadingStatus('Checking first CSV file...');
      const response1 = await fetch('/qwen2_mistral_small.csv');
      console.log('📁 First CSV response status:', response1.status, response1.statusText);
      
      if (!response1.ok) {
        throw new Error(`First CSV file not accessible: ${response1.status} ${response1.statusText}`);
      }
      
      setLoadingStatus('Checking second CSV file...');
      const response2 = await fetch('/embedding_sample.csv');
      console.log('📁 Second CSV response status:', response2.status, response2.statusText);
      
      if (!response2.ok) {
        throw new Error(`Second CSV file not accessible: ${response2.status} ${response2.statusText}`);
      }
      
      // Load Papa Parse library
      setLoadingStatus('Loading CSV parser...');
      console.log('📚 Loading Papa Parse library');
      const Papa = (await import('papaparse')).default;
      console.log('✅ Papa Parse loaded successfully');
      
      // Load and parse first CSV with moderate preview
      setLoadingStatus('Reading first CSV content...');
      console.log('📖 Reading first CSV content');
      const csvContent1 = await response1.text();
      console.log('📊 First CSV size:', csvContent1.length, 'characters');
      
      setLoadingStatus('Parsing first CSV (expanded dataset)...');
      console.log('🔍 Parsing first CSV with preview of 500 rows');
      const parsedData1 = Papa.parse(csvContent1, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        preview: 500  // Increased to 500 rows
      });
      
      console.log('📈 First CSV parsed. Rows found:', parsedData1.data.length);
      console.log('🔍 First few rows sample:', parsedData1.data.slice(0, 3));
      
      if (parsedData1.errors && parsedData1.errors.length > 0) {
        console.warn('⚠️ Parsing errors in first CSV:', parsedData1.errors);
      }
      
      setLoadingStatus('Processing first CSV data...');
      const processedDifferences = parsedData1.data
        .filter((row: any) => row && row.difference)
        .slice(0, 300)  // Increased to 300 items
        .map((row: any) => ({
          difference: row.difference || '',
          category: row.category || 'Unknown',
          coarse_cluster_label: row.coarse_cluster_label,
          fine_cluster_label: row.fine_cluster_label,
          impact: row.impact || 'Low',
          reason: row.reason,
          type: row.type,
          prompt: row.prompt,
          a_evidence: row.a_evidence,
          b_evidence: row.b_evidence,
          model_1_response: row.model_1_response,
          model_2_response: row.model_2_response,
          model_1_name: row.model_1_name,
          model_2_name: row.model_2_name,
          unexpected_behavior: row.unexpected_behavior
        })) as DifferenceData[];
      
      console.log('✅ First CSV processed successfully. Final count:', processedDifferences.length);
      setData(processedDifferences);
      
      // Load and parse second CSV
      setLoadingStatus('Reading second CSV content...');
      console.log('📖 Reading second CSV content');
      const csvContent2 = await response2.text();
      console.log('📊 Second CSV size:', csvContent2.length, 'characters');
      
      setLoadingStatus('Parsing second CSV (expanded dataset)...');
      console.log('🔍 Parsing second CSV with preview of 500 rows');
      const parsedData2 = Papa.parse(csvContent2, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        preview: 500  // Increased to 500 rows
      });
      
      console.log('📈 Second CSV parsed. Rows found:', parsedData2.data.length);
      
      if (parsedData2.errors && parsedData2.errors.length > 0) {
        console.warn('⚠️ Parsing errors in second CSV:', parsedData2.errors);
      }
      
      setLoadingStatus('Processing second CSV data...');
      const processedProperties = parsedData2.data
        .filter((row: any) => row && row.property_description)
        .slice(0, 300)  // Increased to 300 items
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
      
      console.log('✅ Second CSV processed successfully. Final count:', processedProperties.length);
      setPropertyData(processedProperties);
      
      setLoadingStatus('Data loading completed successfully!');
      console.log('🎉 All data loaded successfully!');
      console.log('📊 Final counts - Differences:', processedDifferences.length, 'Properties:', processedProperties.length);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Data loading failed:', errorMessage);
      console.error('📍 Error details:', error);
      setError(`Failed to load data: ${errorMessage}`);
      setLoadingStatus(`Failed: ${errorMessage}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      console.log('🚀 App mounted, starting data load process');
      await loadDataSafely();
      setLoading(false);
    };
    
    loadData();
  }, []);

  console.log('🔄 App rendering. Loading:', loading, 'Error:', error);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Model Analysis Data</h2>
          <p className="text-gray-600 mb-4">Processing CSV files with enhanced error handling...</p>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">Status:</p>
            <p className="text-sm text-blue-700">{loadingStatus}</p>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Check browser console for detailed progress logs
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
            <h2 className="text-xl font-semibold mb-2">Error Loading Data</h2>
            <p className="mb-4">{error}</p>
            <div className="bg-red-50 p-3 rounded text-sm text-left mb-4">
              <p className="font-medium mb-2">Debugging Information:</p>
              <p>• Check browser console for detailed error logs</p>
              <p>• Current status: {loadingStatus}</p>
              <p>• Data loaded so far: {data.length} differences, {propertyData.length} properties</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
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
    { id: 'differences', label: 'Model Differences', icon: GitCompare },
    { id: 'properties', label: 'Property Analysis', icon: BarChart3 },
    { id: 'search', label: 'Semantic Search', icon: Brain }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Model Difference Analyzer</h1>
              <p className="text-gray-600 mt-1">Compare and analyze differences between language models</p>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>{data.length.toLocaleString()} differences</span>
              <span>•</span>
              <span>{propertyData.length.toLocaleString()} properties</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                Moderate Dataset
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <GitCompare className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{data.length}</p>
                      <p className="text-sm text-gray-600">Model Differences</p>
                    </div>
                  </div>
                </div>
                
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
                          ...data.map(d => d.model_1_name).filter(Boolean),
                          ...data.map(d => d.model_2_name).filter(Boolean),
                          ...propertyData.map(p => p.model).filter(Boolean)
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
                    Your model comparison dashboard is now ready with real data from your CSV files.
                  </p>
                  <div className="text-sm">
                    <p>• Loaded {data.length} model differences from qwen2_mistral_small.csv</p>
                    <p>• Loaded {propertyData.length} properties from embedding_sample.csv</p>
                    <p>• All interactive charts and analysis tools are now available</p>
                    <p>• OpenAI semantic search is configured and ready</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedView === 'differences' && data.length > 0 && (
            <InteractiveHierarchicalChart 
              data={data} 
              onViewResponse={item => console.log('View response:', item)} 
            />
          )}

          {selectedView === 'properties' && propertyData.length > 0 && (
            <InteractivePropertyChart 
              data={propertyData} 
              onViewResponse={item => console.log('View property:', item)} 
            />
          )}

          {selectedView === 'search' && (
            <SemanticSearch 
              onViewResponse={item => console.log('View search result:', item)} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelDifferenceAnalyzer;