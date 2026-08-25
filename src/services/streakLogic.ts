// ============================================================
// Shared, pure streak-confirmation primitive.
// ------------------------------------------------------------
// The core math behind "temporal confidence aggregation": a class
// is only confirmed once N consecutive windows sit at/above a
// threshold (mean confidence = sum(C[i]) / N). This file has no Date or singleton
// state, and no knowledge of live vs. batch analysis: it is used
// by both TemporalAggregatorService (live mic, wall-clock windows)
// and timelineSegmenter (uploaded-file batch analysis, audio-relative
// seconds) so the two contexts confirm events under identical rules.
//
// Extracted while fixing a latent bug in the pre-rebuild
// TemporalAggregatorService: on a broken streak it called
// startNewAggregation(), which is a no-op below threshold, leaving
// `currentAggregation` null while `addWindow`'s return type lied via
// an `as TemporalAggregation` cast. This primitive returns its state
// honestly instead.
// ============================================================

export interface StreakState<T> {
  eventClass: T | null;
  confidences: number[];
}

export interface StreakStepResult<T> {
  state: StreakState<T>;
  /**
   * true if this step extended an existing same-class streak (the caller
   * should append its own per-window metadata, e.g. a timestamp);
   * false if the streak was freshly (re)started or broken (the caller
   * should reset its own per-window metadata: to one entry if
   * `state.eventClass` is non-null, or to empty if it's null).
   */
  extended: boolean;
  isConfirmed: boolean;
  averageConfidence: number;
}

export function initStreak<T>(): StreakState<T> {
  return { eventClass: null, confidences: [] };
}

export function stepStreak<T>(
  state: StreakState<T>,
  eventClass: T,
  confidence: number,
  threshold: number,
  windowsRequired: number
): StreakStepResult<T> {
  if (confidence < threshold) {
    return {
      state: { eventClass: null, confidences: [] },
      extended: false,
      isConfirmed: false,
      averageConfidence: 0,
    };
  }

  if (state.eventClass === eventClass) {
    const confidences = [...state.confidences, confidence];
    const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return {
      state: { eventClass, confidences },
      extended: true,
      isConfirmed: confidences.length >= windowsRequired,
      averageConfidence,
    };
  }

  // Different class (or no prior streak): start a fresh one-window streak.
  return {
    state: { eventClass, confidences: [confidence] },
    extended: false,
    isConfirmed: windowsRequired <= 1,
    averageConfidence: confidence,
  };
}
