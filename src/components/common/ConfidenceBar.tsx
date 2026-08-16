import React from 'react';

interface ConfidenceBarProps {
  confidence: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ 
  confidence, 
  label, 
  size = 'md',
  animated = true
}) => {
  const percentage = Math.round(confidence * 100);
  
  const getColor = (conf: number) => {
    if (conf < 0.5) return 'bg-red-500';
    if (conf < 0.75) return 'bg-amber-500';
    return 'bg-forest-500';
  };

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        {label && <span className="text-xs text-gray-400 font-medium">{label}</span>}
        <span className="text-xs text-gray-300 font-mono">{percentage}%</span>
      </div>
      <div className={`w-full bg-canopy-800 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div 
          className={`${heightClasses[size]} rounded-full ${getColor(confidence)} ${animated ? 'transition-all duration-1000 ease-out' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
