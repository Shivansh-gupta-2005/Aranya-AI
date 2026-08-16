import React from 'react';

interface SimulatedBadgeProps {
  compact?: boolean;
  label?: string;
}

export const SimulatedBadge: React.FC<SimulatedBadgeProps> = ({ compact, label = 'Prototype / Simulated Data' }) => {
  if (compact) {
    return (
      <span 
        className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse"
        title={label}
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-medium uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
      {label}
    </div>
  );
};
