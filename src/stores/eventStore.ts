import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AranyaEvent, VerificationStatus } from '../types/event';
import { migratePersistedEventState } from '../platform/persistence/classMigration';

// ============================================================
// Canonical event store: the single source of truth every page
// (Dashboard, Alerts, ForestMap, IncidentDetails, Analytics,
// SensorDetails) reads from, regardless of whether an event came
// from real audio-upload analysis, real live-mic analysis, or a
// simulated sensor trigger. Persisted to localStorage (browser-only
// prototype: no backend) so a session survives a page refresh.
// ============================================================

const OPEN_STATUSES: VerificationStatus[] = ['active', 'acknowledged'];

interface EventStoreState {
  events: AranyaEvent[];
  addEvent: (event: AranyaEvent) => void;
  updateVerification: (id: string, status: VerificationStatus, notes?: string, actor?: string) => void;
  getEvent: (id: string) => AranyaEvent | undefined;
  /** Alert-eligible events only (see eventBuilder.isAlertEligible): the set the Alerts page and Dashboard "Active Alerts" show. */
  getActiveEvents: () => AranyaEvent[];
  getCriticalCount: () => number;
  getTodayCount: () => number;
  /** Clears all events: used by Reset Demo. */
  clearAll: () => void;
}

export const useEventStore = create<EventStoreState>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => {
        set((state) => ({ events: [event, ...state.events] }));
      },

      updateVerification: (id, status, notes, actor = 'User') => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  verification: {
                    status,
                    notes: notes ?? e.verification.notes,
                    history: [
                      ...e.verification.history,
                      {
                        timestamp: new Date().toISOString(),
                        action: 'Status Updated',
                        detail: `Status changed from ${e.verification.status} to ${status}`,
                        actor,
                      },
                    ],
                  },
                }
              : e
          ),
        }));
      },

      getEvent: (id) => get().events.find((e) => e.id === id),

      getActiveEvents: () =>
        get().events.filter((e) => e.alertEligible && OPEN_STATUSES.includes(e.verification.status)),

      getCriticalCount: () =>
        get().events.filter(
          (e) => e.alertEligible && e.severity === 'critical' && OPEN_STATUSES.includes(e.verification.status)
        ).length,

      getTodayCount: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return get().events.filter((e) => new Date(e.detectedAt) >= today).length;
      },

      clearAll: () => set({ events: [] }),
    }),
    {
      name: 'aranya-event-store',
      version: 1,
      migrate: (persisted) => migratePersistedEventState(persisted) as EventStoreState,
      // AranyaEvent stores all timestamps as ISO strings already, so the
      // default JSON serializer round-trips it correctly with no reviver.
    }
  )
);
