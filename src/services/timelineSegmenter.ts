import { SoundEventClass } from '../types';
import { FrameScore, TimingPrecision } from './models/types';
import { StreakState, initStreak, stepStreak } from './streakLogic';
import { ModelSource } from './audioClassifier';

// ============================================================
// Converts a time-ordered sequence of per-frame class scores (from
// AudioModelPlugin.predictSequence) into discrete, timestamped
// SegmentedEvents.
//
// Two distinct algorithms are used, matched to how each class actually
// behaves acoustically over time:
//
// - SUSTAINED classes (chainsaw/vehicle/wildlife/fire_anomaly) use
//   streak confirmation: N consecutive above-threshold frames confirm
//   one continuous event. Appropriate because a real chainsaw/vehicle
//   sound genuinely persists across many frames.
//
// - IMPULSIVE classes (gunshot/tree_fall/metal_clank) use prominence-
//   based peak-picking instead. A first version of this file reused
//   streak confirmation for impulsive classes too, which caused a real,
//   observed bug: multiple distinct gunshots close enough together that
//   confidence never dips back below the confirmation threshold between
//   them (e.g. due to echo/reverb) were merged into a single event
//   instead of being reported as separate detections — confirmed
//   directly against a real multi-gunshot recording, where several
//   consecutive high-confidence frames (which really were 2+ discrete
//   shots) collapsed into one 0.48s–4.32s "event". Peak-picking finds
//   each locally-highest frame and only merges two nearby peaks when
//   the dip between them isn't prominent enough to represent a genuine
//   second event — see findProminentPeaks().
//
// 'background' is intentionally excluded from both paths — it is the
// ambient/null class and is never itself an actionable event.
// ============================================================

export interface ConfirmationPolicy {
  threshold: number;
  windowsRequired: number;
}

const SUSTAINED_CLASSES: SoundEventClass[] = ['chainsaw', 'vehicle', 'wildlife', 'fire_anomaly'];
const IMPULSIVE_CLASSES: SoundEventClass[] = ['gunshot', 'tree_fall', 'metal_clank'];

/**
 * Minimum prominence (how far the confidence must dip between two nearby
 * high-confidence frames, relative to the lower of the two peaks) required
 * to treat them as two SEPARATE impulsive events rather than one event's
 * natural frame-to-frame fluctuation/decay. Chosen to be large enough that
 * ordinary ringing/reverb within a single event's ~1-2 frame footprint
 * doesn't get over-segmented into spurious extra detections, while a real
 * gap between two distinct impulses (which in practice showed dips of
 * several tenths, not a few percent, in real test recordings) still splits
 * correctly. This is a chosen DSP parameter, not a measured value — treat
 * it as tunable if real-world testing shows over/under-segmentation.
 */
const PEAK_MIN_PROMINENCE = 0.12;

/**
 * Sustained classes require a real multi-frame streak. Impulsive/transient
 * classes are handled by peak-picking (see findProminentPeaks), which
 * doesn't use windowsRequired in the same sense — kept at 1 for schema
 * consistency (each confirmed peak is exactly one frame's detection).
 *
 * Thresholds are calibrated PER MODEL PROVIDER, not as one absolute number
 * shared across both — empirically verified during development (see
 * docs/ai-pipeline.md): the heuristic plugin's own pre-existing confidence
 * band is MIN_HEURISTIC_CONFIDENCE=0.35..MAX_HEURISTIC_CONFIDENCE=0.78
 * (see heuristicPlugin.ts), and even a starkly clean synthetic test signal
 * (near-silence vs. a strong pure tone vs. a strong impulse) never
 * produced a scaled confidence above ~0.46 — a uniform 0.6/0.75 threshold
 * would make the heuristic fallback path structurally unable to confirm
 * ANY event, on ANY audio, regardless of what's actually in the clip. YAMNet's
 * trained multi-label output is expected to produce more sharply peaked
 * scores for a genuinely matching class, so it keeps the higher bar.
 */
function buildPolicy(sustainedThreshold: number, impulsiveThreshold: number): Partial<Record<SoundEventClass, ConfirmationPolicy>> {
  const policy: Partial<Record<SoundEventClass, ConfirmationPolicy>> = {};
  for (const cls of SUSTAINED_CLASSES) policy[cls] = { threshold: sustainedThreshold, windowsRequired: 2 };
  for (const cls of IMPULSIVE_CLASSES) policy[cls] = { threshold: impulsiveThreshold, windowsRequired: 1 };
  return policy;
}

export const CONFIRMATION_POLICY_BY_PROVIDER: Record<ModelSource, Partial<Record<SoundEventClass, ConfirmationPolicy>>> = {
  yamnet: buildPolicy(0.6, 0.75),
  heuristic: buildPolicy(0.5, 0.55),
};

export interface SegmentedEvent {
  eventClass: SoundEventClass;
  startTime: number;
  endTime: number;
  confidence: number;
  windowsUsed: number;
  windowsRequired: number;
  threshold: number;
  timingPrecision: TimingPrecision;
}

interface WindowMeta {
  startTime: number;
  endTime: number;
  timingPrecision: TimingPrecision;
}

interface PerClassTracker {
  streak: StreakState<SoundEventClass>;
  windowMeta: WindowMeta[];
}

function buildSustainedEvent(eventClass: SoundEventClass, tracker: PerClassTracker, policy: ConfirmationPolicy): SegmentedEvent {
  const meta = tracker.windowMeta;
  const confidences = tracker.streak.confidences;
  const averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const timingPrecision: TimingPrecision = meta.some((m) => m.timingPrecision === 'approximate')
    ? 'approximate'
    : 'exact';
  return {
    eventClass,
    startTime: meta[0].startTime,
    endTime: meta[meta.length - 1].endTime,
    confidence: averageConfidence,
    windowsUsed: confidences.length,
    windowsRequired: policy.windowsRequired,
    threshold: policy.threshold,
    timingPrecision,
  };
}

