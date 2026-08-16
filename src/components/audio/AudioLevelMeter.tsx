import React from 'react';

export interface AudioLevelMeterProps {
  level: number; // 0 to 1
  peak?: number; // 0 to 1
  className?: string;
  horizontal?: boolean;
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({
  level,
  peak,
  className = '',
  horizontal = false,
}) => {
  // Clamp values between 0 and 1
  const clampedLevel = Math.max(0, Math.min(1, level));
  const clampedPeak = peak !== undefined ? Math.max(0, Math.min(1, peak)) : undefined;

  const percentage = clampedLevel * 100;
  const peakPercentage = clampedPeak !== undefined ? clampedPeak * 100 : 0;

  // Colors based on level
  let barColor = 'bg-green-500'; // forest-500
  if (clampedLevel > 0.85) barColor = 'bg-red-500';
  else if (clampedLevel > 0.7) barColor = 'bg-amber-500';

  if (horizontal) {
    return (
      <div className={`relative w-full h-4 bg-[#111916] rounded-full overflow-hidden border border-[#1a2420] ${className}`}>
        <div 
          className={`h-full transition-all duration-75 ${barColor}`} 
          style={{ width: `${percentage}%` }}
        />
        {clampedPeak !== undefined && (
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white opacity-70 transition-all duration-200"
            style={{ left: `calc(${peakPercentage}% - 2px)` }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-6 h-full min-h-[100px] bg-[#111916] rounded-full overflow-hidden border border-[#1a2420] flex flex-col justify-end ${className}`}>
      <div 
        className={`w-full transition-all duration-75 ${barColor}`} 
        style={{ height: `${percentage}%` }}
      />
      {clampedPeak !== undefined && (
        <div 
          className="absolute left-0 right-0 h-1 bg-white opacity-70 transition-all duration-200"
          style={{ bottom: `calc(${peakPercentage}% - 2px)` }}
        />
      )}
    </div>
  );
};
