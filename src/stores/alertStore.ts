import { create } from 'zustand';
import { Alert, AlertStatus } from '../types';
import { updateAlertStatus } from '../services/alertManager';

interface AlertStoreState {
  alerts: Alert[];
  selectedAlertId: string | null;
  addAlert: (alert: Alert) => void;
  updateStatus: (alertId: string, status: AlertStatus, actor?: string) => void;
  selectAlert: (id: string | null) => void;
  getActiveAlerts: () => Alert[];
  getCriticalCount: () => number;
  getTodayCount: () => number;
}

export const useAlertStore = create<AlertStoreState>((set, get) => ({
  alerts: [],
  selectedAlertId: null,
  addAlert: (alert: Alert) => {
    set((state) => ({ alerts: [alert, ...state.alerts] }));
  },
  updateStatus: (alertId: string, status: AlertStatus, actor: string = 'User') => {
    set((state) => ({
      alerts: state.alerts.map(a => 
        a.id === alertId ? updateAlertStatus(a, status, actor) : a
      )
    }));
  },
  selectAlert: (id: string | null) => {
    set({ selectedAlertId: id });
  },
  getActiveAlerts: () => {
    return get().alerts.filter(a => a.status === 'active');
  },
  getCriticalCount: () => {
    return get().alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
  },
  getTodayCount: () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return get().alerts.filter(a => a.timestamp >= today).length;
  }
}));