function segmentSustainedClass(frames: FrameScore[], cls: SoundEventClass, policy: ConfirmationPolicy): SegmentedEvent[] {
  const events: SegmentedEvent[] = [];
  const tracker: PerClassTracker = { streak: initStreak<SoundEventClass>(), windowMeta: [] };

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const isLastFrame = i === frames.length - 1;
    const confidence = frame.scores[cls] ?? 0;

    const wasConfirmedBeforeThisStep =
      tracker.streak.eventClass === cls && tracker.streak.confidences.length >= policy.windowsRequired;

    const result = stepStreak(tracker.streak, cls, confidence, policy.threshold, policy.windowsRequired);

    if (result.extended) {
      tracker.windowMeta.push({ startTime: frame.startTime, endTime: frame.endTime, timingPrecision: frame.timingPrecision });
    } else if (result.state.eventClass === cls) {
      tracker.windowMeta = [{ startTime: frame.startTime, endTime: frame.endTime, timingPrecision: frame.timingPrecision }];
    } else {
      if (wasConfirmedBeforeThisStep) {
        events.push(buildSustainedEvent(cls, tracker, policy));
      }
      tracker.windowMeta = [];
    }

    tracker.streak = result.state;

    if (isLastFrame && result.isConfirmed) {
      events.push(buildSustainedEvent(cls, tracker, policy));
    }
  }

  return events;
}

/**
 * Finds locally-highest, sufficiently-prominent peaks in a per-class
 * confidence series — each represents one discrete impulsive event.
 * Two nearby peaks are merged into one (keeping the higher) unless the
 * confidence dips between them by at least `minProminence` relative to
 * the lower of the two peaks.
 */
export function findProminentPeaks(scores: number[], threshold: number, minProminence: number): number[] {
  // 1. Raw local maxima at/above threshold.
  const rawPeaks: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] < threshold) continue;
    const prev = i > 0 ? scores[i - 1] : -Infinity;
    const next = i < scores.length - 1 ? scores[i + 1] : -Infinity;
    if (scores[i] >= prev && scores[i] >= next) rawPeaks.push(i);
  }
  if (rawPeaks.length === 0) return [];

  // 2. Collapse adjacent-index runs (flat plateaus / ties) into one
  // representative index per run — the run's own highest value.
  const grouped: number[] = [];
  let groupBest = rawPeaks[0];
  for (let k = 1; k < rawPeaks.length; k++) {
    if (rawPeaks[k] === rawPeaks[k - 1] + 1) {
      if (scores[rawPeaks[k]] > scores[groupBest]) groupBest = rawPeaks[k];
    } else {
      grouped.push(groupBest);
      groupBest = rawPeaks[k];
    }
  }
  grouped.push(groupBest);

  // 3. Prominence-based left-to-right merge: only keep a peak as
  // separate from the previous one if the confidence genuinely dipped
  // between them by at least minProminence.
  const finalPeaks: number[] = [grouped[0]];
  for (let k = 1; k < grouped.length; k++) {
    const prevPeakIdx = finalPeaks[finalPeaks.length - 1];
    const curPeakIdx = grouped[k];

    let minBetween = Infinity;
    for (let m = prevPeakIdx + 1; m < curPeakIdx; m++) {
      minBetween = Math.min(minBetween, scores[m]);
    }
    if (minBetween === Infinity) {
      // Adjacent peaks with no frame between them at all.
      minBetween = Math.min(scores[prevPeakIdx], scores[curPeakIdx]);
    }

    const prominence = Math.min(scores[prevPeakIdx], scores[curPeakIdx]) - minBetween;

    if (prominence >= minProminence) {
      finalPeaks.push(curPeakIdx);
    } else if (scores[curPeakIdx] > scores[prevPeakIdx]) {
      finalPeaks[finalPeaks.length - 1] = curPeakIdx;
    }
  }

  return finalPeaks;
}

function segmentImpulsiveClass(frames: FrameScore[], cls: SoundEventClass, policy: ConfirmationPolicy): SegmentedEvent[] {
  const series = frames.map((f) => f.scores[cls] ?? 0);
  const peakIndices = findProminentPeaks(series, policy.threshold, PEAK_MIN_PROMINENCE);

  return peakIndices.map((idx) => {
    const frame = frames[idx];
    return {
      eventClass: cls,
      startTime: frame.startTime,
      endTime: frame.endTime,
      confidence: series[idx],
      windowsUsed: 1,
      windowsRequired: policy.windowsRequired,
      threshold: policy.threshold,
      timingPrecision: frame.timingPrecision,
    };
  });
}

export function segmentTimeline(frames: FrameScore[], modelSource: ModelSource): SegmentedEvent[] {
  const policyByClass = CONFIRMATION_POLICY_BY_PROVIDER[modelSource];
  const events: SegmentedEvent[] = [];

  for (const cls of SUSTAINED_CLASSES) {
    const policy = policyByClass[cls];
    if (policy) events.push(...segmentSustainedClass(frames, cls, policy));
  }
  for (const cls of IMPULSIVE_CLASSES) {
    const policy = policyByClass[cls];
    if (policy) events.push(...segmentImpulsiveClass(frames, cls, policy));
  }

  events.sort((a, b) => a.startTime - b.startTime);
  return events;
}
