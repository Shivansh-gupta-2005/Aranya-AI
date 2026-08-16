import React from 'react';
import { ArrowRight, CheckCircle2, AlertOctagon } from 'lucide-react';
import { TemporalAggregation, SOUND_CLASS_LABELS, SOUND_CLASS_COLORS } from '../../types';

export interface TemporalDisplayProps {
  aggregation: TemporalAggregation | null;
  className?: string;
}

export const TemporalDisplay: React.FC<TemporalDisplayProps> = ({
  aggregation,
  className = '',
}) => {
  if (!aggregation) {
    return null;
  }

  const { windows, isThresholdReached, eventClass, averageConfidence, windowsRequired } = aggregation;
  const color = SOUND_CLASS_COLORS[eventClass];
  
  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex justify-between items-end mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Temporal Confirmation</h3>
          <p className="text-sm text-gray-400">
            Tracking sustained acoustic patterns over time
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {(averageConfidence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Avg Confidence</div>
        </div>
      </div>

      <div className="flex items-center justify-between my-8 relative">
        {/* Background connector line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#1a2420] -z-10" />
        
        {/* Render slots up to required windows */}
        {Array.from({ length: Math.max(windowsRequired, windows.length) }).map((_, idx) => {
          const window = windows[idx];
          const isFilled = !!window;
          const isLast = idx === Math.max(windowsRequired, windows.length) - 1;
          
          return (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center relative z-10 bg-[#0a0f0d] px-2">
                <div 
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono text-sm font-bold transition-all duration-500 ${
                    isFilled 
                      ? 'border-transparent text-white' 
                      : 'border-[#1a2420] text-gray-600 bg-[#0a0f0d]'
                  }`}
                  style={{
                    backgroundColor: isFilled ? color : undefined,
                    boxShadow: isFilled ? `0 0 15px ${color}40` : undefined
                  }}
                >
                  {isFilled ? `${(window.confidence * 100).toFixed(0)}%` : '-'}
                </div>
                <span className="text-xs text-gray-500 mt-2 absolute -bottom-6 w-max text-center">
                  Window {idx + 1}
                </span>
              </div>
              
              {!isLast && (
                <div className="flex-1 flex justify-center z-10 bg-[#0a0f0d] px-2 text-gray-600">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className={`mt-8 p-4 rounded-lg flex items-start gap-3 transition-colors duration-300 ${
        isThresholdReached 
          ? 'bg-red-950/30 border border-red-900/50' 
          : 'bg-[#111916] border border-[#1a2420]'
      }`}>
        {isThresholdReached ? (
          <AlertOctagon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
          </div>
        )}
        
        <div>
          <h4 className={`font-semibold ${isThresholdReached ? 'text-red-400' : 'text-gray-300'}`}>
            {isThresholdReached 
              ? `Confirmed: Potential ${SOUND_CLASS_LABELS[eventClass]} Activity`
              : 'Monitoring for sustained activity...'
            }
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            {isThresholdReached 
              ? `Pattern detected consistently across ${windows.length} consecutive windows. Generating alert.`
              : `Require ${windowsRequired} consecutive high-confidence detections to trigger verified alert.`
            }
          </p>
        </div>
      </div>
    </div>
  );
};
