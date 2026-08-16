import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSensorStore } from '../stores/sensorStore';
import { useAlertStore } from '../stores/alertStore';
import { useIncidentStore } from '../stores/incidentStore';
import { classifyForDemo } from '../services/audioClassifier';
import { createAlert } from '../services/alertManager';
import { TemporalAggregatorService } from '../services/temporalAggregator';
import { SoundEventClass, DemoStep, generateId } from '../types';
import { Axe, Car, Bird, Crosshair, Flame, Play, CheckCircle2, ChevronRight } from 'lucide-react';

const aggregator = new TemporalAggregatorService();

export default function DemoMode() {
  const navigate = useNavigate();
  const { nodes, triggerDetection } = useSensorStore();
  const { addAlert } = useAlertStore();
  
  const [isRunning, setIsRunning] = useState(false);
  const [activeClass, setActiveClass] = useState<SoundEventClass | null>(null);
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [finalAlertId, setFinalAlertId] = useState<string | null>(null);

  const runDemo = async (eventClass: SoundEventClass) => {
    if (isRunning) return;
    
    setIsRunning(true);
    setActiveClass(eventClass);
    setSteps([]);
    setFinalAlertId(null);
    
    const node = nodes[0] || { id: 'ARANYA-N01', name: 'Alpha Node', location: { lat: 21.15, lng: 79.08, zone: 'North' } };
    
    const addStep = (phase: DemoStep['phase'], label: string, detail: string) => {
      setSteps(prev => [...prev, { phase, label, detail, isComplete: true, timestamp: new Date() }]);
    };

    // 1. EVENT
    await new Promise(r => setTimeout(r, 1000));
    addStep('event', 'Acoustic Event Detected', "Microphone at " + node.name + " captured audio anomaly");

    // 2. ANALYSIS
    await new Promise(r => setTimeout(r, 1500));
    const result = await classifyForDemo(eventClass as any);
    addStep('analysis', 'Audio Processing', 'Running Edge AI Inference (MobileNetV3)');

    // 3. CONFIDENCE
    await new Promise(r => setTimeout(r, 1000));
    addStep('confidence', 'Initial Classification', `Result: ${result.eventClass} ${(result.confidence * 100).toFixed(1)}% confidence`);

    // 4. TEMPORAL
    await new Promise(r => setTimeout(r, 2000));
    const tempAgg = aggregator.addWindow(result.eventClass, result.confidence);
    addStep('temporal', 'Temporal Aggregation', `Validated ${tempAgg?.windows.length || 3}/3 required windows above threshold`);

    // 5. SENSOR
    await new Promise(r => setTimeout(r, 500));
    triggerDetection(node.id, eventClass, result.confidence);
    addStep('sensor', 'Node Communication', `${node.name} securely transmitted event payload via LoRaWAN`);

    // 6. MAP
    await new Promise(r => setTimeout(r, 500));
    addStep('map', 'Geospatial Mapping', 'Coordinates plotted on central dashboard');

    // 7. ALERT
    await new Promise(r => setTimeout(r, 500));
    const detectionEvent = {
      id: generateId(),
      sensorId: node.id,
      eventClass: result.eventClass,
      confidence: result.confidence,
      severity: result.confidence > 0.85 ? 'high' : 'medium',
      timestamp: new Date(),
      duration: 3,
      isSimulated: true,
      location: node.location
    } as any;
    const newAlert = createAlert(detectionEvent, node as any, tempAgg || undefined);
    addAlert(newAlert);
    setFinalAlertId(newAlert.id);
    addStep('alert', 'System Alert Created', 'Alert dispatched to active monitors');

    // 8. INCIDENT
    await new Promise(r => setTimeout(r, 500));
    addStep('incident', 'Incident Ready for Verification', 'Audio evidence packaged for analyst review');

    setIsRunning(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full max-w-5xl mx-auto pb-8">
      <div className="glass-card p-6 rounded-xl text-center border-b-4 border-purple-500">
        <h1 className="text-3xl font-bold text-gray-100">ARANYA AI — Demo Mode</h1>
        <p className="text-purple-400 mt-2 flex items-center justify-center gap-2">
          <Play size={16} /> Simulated Event Pipeline
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button 
          onClick={() => runDemo('chainsaw')}
          disabled={isRunning}
          className="glass-card p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-red-900/20 border-2 border-transparent hover:border-red-500/50 transition-all disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
            <Axe size={24} />
          </div>
          <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>Chainsaw</span>
        </button>

        <button 
          onClick={() => runDemo('vehicle')}
          disabled={isRunning}
          className="glass-card p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-amber-900/20 border-2 border-transparent hover:border-amber-500/50 transition-all disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
            <Car size={24} />
          </div>
          <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>Vehicle</span>
        </button>

        <button 
          onClick={() => runDemo('wildlife')}
          disabled={isRunning}
          className="glass-card p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-green-900/20 border-2 border-transparent hover:border-green-500/50 transition-all disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
            <Bird size={24} />
          </div>
          <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>Wildlife</span>
        </button>

        <button 
          onClick={() => runDemo('gunshot')}
          disabled={isRunning}
          className="glass-card p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-red-900/20 border-2 border-transparent hover:border-red-500/50 transition-all disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
            <Crosshair size={24} />
          </div>
          <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>Gunshot</span>
        </button>

        <button 
          onClick={() => runDemo('fire_anomaly')}
          disabled={isRunning}
          className="glass-card p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-orange-900/20 border-2 border-transparent hover:border-orange-500/50 transition-all disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center">
            <Flame size={24} />
          </div>
          <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>Fire Event</span>
        </button>
      </div>

      <div className="flex-1 glass-card p-6 rounded-xl min-h-[400px]">
        {steps.length === 0 && !isRunning ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Play size={48} className="mb-4 opacity-50" />
            <p className="text-lg">Select a simulation scenario above to begin.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                Pipeline Execution: <span className="uppercase text-purple-400">{activeClass?.replace('_', ' ')}</span>
              </h2>
              {isRunning && <span className="animate-pulse text-forest-500 text-sm">Processing...</span>}
            </div>

            <div className="relative border-l-2 border-canopy-700 ml-4 pl-6 space-y-6 flex-1">
              {steps.map((step, idx) => (
                <div key={idx} className="relative animate-fade-in">
                  <div className="absolute -left-[35px] bg-canopy-900 rounded-full p-1 border border-forest-500 text-forest-500">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-gray-200 font-bold">{step.label}</h3>
                    <p className="text-gray-400 text-sm mt-1">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {finalAlertId && !isRunning && (
              <div className="mt-8 flex justify-center gap-4 animate-fade-in border-t border-canopy-700 pt-6">
                <button 
                  onClick={() => navigate(`/incidents/${finalAlertId}`)}
                  className="btn-primary flex items-center gap-2"
                >
                  View Generated Alert <ChevronRight size={18} />
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded bg-canopy-800 hover:bg-canopy-700 text-gray-200 transition-colors flex items-center gap-2"
                >
                  View on Map
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
