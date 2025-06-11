// Shared model color configuration for consistent theming across the application

export interface ModelColorScheme {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  chartColor: string; // For charts and visualizations
}

export const MODEL_COLOR_PALETTE: ModelColorScheme[] = [
  { backgroundColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-800', badgeColor: 'bg-blue-100', chartColor: '#3b82f6' },
  { backgroundColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-800', badgeColor: 'bg-green-100', chartColor: '#10b981' },
  { backgroundColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-800', badgeColor: 'bg-purple-100', chartColor: '#8b5cf6' },
  { backgroundColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-800', badgeColor: 'bg-orange-100', chartColor: '#f97316' },
  { backgroundColor: 'bg-pink-50', borderColor: 'border-pink-200', textColor: 'text-pink-800', badgeColor: 'bg-pink-100', chartColor: '#ec4899' },
  { backgroundColor: 'bg-indigo-50', borderColor: 'border-indigo-200', textColor: 'text-indigo-800', badgeColor: 'bg-indigo-100', chartColor: '#6366f1' },
  { backgroundColor: 'bg-teal-50', borderColor: 'border-teal-200', textColor: 'text-teal-800', badgeColor: 'bg-teal-100', chartColor: '#14b8a6' },
  { backgroundColor: 'bg-cyan-50', borderColor: 'border-cyan-200', textColor: 'text-cyan-800', badgeColor: 'bg-cyan-100', chartColor: '#06b6d4' },
  { backgroundColor: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-800', badgeColor: 'bg-emerald-100', chartColor: '#059669' },
  { backgroundColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-800', badgeColor: 'bg-amber-100', chartColor: '#f59e0b' },
  { backgroundColor: 'bg-lime-50', borderColor: 'border-lime-200', textColor: 'text-lime-800', badgeColor: 'bg-lime-100', chartColor: '#84cc16' },
  { backgroundColor: 'bg-rose-50', borderColor: 'border-rose-200', textColor: 'text-rose-800', badgeColor: 'bg-rose-100', chartColor: '#f43f5e' },
  { backgroundColor: 'bg-violet-50', borderColor: 'border-violet-200', textColor: 'text-violet-800', badgeColor: 'bg-violet-100', chartColor: '#8b5cf6' },
  { backgroundColor: 'bg-sky-50', borderColor: 'border-sky-200', textColor: 'text-sky-800', badgeColor: 'bg-sky-100', chartColor: '#0ea5e9' },
  { backgroundColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-800', badgeColor: 'bg-red-100', chartColor: '#ef4444' },
  { backgroundColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-800', badgeColor: 'bg-yellow-100', chartColor: '#eab308' },
  { backgroundColor: 'bg-fuchsia-50', borderColor: 'border-fuchsia-200', textColor: 'text-fuchsia-800', badgeColor: 'bg-fuchsia-100', chartColor: '#d946ef' },
  { backgroundColor: 'bg-emerald-100', borderColor: 'border-emerald-300', textColor: 'text-emerald-900', badgeColor: 'bg-emerald-200', chartColor: '#047857' },
  { backgroundColor: 'bg-blue-100', borderColor: 'border-blue-300', textColor: 'text-blue-900', badgeColor: 'bg-blue-200', chartColor: '#1d4ed8' },
  { backgroundColor: 'bg-purple-100', borderColor: 'border-purple-300', textColor: 'text-purple-900', badgeColor: 'bg-purple-200', chartColor: '#7c3aed' },
];

// Global model color map - shared across components
let globalModelColorMap = new Map<string, ModelColorScheme>();

export const initializeModelColors = (models: string[]): void => {
  const sortedModels = [...models].sort(); // Sort for consistency
  globalModelColorMap.clear();
  
  sortedModels.forEach((model, index) => {
    const colorIndex = index % MODEL_COLOR_PALETTE.length;
    globalModelColorMap.set(model, MODEL_COLOR_PALETTE[colorIndex]);
  });
  
  console.log('🎨 Global model colors initialized for', sortedModels.length, 'models');
};

export const getModelColor = (modelName: string | undefined | null): ModelColorScheme => {
  if (!modelName || modelName === 'Unknown' || modelName === '') {
    return { 
      backgroundColor: 'bg-neutral-50', 
      borderColor: 'border-neutral-200', 
      textColor: 'text-neutral-800', 
      badgeColor: 'bg-neutral-100',
      chartColor: '#6b7280'
    };
  }
  
  const assignedColor = globalModelColorMap.get(modelName);
  if (assignedColor) {
    return assignedColor;
  }
  
  // Fallback for models not in the initial assignment
  console.warn('🚨 Model not found in global color map:', modelName, 'Using fallback color');
  return { 
    backgroundColor: 'bg-gray-50', 
    borderColor: 'border-gray-200', 
    textColor: 'text-gray-800', 
    badgeColor: 'bg-gray-100',
    chartColor: '#9ca3af'
  };
};

export const getModelChartColors = (): string[] => {
  return Array.from(globalModelColorMap.values()).map(color => color.chartColor);
};

export const getAllModelNames = (): string[] => {
  return Array.from(globalModelColorMap.keys());
}; 