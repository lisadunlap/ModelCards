import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, Filter, ChevronDown, ChevronRight, Info, TrendingUp, Eye, X, ArrowLeft, Loader2, BarChart3 } from 'lucide-react';
import InteractiveHierarchicalChart from './InteractiveHierarchicalChart';

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

// Simple markdown renderer component
const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
  if (!content) return null;

  // Split content by code blocks (```...```)
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <div>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // This is a code block
          const codeContent = part.slice(3, -3).trim();
          const lines = codeContent.split('\n');
          const language = lines[0].match(/^[a-zA-Z]+$/) ? lines.shift() : '';
          const code = lines.join('\n');
          
          return (
            <pre key={index} className="bg-gray-800 text-green-400 p-3 rounded mt-2 mb-2 overflow-x-auto text-sm">
              {language && <div className="text-gray-400 text-xs mb-1">{language}</div>}
              <code>{code}</code>
            </pre>
          );
        } else {
          // Regular text with basic markdown
          // Split by paragraphs (double newlines)
          const paragraphs = part.split(/\n\s*\n/);
          
          return (
            <div key={index}>
              {paragraphs.map((paragraph, pIndex) => {
                if (!paragraph.trim()) return null;
                
                // Process each line in the paragraph
                const lines = paragraph.split('\n');
                
                return (
                  <div key={pIndex} className="mb-3">
                    {lines.map((line, lineIndex) => {
                      // Handle numbered lists
                      const numberedListMatch = line.match(/^(\d+)\.\s+(.+)/);
                      if (numberedListMatch) {
                        const processedText = processInlineMarkdown(numberedListMatch[2]);
                        return (
                          <div key={lineIndex} className="ml-4 mb-1">
                            <span className="font-semibold text-blue-600">{numberedListMatch[1]}.</span> 
                            <span dangerouslySetInnerHTML={{ __html: processedText }} />
                          </div>
                        );
                      }
                      
                      // Handle bullet points
                      if (line.match(/^[-*]\s+/)) {
                        const bulletText = line.replace(/^[-*]\s+/, '');
                        const processedText = processInlineMarkdown(bulletText);
                        return (
                          <div key={lineIndex} className="ml-4 mb-1">
                            <span className="text-blue-600 mr-2">•</span>
                            <span dangerouslySetInnerHTML={{ __html: processedText }} />
                          </div>
                        );
                      }
                      
                      // Handle headers
                      if (line.startsWith('###')) {
                        const headerText = line.replace(/^###\s*/, '');
                        return <h3 key={lineIndex} className="text-lg font-semibold mt-3 mb-2 text-gray-800">{headerText}</h3>;
                      }
                      if (line.startsWith('##')) {
                        const headerText = line.replace(/^##\s*/, '');
                        return <h2 key={lineIndex} className="text-xl font-bold mt-4 mb-2 text-gray-800">{headerText}</h2>;
                      }
                      if (line.startsWith('#')) {
                        const headerText = line.replace(/^#\s*/, '');
                        return <h1 key={lineIndex} className="text-2xl font-bold mt-4 mb-3 text-gray-800">{headerText}</h1>;
                      }
                      
                      // Regular text
                      if (line.trim()) {
                        const processedText = processInlineMarkdown(line);
                        return (
                          <div key={lineIndex} className="mb-1">
                            <span dangerouslySetInnerHTML={{ __html: processedText }} />
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                );
              })}
            </div>
          );
        }
      })}
    </div>
  );
};

// Helper function to process inline markdown
const processInlineMarkdown = (text: string): string => {
  // Handle bold text **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
  // Handle italic text *text*
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
  // Handle inline code `code`
  text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
  // Handle links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return text;
};

const ModelDifferenceAnalyzer = () => {
  const [data, setData] = useState<DifferenceData[]>([]);
  const [filteredData, setFilteredData] = useState<DifferenceData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCoarseCluster, setSelectedCoarseCluster] = useState('all');
  const [selectedFineCluster, setSelectedFineCluster] = useState('all');
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedUnexpectedBehavior, setSelectedUnexpectedBehavior] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [chartView, setChartView] = useState<'coarse' | 'fine' | 'category'>('category');
  const [selectedResponseItem, setSelectedResponseItem] = useState<DifferenceData | null>(null);
  const [showResponsePanel, setShowResponsePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'experimental'>('overview');

  // Load and process data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting to load CSV file...');
      
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Loading timeout - file too large')), 30000); // 30 second timeout
      });
      
      // Try to load the main CSV file with timeout protection
      try {
        console.log('Attempting to load main CSV file...');
        const response = await Promise.race([
          fetch('./qwen2_mistral_small.csv'),
          timeoutPromise
        ]) as Response;
        
        console.log('Fetch response:', response.status, response.ok);
        
        if (response.ok) {
          console.log('Reading file content...');
          const fileContent = await Promise.race([
            response.text(),
            timeoutPromise
          ]) as string;
          
          console.log('File content length:', fileContent.length);
          
          // Check if file is extremely large (>5MB of text)
          if (fileContent.length > 5 * 1024 * 1024) {
            throw new Error('File too large, using fallback data');
          }
          
          console.log('Loading Papa Parse...');
          const Papa = (await import('papaparse')).default;
          
          console.log('Parsing CSV...');
          const parsedData = await new Promise<any>((resolve, reject) => {
            // Use Papa Parse worker for better performance with large files
            Papa.parse(fileContent, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              delimitersToGuess: [',', '\t', '|', ';'],
              complete: resolve,
              error: reject,
              // Add chunk processing for large files
              step: (results) => {
                // Process in chunks to prevent blocking
                if (results.errors.length > 0) {
                  console.warn('Parse errors:', results.errors);
                }
              }
            });
          });

          console.log('Parse result:', {
            dataLength: parsedData.data.length,
            errorsLength: parsedData.errors.length,
            fieldsLength: parsedData.meta?.fields?.length
          });

          if (parsedData.errors.length > 0) {
            console.warn('CSV parsing errors:', parsedData.errors);
          }

          const processedData = parsedData.data.filter((row: any) => row.difference) as DifferenceData[];
          console.log('Processed data length:', processedData.length);
          
          if (processedData.length === 0) {
            throw new Error('No valid data found in main CSV file');
          }
          
          setData(processedData);
          setFilteredData(processedData);
          console.log('Main data set successfully!');
          return;
        }
      } catch (mainError) {
        console.log('Main CSV failed or timed out:', mainError);
        console.log('Falling back to example CSV...');
      }
      
      // Fallback to example CSV
      console.log('Loading fallback CSV...');
      const fallbackResponse = await fetch('./example_differences.csv');
      if (!fallbackResponse.ok) {
        throw new Error(`Failed to fetch fallback CSV file: ${fallbackResponse.status}`);
      }
      
      const fileContent = await fallbackResponse.text();
      console.log('Fallback file content length:', fileContent.length);
      
      const Papa = (await import('papaparse')).default;
      const parsedData = Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });

      const processedData = parsedData.data.filter((row: any) => row.difference) as DifferenceData[];
      console.log('Fallback data length:', processedData.length);
      
      setData(processedData);
      setFilteredData(processedData);
      console.log('Fallback data set successfully!');
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
      console.log('Loading complete');
    }
  };

  // Memoize expensive calculations
  const stats = useMemo(() => {
    const categoryStats = data.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const coarseClusterStats: Record<string, number> = data.reduce((acc, item) => {
      if (item.coarse_cluster_label) {
        acc[item.coarse_cluster_label] = (acc[item.coarse_cluster_label] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const fineClusterStats: Record<string, number> = data.reduce((acc, item) => {
      if (item.fine_cluster_label) {
        acc[item.fine_cluster_label] = (acc[item.fine_cluster_label] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const impactStats: Record<string, number> = data.reduce((acc, item) => {
      acc[item.impact] = (acc[item.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeStats: Record<string, number> = data.reduce((acc, item) => {
      if (item.type) {
        acc[item.type] = (acc[item.type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const unexpectedBehaviorStats: Record<string, number> = data.reduce((acc, item) => {
      if (item.unexpected_behavior) {
        acc[item.unexpected_behavior] = (acc[item.unexpected_behavior] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const unexpectedBehaviorTrueCount = data.filter(item => 
      item.unexpected_behavior && item.unexpected_behavior.toLowerCase() === 'true'
    ).length;

    return {
      categoryStats,
      coarseClusterStats,
      fineClusterStats,
      impactStats,
      typeStats,
      unexpectedBehaviorStats,
      unexpectedBehaviorTrueCount
    };
  }, [data]);

  // Filter data based on selections with memoization
  useEffect(() => {
    let filtered = data;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (selectedCoarseCluster !== 'all') {
      filtered = filtered.filter(item => item.coarse_cluster_label === selectedCoarseCluster);
    }

    if (selectedFineCluster !== 'all') {
      filtered = filtered.filter(item => item.fine_cluster_label === selectedFineCluster);
    }

    if (selectedImpact !== 'all') {
      filtered = filtered.filter(item => item.impact === selectedImpact);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    if (selectedUnexpectedBehavior !== 'all') {
      filtered = filtered.filter(item => item.unexpected_behavior === selectedUnexpectedBehavior);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.difference?.toLowerCase().includes(searchLower) ||
        item.reason?.toLowerCase().includes(searchLower) ||
        item.unexpected_behavior?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.coarse_cluster_label?.toLowerCase().includes(searchLower) ||
        item.fine_cluster_label?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredData(filtered);
  }, [data, selectedCategory, selectedCoarseCluster, selectedFineCluster, selectedImpact, selectedType, selectedUnexpectedBehavior, searchTerm]);

  // Memoize chart data
  const getChartData = useMemo(() => {
    switch (chartView) {
      case 'coarse':
        return Object.entries(stats.coarseClusterStats).map(([label, count]) => ({
          category: label,
          count
        }));
      case 'fine':
        return Object.entries(stats.fineClusterStats).map(([label, count]) => ({
          category: label,
          count
        }));
      default:
        return Object.entries(stats.categoryStats).map(([category, count]) => ({
    category,
    count
  }));
    }
  }, [chartView, stats]);

  const pieData = useMemo(() => 
    Object.entries(stats.impactStats).map(([impact, count]) => ({
    name: impact,
    value: count
    }))
  , [stats.impactStats]);

  const getChartTitle = () => {
    switch (chartView) {
      case 'coarse':
        return 'Differences by Coarse Cluster';
      case 'fine':
        return 'Differences by Fine Cluster';
      default:
        return 'Differences by Category';
    }
  };

  const COLORS: Record<string, string> = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981'
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const openResponsePanel = (item: DifferenceData) => {
    setSelectedResponseItem(item);
    setShowResponsePanel(true);
  };

  const closeResponsePanel = () => {
    setShowResponsePanel(false);
    setSelectedResponseItem(null);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Data...</h2>
          <p className="text-gray-600">Processing CSV file and building interface</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-semibold mb-2">Error Loading Data</h2>
            <p>{error}</p>
          </div>
          <button
            onClick={loadData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Model Difference Analysis</h1>
          <p className="text-gray-600 mt-1">Qwen2 vs Mistral Small Comparison</p>
          
          {/* Tab Navigation */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview & Analysis
              </button>
              <button
                onClick={() => setActiveTab('experimental')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-1 ${
                  activeTab === 'experimental'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Interactive Drill-Down</span>
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                  Experimental
                </span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Differences</p>
                    <p className="text-2xl font-bold text-gray-900">{data.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-red-500 rounded-full"></div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">High Impact</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.impactStats['High'] || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-orange-500 rounded-full"></div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Unexpected Behavior</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.unexpectedBehaviorTrueCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Categories</p>
                    <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.categoryStats).length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{getChartTitle()}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setChartView('coarse')}
                      className={`px-3 py-1 text-sm rounded ${
                        chartView === 'coarse' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Coarse
                    </button>
                    <button
                      onClick={() => setChartView('fine')}
                      className={`px-3 py-1 text-sm rounded ${
                        chartView === 'fine' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Fine
                    </button>
                    <button
                      onClick={() => setChartView('category')}
                      className={`px-3 py-1 text-sm rounded ${
                        chartView === 'category' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Category
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Impact Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2">
                  <Search className="h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search differences..."
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedCoarseCluster}
                    onChange={(e) => setSelectedCoarseCluster(e.target.value)}
                  >
                    <option value="all">All Coarse Clusters</option>
                    {Object.keys(stats.coarseClusterStats).map(cluster => (
                      <option key={cluster} value={cluster}>{cluster}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedFineCluster}
                    onChange={(e) => setSelectedFineCluster(e.target.value)}
                  >
                    <option value="all">All Fine Clusters</option>
                    {Object.keys(stats.fineClusterStats).map(cluster => (
                      <option key={cluster} value={cluster}>{cluster}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {Object.keys(stats.categoryStats).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedImpact}
                    onChange={(e) => setSelectedImpact(e.target.value)}
                  >
                    <option value="all">All Impact Levels</option>
                    <option value="High">High Impact</option>
                    <option value="Medium">Medium Impact</option>
                    <option value="Low">Low Impact</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    {Object.keys(stats.typeStats).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedUnexpectedBehavior}
                    onChange={(e) => setSelectedUnexpectedBehavior(e.target.value)}
                  >
                    <option value="all">All Behaviors</option>
                    {Object.keys(stats.unexpectedBehaviorStats).map(behavior => (
                      <option key={behavior} value={behavior}>{behavior}</option>
                    ))}
                  </select>
                </div>

                <div className="text-sm text-gray-600">
                  Showing {filteredData.length} of {data.length} differences
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Analysis</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Difference
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
                        Unexpected Behavior
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((item, index) => (
                      <React.Fragment key={index}>
                        <tr className="hover:bg-gray-50">
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
                            <div className="flex space-x-2">
                            <button
                              onClick={() => toggleRowExpansion(index)}
                              className="flex items-center text-blue-600 hover:text-blue-800"
                            >
                              {expandedRows.has(index) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="ml-1">Details</span>
                              </button>
                              <button
                                onClick={() => openResponsePanel(item)}
                                className="flex items-center text-purple-600 hover:text-purple-800 font-medium transition-colors"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                <span>Responses</span>
                            </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows.has(index) && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-gray-50">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Prompt</h4>
                                  <div className="bg-white p-3 rounded border text-sm text-gray-700 italic">
                                    "{item.prompt}"
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Reason</h4>
                                  <p className="text-sm text-gray-700">{item.reason}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Qwen2 Evidence</h4>
                                    <div className="bg-white p-3 rounded border text-sm text-gray-700">
                                      {item.a_evidence}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Mistral Small Evidence</h4>
                                    <div className="bg-white p-3 rounded border text-sm text-gray-700">
                                      {item.b_evidence}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Experimental Interactive Hierarchical Chart Tab */
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Interactive Hierarchical Drill-Down</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Click on bars to drill down through the hierarchy: Coarse Clusters → Fine Clusters → Categories → Individual Data Items. 
                    Use the breadcrumb navigation to move back up levels.
                  </p>
                </div>
              </div>
            </div>
            
            <InteractiveHierarchicalChart 
              data={data} 
              onViewResponse={openResponsePanel}
            />
          </div>
        )}

        {/* Model Responses Side Panel */}
        {showResponsePanel && selectedResponseItem && (
          <div className="fixed inset-0 z-50 flex">
            {/* Background overlay */}
            <div 
              className="flex-1 bg-black bg-opacity-50 cursor-pointer"
              onClick={closeResponsePanel}
            />
            
            {/* Side panel */}
            <div className="w-2/3 bg-white shadow-2xl flex flex-col h-full">
              {/* Header */}
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={closeResponsePanel}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">Analysis Details & Model Comparison</h3>
                  </div>
                  <button
                    onClick={closeResponsePanel}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
                
                {/* Context info */}
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Difference:</span> {selectedResponseItem.difference}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedResponseItem.coarse_cluster_label && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {selectedResponseItem.coarse_cluster_label}
                      </span>
                    )}
                    {selectedResponseItem.fine_cluster_label && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {selectedResponseItem.fine_cluster_label}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedResponseItem.category}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      selectedResponseItem.impact === 'High' ? 'bg-red-100 text-red-800' :
                      selectedResponseItem.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {selectedResponseItem.impact} Impact
                    </span>
                    {selectedResponseItem.unexpected_behavior && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        {selectedResponseItem.unexpected_behavior}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Prompt */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">Prompt</h4>
                  <div className="bg-white p-3 rounded border text-sm text-gray-700 italic">
                    "{selectedResponseItem.prompt}"
                  </div>
                </div>

                {/* Reason */}
                {selectedResponseItem.reason && (
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">Reason for Difference</h4>
                    <p className="text-sm text-gray-700">{selectedResponseItem.reason}</p>
                  </div>
                )}

                {/* Evidence Section */}
                {(selectedResponseItem.a_evidence || selectedResponseItem.b_evidence) && (
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Evidence Comparison</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {selectedResponseItem.a_evidence && (
                        <div>
                          <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                            Qwen2 Evidence
                          </h5>
                          <div className="bg-blue-50 p-3 rounded border text-sm text-gray-700">
                            {selectedResponseItem.a_evidence}
                          </div>
                        </div>
                      )}
                      {selectedResponseItem.b_evidence && (
                        <div>
                          <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                            Mistral Small Evidence
                          </h5>
                          <div className="bg-purple-50 p-3 rounded border text-sm text-gray-700">
                            {selectedResponseItem.b_evidence}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Model Responses */}
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Full Model Responses</h4>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Qwen2 Response */}
                    <div className="flex flex-col">
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-900 flex items-center">
                          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                          Qwen2 Full Response
                        </h5>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                        <div className="p-4 max-h-96 overflow-y-auto">
                          <SimpleMarkdownRenderer content={selectedResponseItem.model_1_response || ''} />
                        </div>
                      </div>
                    </div>

                    {/* Mistral Small Response */}
                    <div className="flex flex-col">
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-900 flex items-center">
                          <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                          Mistral Small Full Response
                        </h5>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                        <div className="p-4 max-h-96 overflow-y-auto">
                          <SimpleMarkdownRenderer content={selectedResponseItem.model_2_response || ''} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelDifferenceAnalyzer;