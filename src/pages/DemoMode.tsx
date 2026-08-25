import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSensorStore } from '../stores/sensorStore';
import { useEventStore } from '../stores/eventStore';
import { sensorSimulator } from '../services/sensorSimulator';
import { SoundEventClass, DemoStep, SOUND_CLASS_LABELS } from '../types';
import { LocalizationEstimate } from '../types/event';
import { Axe, Car, Bird, Crosshair, Flame, Play, CheckCircle2, ChevronRight, Layers, Wrench } from 'lucide-react';

// ============================================================
// Demo Mode — the judge-facing simulated-sensor control center.
//
// IMPORTANT: this page does NOT run real AI inference. It never did
// (the pre-rebuild version called a fully-fabricated random classifier;
// this version removes that entirely). Every event it produces is
// explicitly tagged source.type = 'simulated-sensor' and isSimulated =
// true, and flows through the SAME eventPipeline.recordEvent() that
// real Audio Upload / Live Listen detections use — there is one event
// system, not two. For genuine AI classification of real audio, use
// Audio Upload or Live Listen.
// ============================================================

// Fixed, representative confidence values for each simulated scenario —
// illustrative, not measured, and never presented as real model output
// (the resulting event's model.provider is explicitly 'simulated-sensor').
const SCENARIO_CONFIDENCE: Record<string, number> = {
  chainsaw: 0.88,
  vehicle: 0.85,
  wildlife: 0.91,
  gunshot: 0.93,
  fire_anomaly: 0.79,
  metal_clank: 0.82,
};

/** Simple equirectangular offset — adequate for a small illustrative map displacement, not a precision geodesy tool. */
function offsetLatLng(lat: number, lng: number, distanceMeters: number, bearingDegrees: number) {
  const R = 6371000;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const dLat = (distanceMeters * Math.cos(bearing)) / R;
  const dLng = (distanceMeters * Math.sin(bearing)) / (R * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + (dLat * 180) / Math.PI, lng: lng + (dLng * 180) / Math.PI };
}

const SINGLE_SCENARIOS: { key: SoundEventClass; label: string; icon: React.ElementType; hoverClass: string; iconBg: string }[] = [
  { key: 'chainsaw', label: 'Chainsaw', icon: Axe, hoverClass: 'hover:bg-red-900/20 hover:border-red-500/50', iconBg: 'bg-red-500/20 text-red-500' },
  { key: 'vehicle', label: 'Vehicle', icon: Car, hoverClass: 'hover:bg-amber-900/20 hover:border-amber-500/50', iconBg: 'bg-amber-500/20 text-amber-500' },
  { key: 'wildlife', label: 'Forest Ambience', icon: Bird, hoverClass: 'hover:bg-green-900/20 hover:border-green-500/50', iconBg: 'bg-green-500/20 text-green-500' },
  { key: 'gunshot', label: 'Gunshot', icon: Crosshair, hoverClass: 'hover:bg-red-900/20 hover:border-red-500/50', iconBg: 'bg-red-500/20 text-red-500' },
  { key: 'fire_anomaly', label: 'Fire Event', icon: Flame, hoverClass: 'hover:bg-orange-900/20 hover:border-orange-500/50', iconBg: 'bg-orange-500/20 text-orange-500' },
  { key: 'metal_clank', label: 'Metal Clank', icon: Wrench, hoverClass: 'hover:bg-purple-900/20 hover:border-purple-500/50', iconBg: 'bg-purple-500/20 text-purple-500' },
];

