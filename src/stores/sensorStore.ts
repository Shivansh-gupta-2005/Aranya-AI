import { create } from 'zustand';
import { SensorNode, SoundEventClass } from '../types';
import { sensorSimulator } from '../services/sensorSimulator';
import { createEventFromClassification, recordEvent } from '../services/eventPipeline';
import { AranyaEvent, LocalizationEstimate } from '../types/event';

interface TriggerDetectionOptions {
  localization?: LocalizationEstimate;
}

interface SensorStoreState {
  nodes: SensorNode[];
  selectedNodeId: string | null;
  initialize: () => void;
  updateNodes: () => void;
  selectNode: (id: string | null) => void;
  /** Triggers a simulated sensor telemetry event AND records a real AranyaEvent through the shared event pipeline. Returns the created event (or null if the node doesn't exist) so callers can honestly reflect whether it was alert-eligible. */
  triggerDetection: (nodeId: string, eventClass: SoundEventClass, confidence: number, options?: TriggerDetectionOptions) => AranyaEvent | null;
  forceSync: (nodeId: string) => void;
  /** Re-initializes simulated node telemetry to fresh starting values — used by Reset Demo. */
  resetTelemetry: () => void;
}

export const useSensorStore = create<SensorStoreState>((set) => ({
  nodes: [],
  selectedNodeId: null,
  initialize: () => {
    set({ nodes: sensorSimulator.getNodes() });
  },
  updateNodes: () => {
    set({ nodes: sensorSimulator.updateNodeStatus() });
  },
  selectNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },
  triggerDetection: (nodeId, eventClass, confidence, options) => {
    const node = sensorSimulator.triggerDetection(nodeId, eventClass, confidence);
    set({ nodes: sensorSimulator.getNodes() });
    if (!node) return null;

    const event = createEventFromClassification({
      eventClass,
      confidence,
      source: { type: 'simulated-sensor', sensorId: node.id },
      model: { provider: 'simulated-sensor', name: 'Simulated sensor telemetry (Demo Mode)' },
      temporalConfirmation: { windowsUsed: 1, windowsRequired: 1, threshold: 0, isConfirmed: true },
      timingPrecision: 'approximate',
      location: node.location,
      localization: options?.localization,
    });
    recordEvent(event);
    return event;
  },
  forceSync: (nodeId: string) => {
    sensorSimulator.forceSyncNode(nodeId);
    set({ nodes: sensorSimulator.getNodes() });
  },
  resetTelemetry: () => {
    sensorSimulator.resetTelemetry();
    set({ nodes: sensorSimulator.getNodes(), selectedNodeId: null });
  },
}));
