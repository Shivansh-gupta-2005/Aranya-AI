import { create } from 'zustand';
import { Incident, Alert } from '../types';

interface IncidentStoreState {
  incidents: Incident[];
  selectedIncidentId: string | null;
  createIncident: (alert: Alert, waveformData?: number[], spectrogramData?: number[][]) => Incident;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  updateInvestigatorNotes: (id: string, notes: string) => void;
  selectIncident: (id: string | null) => void;
  getIncident: (id: string) => Incident | undefined;
}

export const useIncidentStore = create<IncidentStoreState>((set, get) => ({
  incidents: [],
  selectedIncidentId: null,
  createIncident: (alert: Alert, waveformData?: number[], spectrogramData?: number[][]) => {
    const newIncident: Incident = {
      ...alert,
      waveformData,
      spectrogramData
    };
    
    set((state) => ({
      incidents: [newIncident, ...state.incidents]
    }));
    
    return newIncident;
  },
  updateIncident: (id: string, updates: Partial<Incident>) => {
    set((state) => ({
      incidents: state.incidents.map(inc =>
        inc.id === id ? { ...inc, ...updates } : inc
      )
    }));
  },
  updateInvestigatorNotes: (id: string, notes: string) => {
    set((state) => ({
      incidents: state.incidents.map(inc =>
        inc.id === id ? { ...inc, investigatorNotes: notes } : inc
      )
    }));
  },
  selectIncident: (id: string | null) => {
    set({ selectedIncidentId: id });
  },
  getIncident: (id: string) => {
    return get().incidents.find(inc => inc.id === id);
  }
}));