export default function DemoMode() {
  const navigate = useNavigate();
  const { nodes, triggerDetection, initialize } = useSensorStore();
  const [isRunning, setIsRunning] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [finalEventId, setFinalEventId] = useState<string | null>(null);

  React.useEffect(() => {
    if (nodes.length === 0) initialize();
  }, [nodes, initialize]);

  const addStep = (phase: DemoStep['phase'], label: string, detail: string) => {
    setSteps((prev) => [...prev, { phase, label, detail, isComplete: true, timestamp: new Date() }]);
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** Triggers one simulated event on a given node and walks through the honest pipeline-visualization steps. */
  const runSingleTrigger = async (nodeId: string, eventClass: SoundEventClass) => {
    const node = nodes.find((n) => n.id === nodeId) ?? sensorSimulator.getNode(nodeId);
    const confidence = SCENARIO_CONFIDENCE[eventClass] ?? 0.8;
    const label = SOUND_CLASS_LABELS[eventClass];

    await wait(500);
    addStep('sensor', 'Simulated Sensor Trigger', `${node?.name ?? nodeId} reports a simulated acoustic anomaly (this is NOT real audio or real AI inference).`);

    await wait(700);
    addStep('confidence', 'Simulated Classification', `Assigned class: ${label} — illustrative confidence ${(confidence * 100).toFixed(0)}% (fixed demo value, not a live model score).`);

    await wait(400);
    const event = triggerDetection(nodeId, eventClass, confidence);
    addStep('sensor', 'Node Telemetry Updated', `${node?.name ?? nodeId} telemetry refreshed; event recorded through the same event pipeline real detections use.`);

    await wait(400);
    if (event?.alertEligible) {
      addStep('alert', 'Alert Generated', 'Alert now visible on Dashboard, Alerts, and Forest Map.');
    } else {
      addStep('alert', 'Recorded — No Alert', `"${label}" is informational/contextual per the current alert policy — it's stored and visible in the timeline/Analytics, but does not create an actionable alert.`);
    }

    return { confidence, event };
  };

  const runDemo = async (eventClass: SoundEventClass) => {
    if (isRunning || nodes.length === 0) return;
    setIsRunning(true);
    setActiveLabel(SOUND_CLASS_LABELS[eventClass]);
    setSteps([]);
    setFinalEventId(null);

    const node = nodes[0];
    await runSingleTrigger(node.id, eventClass);

    await wait(300);
    addStep('incident', 'Ready for Verification', 'Operator can open Incident Details to Acknowledge / Verify / Mark False Alarm.');

    // Find the just-created event to link to (most recent one on this node/class).
    const candidate = useEventStore
      .getState()
      .events.find((e) => e.source.sensorId === node.id && e.eventClass === eventClass);
    if (candidate) setFinalEventId(candidate.id);

    setIsRunning(false);
  };

  const runFullForestIncident = async () => {
    if (isRunning || nodes.length < 2) return;
    setIsRunning(true);
    setActiveLabel('Full Forest Incident');
    setSteps([]);
    setFinalEventId(null);

    addStep('event', 'Scenario Started', 'Simulated multi-event forest incident across several simulated sensor nodes.');

    const nodeA = nodes[0];
    const nodeB = nodes[1 % nodes.length];
    const nodeC = nodes[2 % nodes.length];

    await runSingleTrigger(nodeA.id, 'wildlife');
    await wait(500);
    await runSingleTrigger(nodeB.id, 'vehicle');
    await wait(500);
    await runSingleTrigger(nodeA.id, 'chainsaw');

    // Gunshot detected independently by 3 nodes within the fusion window —
    // this is the one scenario honestly labeled "simulated localization".
    await wait(500);
    addStep('sensor', 'Multi-Node Gunshot Detection (Simulated)', 'Three simulated nodes independently report a gunshot-class event within the same window.');
    for (const n of [nodeA, nodeB, nodeC]) {
      triggerDetection(n.id, 'gunshot', SCENARIO_CONFIDENCE.gunshot + (Math.random() - 0.5) * 0.04);
      await wait(250);
    }

    await wait(400);
    const fusedConfidence = sensorSimulator.getMultiNodeConfirmation('gunshot');
    const contributingIds = sensorSimulator.getContributingNodeIds('gunshot');
    addStep(
      'confidence',
      'Multi-Node Fusion (Simulated)',
      `Weighted fusion across ${contributingIds.length} node(s) — combined confidence ${(fusedConfidence * 100).toFixed(0)}% (C = Σ wᵢCᵢ).`
    );

    // Synthetic estimated source location — clearly a simulated
    // illustration, never presented as real TDOA triangulation of a
    // real event (which this single-process browser prototype cannot do).
    const bearing = 135; // illustrative "southeast"
    const distanceMeters = 2100;
    const est = offsetLatLng(nodeA.location.lat, nodeA.location.lng, distanceMeters, bearing);
    const localization: LocalizationEstimate = {
      status: 'simulated',
      description: `≈${(distanceMeters / 1000).toFixed(1)} km southeast of ${nodeA.name} (${nodeA.id})`,
      distanceMeters,
      uncertaintyMeters: 350,
      confidence: 0.78,
      contributingSensorIds: contributingIds,
      referenceSensorId: nodeA.id,
      estimatedLat: est.lat,
      estimatedLng: est.lng,
    };
    triggerDetection(nodeA.id, 'gunshot', SCENARIO_CONFIDENCE.gunshot, { localization });
    addStep(
      'map',
      'Simulated Localization Estimate',
      `${localization.description} · ±${localization.uncertaintyMeters}m · ${(localization.confidence * 100).toFixed(0)}% localization confidence. This uses synthetic arrival-time differences to illustrate the PRODUCTION concept — a real deployment would need multiple synchronized sensors detecting the same real event.`
    );

    await wait(500);
    await runSingleTrigger(nodeC.id, 'fire_anomaly');

    addStep('incident', 'Scenario Complete', 'Full incident now visible across Dashboard, Alerts, Forest Map (simulated localization layer), and Analytics.');

    const candidate = useEventStore
      .getState()
      .events.find((e) => e.source.sensorId === nodeA.id && e.eventClass === 'gunshot' && e.localization.status === 'simulated');
    if (candidate) setFinalEventId(candidate.id);

    setIsRunning(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full max-w-5xl mx-auto pb-8">
      <div className="glass-card p-6 rounded-xl text-center border-b-4 border-purple-500">
        <h1 className="text-3xl font-bold text-gray-100">ARANYA AI — Demo Mode</h1>
        <p className="text-purple-400 mt-2 flex items-center justify-center gap-2">
          <Play size={16} /> Simulated Sensor-Network Pipeline (not real AI inference — see Audio Upload for that)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {SINGLE_SCENARIOS.map(({ key, label, icon: Icon, hoverClass, iconBg }) => (
          <button
            key={key}
            onClick={() => runDemo(key)}
            disabled={isRunning}
            className={`glass-card p-4 rounded-xl flex flex-col items-center gap-3 border-2 border-transparent transition-all disabled:opacity-50 ${hoverClass}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
              <Icon size={24} />
            </div>
            <span className="text-sm font-bold text-gray-200 text-center">Simulate<br/>{label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={runFullForestIncident}
        disabled={isRunning}
        className="glass-card p-4 rounded-xl flex items-center justify-center gap-3 border-2 border-purple-500/40 hover:bg-purple-900/20 hover:border-purple-500 transition-all disabled:opacity-50"
      >
        <Layers size={22} className="text-purple-400" />
        <span className="font-bold text-gray-100">Run "Full Forest Incident" — wildlife → vehicle → chainsaw → gunshots (simulated localization) → fire</span>
      </button>

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
                Pipeline Execution: <span className="uppercase text-purple-400">{activeLabel}</span>
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

            {finalEventId && !isRunning && (
              <div className="mt-8 flex justify-center gap-4 animate-fade-in border-t border-canopy-700 pt-6">
                <button
                  onClick={() => navigate(`/incidents/${finalEventId}`)}
                  className="btn-primary flex items-center gap-2"
                >
                  View Event Details <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => navigate('/map')}
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
