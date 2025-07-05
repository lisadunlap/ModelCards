import React from 'react';
import { X, Eye } from 'lucide-react';
import ContentRenderer from './ContentRenderer';
import { getModelColor } from '../config/modelColors';
import { PropertyData } from '../types';

interface ExampleCardProps {
  item: PropertyData | null;
  isOpen: boolean;
  onClose: () => void;
}

const ExampleCard: React.FC<ExampleCardProps> = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden z-50">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
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
                      onClick={onClose}
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
                <div className="space-y-6">
                  {/* Property Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Model</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModelColor(item.model).badgeColor} ${getModelColor(item.model).textColor}`}>
                        {item.model}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Category</h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.category}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">Impact</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.impact === 'High' ? 'bg-red-100 text-red-800' :
                        item.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.impact}
                      </span>
                    </div>

                    {item.type && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Type</h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {item.type}
                        </span>
                      </div>
                    )}

                    {item.unexpected_behavior && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Unexpected Behavior</h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.unexpected_behavior.toLowerCase() === 'true' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {item.unexpected_behavior}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Property Description</h3>
                    <div className={`p-3 rounded-md border-l-4 ${getModelColor(item.model).backgroundColor} ${getModelColor(item.model).borderColor}`}>
                      <ContentRenderer content={item.property_description} className="!bg-transparent !p-0" />
                    </div>
                  </div>

                  {/* Always show prompt section prominently */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Prompt</h3>
                    <div className="p-3 rounded-md border-l-4 border-gray-400 bg-gray-50">
                      {item.prompt ? (
                        <ContentRenderer content={item.prompt} className="!bg-transparent !p-0" />
                      ) : (
                        <p className="text-gray-500 italic">No prompt available</p>
                      )}
                    </div>
                  </div>

                  {item.reason && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Reason</h3>
                      <div className={`p-3 rounded-md border-l-4 ${getModelColor(item.model).backgroundColor} ${getModelColor(item.model).borderColor}`}>
                        <ContentRenderer content={item.reason} className="!bg-transparent !p-0" />
                      </div>
                    </div>
                  )}

                  {(item.model_1_response || item.model_2_response) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {item.model_1_response && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">
                            {item.model_1_name} Response
                          </h3>
                          <div className={`p-3 rounded-md border-l-4 ${getModelColor(item.model_1_name || 'Model 1').backgroundColor} ${getModelColor(item.model_1_name || 'Model 1').borderColor}`}>
                            <ContentRenderer content={item.model_1_response} className="!bg-transparent !p-0" />
                          </div>
                        </div>
                      )}
                      
                      {item.model_2_response && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">
                            {item.model_2_name} Response
                          </h3>
                          <div className={`p-3 rounded-md border-l-4 ${getModelColor(item.model_2_name || 'Model 2').backgroundColor} ${getModelColor(item.model_2_name || 'Model 2').borderColor}`}>
                            <ContentRenderer content={item.model_2_response} className="!bg-transparent !p-0" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {item.differences && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Differences</h3>
                      <ContentRenderer content={item.differences} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ExampleCard; 