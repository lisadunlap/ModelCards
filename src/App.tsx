import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, Filter, ChevronDown, ChevronRight, Info, TrendingUp, Eye } from 'lucide-react';

const ModelDifferenceAnalyzer = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Load and process data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fileContent = await window.fs.readFile('example_differences.csv', { encoding: 'utf8' });
      const Papa = (await import('papaparse')).default;
      
      const parsedData = Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });

      const processedData = parsedData.data.filter(row => row.difference);
      setData(processedData);
      setFilteredData(processedData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Filter data based on selections
  useEffect(() => {
    let filtered = data;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (selectedImpact !== 'all') {
      filtered = filtered.filter(item => item.impact === selectedImpact);
    }

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.difference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [data, selectedCategory, selectedImpact, searchTerm]);

  // Analytics calculations
  const categoryStats = data.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const impactStats = data.reduce((acc, item) => {
    acc[item.impact] = (acc[item.impact] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(categoryStats).map(([category, count]) => ({
    category,
    count
  }));

  const pieData = Object.entries(impactStats).map(([impact, count]) => ({
    name: impact,
    value: count
  }));

  const COLORS = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981'
  };

  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Model Difference Analysis</h1>
          <p className="text-gray-600 mt-1">Qwen2 vs Mistral Small Comparison</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
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
                <p className="text-2xl font-bold text-gray-900">{impactStats.High || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-yellow-500 rounded-full"></div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Medium Impact</p>
                <p className="text-2xl font-bold text-gray-900">{impactStats.Medium || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(categoryStats).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Differences by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
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
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
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
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {Object.keys(categoryStats).map(category => (
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
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{item.difference}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                        <button
                          onClick={() => toggleRowExpansion(index)}
                          className="flex items-center text-blue-600 hover:text-blue-800"
                        >
                          {expandedRows.has(index) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="ml-1">View Details</span>
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(index) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
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

                            <div className="mt-4">
                              <details className="group">
                                <summary className="cursor-pointer flex items-center text-blue-600 hover:text-blue-800 font-medium">
                                  <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                                  <span className="ml-1">View Full Model Responses</span>
                                </summary>
                                <div className="mt-3 space-y-4">
                                  <div>
                                    <h5 className="font-medium text-gray-900 mb-2">Qwen2 Full Response</h5>
                                    <div className="bg-blue-50 p-4 rounded border text-sm text-gray-700 max-h-60 overflow-y-auto">
                                      {item.model_1_response}
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-gray-900 mb-2">Mistral Small Full Response</h5>
                                    <div className="bg-purple-50 p-4 rounded border text-sm text-gray-700 max-h-60 overflow-y-auto">
                                      {item.model_2_response}
                                    </div>
                                  </div>
                                </div>
                              </details>
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
      </div>
    </div>
  );
};

export default ModelDifferenceAnalyzer;