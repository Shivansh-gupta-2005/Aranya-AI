import React from 'react';
import { Loader2, AlertTriangle, ShieldCheck, Activity, Flame, ShieldAlert, Zap } from 'lucide-react';
import { ClassificationResult, SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, ALERT_DESCRIPTIONS, getSeverityFromClass } from '../../types';

export interface ClassificationDisplayProps {
  result: ClassificationResult | null;
  isProcessing: boolean;
  className?: string;
}

const getIconForClass = (eventClass: string) => {
  switch (eventClass) {
    case 'chainsaw': return <AlertTriangle className="w-8 h-8" />;
    case 'vehicle': return <Activity className="w-8 h-8" />;
    case 'wildlife': return <ShieldCheck className="w-8 h-8" />;
    case 'gunshot': return <Zap className="w-8 h-8" />;
    case 'fire_anomaly': return <Flame className="w-8 h-8" />;
    default: return <Activity className="w-8 h-8" />;
  }
};

const EVENT_CLASS_EMOJI: Record<string, string> = {
  chainsaw: '🪚',
  vehicle: '🚙',
  wildlife: '🐦',
  background: '🌧️',
  gunshot: '💥',
  tree_fall: '🌳',
  fire_anomaly: '🔥',
};

const MODEL_SOURCE_LABEL: Record<string, string> = {
  yamnet: 'Pretrained Model (YAMNet / AudioSet)',
  heuristic: 'Signal-Analysis Heuristic (Experimental)',
  simulated: 'Prototype / Simulated Data',
};

export const ClassificationDisplay: React.FC<ClassificationDisplayProps> = ({
  result,
  isProcessing,
  className = '',
}) => {
  if (isProcessing) {
    return (
      <div className={`glass-card p-6 flex flex-col items-center justify-center min-h-[200px] ${className}`}>
        <Loader2 className="w-10 h-10 text-forest-500 animate-spin mb-4" />
        <p className="text-gray-300 font-medium">Analyzing Audio Pattern...</p>
        <p className="text-sm text-gray-500 mt-2">Running ARANYA acoustic models</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`glass-card p-6 flex flex-col items-center justify-center min-h-[200px] ${className}`}>
        <Activity className="w-10 h-10 text-gray-600 mb-4" />
        <p className="text-gray-400 font-medium">No active analysis</p>
        <p className="text-sm text-gray-600 mt-2">Upload audio or start listening to begin</p>
      </div>
    );
  }

  const severity = getSeverityFromClass(result.eventClass, result.confidence);
  const color = SOUND_CLASS_COLORS[result.eventClass];
  
  return (
    <div className={`glass-card p-6 flex flex-col ${className}`}>
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          Detection Results
          {result.isSimulated && (
            <span className="bg-purple-900/50 text-purple-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-purple-700/50">
              Prototype / Simulated Data
            </span>
          )}
          {!result.isSimulated && result.modelSource && (
            <span className="bg-blue-900/40 text-blue-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-blue-700/40">
              {MODEL_SOURCE_LABEL[result.modelSource] ?? 'Experimental'}
            </span>
          )}
        </h3>
        <span className="text-xs text-gray-500">
          Processed in {result.processingTimeMs}ms
        </span>
      </div>

      <div 
        className="rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, #0a0f0d 0%, #111916 100%)`,
          border: `1px solid ${color}40`
        }}
      >
        <div 
          className="absolute inset-0 opacity-10" 
          style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}
        />
        
        <div className="relative z-10 flex flex-col items-center">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            {getIconForClass(result.eventClass)}
          </div>
          
          <h2 className="text-4xl font-bold mb-2 text-white">
            {(result.confidence * 100).toFixed(1)}%
          </h2>
          
          <p className="text-xl font-medium mb-1" style={{ color }}>
            <span className="mr-1">{EVENT_CLASS_EMOJI[result.eventClass] ?? ''}</span>
            {SOUND_CLASS_LABELS[result.eventClass]}
          </p>
          
          <p className="text-sm text-gray-400 max-w-sm">
            {ALERT_DESCRIPTIONS[result.eventClass] || 'Acoustic pattern detected'}
          </p>
          
          {severity === 'critical' || severity === 'high' ? (
            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-red-950/50 text-red-400 border border-red-900/50">
              <ShieldAlert className="w-3.5 h-3.5" />
              High Priority Event
            </div>
          ) : null}
        </div>
      </div>

      {result.alternativePredictions && result.alternativePredictions.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm text-gray-500 mb-3 uppercase tracking-wider font-semibold">Alternative Models</h4>
          <div className="space-y-2">
            {result.alternativePredictions.map((alt, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-[#111916] border border-[#1a2420]">
                <span className="text-sm text-gray-300">{SOUND_CLASS_LABELS[alt.eventClass]}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-[#0a0f0d] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${alt.confidence * 100}%`,
                        backgroundColor: SOUND_CLASS_COLORS[alt.eventClass] 
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-400 w-9 text-right">
                    {(alt.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
