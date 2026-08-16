import React from 'react';
import { SensorStatus } from '../../types';

interface StatusIndicatorProps {
  status: SensorStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, size = 'md', showLabel = false }) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const getStatusColor = (status: SensorStatus) => {
    switch (status) {
      case 'online': return 'bg-forest-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const colorClass = getStatusColor(status);

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        {status !== 'offline' && (
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-30 animate-ping ${colorClass}`} />
        )}
        <span className={`relative inline-flex rounded-full ${sizeClasses[size]} ${colorClass}`} />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-300 capitalize">{status}</span>
      )}
    </div>
  );
};
