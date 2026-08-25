import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FeedbackRecord } from '../types/event';

// ============================================================
// Prototype feedback store — models the FIRST real step of a
// production feedback/calibration loop:
//
//   Detection -> Human verification -> Feedback captured -> ...
//
// What this store genuinely does: persist structured operator
// verdicts (true positive / false alarm) against real event
// predictions, and expose simple counts derived from that real data.
//
// What it does NOT do, and never claims to: retrain any model. There
// is no training job here. "Queued for model recalibration" describes
// a production workflow this prototype represents but does not run —
// see docs/prototype-limitations.md.
// ============================================================

// Honest, static description of what's actually deployed in this
// prototype — not a fabricated version/accuracy number.
export const PROTOTYPE_MODEL_DESCRIPTOR =
  'YAMNet (AudioSet, pretrained) + ARANYA class-mapping v1 / heuristic fallback v1';

interface FeedbackStoreState {
  records: FeedbackRecord[];
  addRecord: (record: FeedbackRecord) => void;
  getFalsePositiveCount: () => number;
  getTruePositiveCount: () => number;
  getTotalCount: () => number;
  /** Clears all feedback records — used by Reset Demo. */
  clearAll: () => void;
}

export const useFeedbackStore = create<FeedbackStoreState>()(
  persist(
    (set, get) => ({
      records: [],
      addRecord: (record) => set((state) => ({ records: [record, ...state.records] })),
      getFalsePositiveCount: () => get().records.filter((r) => r.verdict === 'false_alarm').length,
      getTruePositiveCount: () => get().records.filter((r) => r.verdict === 'true_positive').length,
      getTotalCount: () => get().records.length,
      clearAll: () => set({ records: [] }),
    }),
    { name: 'aranya-feedback-store' }
  )
);
