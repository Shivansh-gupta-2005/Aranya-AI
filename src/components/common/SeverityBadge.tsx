import React from 'react';
import { Severity, SEVERITY_COLORS } from '../../types';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const color = SEVERITY_COLORS[severity];
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span 
      className={`inline-flex items-center font-medium uppercase tracking-wider rounded-full border ${sizeClasses[size]}`}
      style={{ 
        color: color, 
        borderColor: `${color}40`,
        backgroundColor: `${color}10`
      }}
    >
      {severity}
    </span>
  );
};
