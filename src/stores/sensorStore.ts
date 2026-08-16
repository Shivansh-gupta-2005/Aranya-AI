import { create } from 'zustand';
import { SensorNode, SoundEventClass } from '../types';
import { sensorSimulator } from '../services/sensorSimulator';

interface SensorStoreState {
  nodes: SensorNode[];
  selectedNodeId: string | null;
  initialize: () => void;
  updateNodes: () => void;
  selectNode: (id: string | null) => void;
  triggerDetection: (nodeId: string, eventClass: SoundEventClass, confidence: number) => void;
  forceSync: (nodeId: string) => void;
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
  triggerDetection: (nodeId: string, eventClass: SoundEventClass, confidence: number) => {
    sensorSimulator.triggerDetection(nodeId, eventClass, confidence);
    set({ nodes: sensorSimulator.getNodes() });
  },
  forceSync: (nodeId: string) => {
    sensorSimulator.forceSyncNode(nodeId);
    set({ nodes: sensorSimulator.getNodes() });
  }
}));
