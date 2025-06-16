import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  content, 
  className = '', 
  iconClassName = 'h-4 w-4' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        type="button"
      >
        <Info className={iconClassName} />
      </button>
      
      {isVisible && (
        <div className="absolute z-50 w-80 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg -top-2 left-6 transform">
          <div className="relative">
            {content}
            {/* Arrow pointing to the icon */}
            <div className="absolute top-2 -left-3 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip; 
 