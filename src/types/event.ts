// ============================================================
// ARANYA AI — Canonical Event Type
// ------------------------------------------------------------
// Single source of truth for a detected acoustic event, whatever
// produced it (uploaded-audio analysis, live microphone, or a
// simulated sensor trigger). Replaces the old, overlapping
// DetectionEvent/Alert/Incident types in ./index.ts.
// ============================================================

import { SoundEventClass, Severity } from './index';

/** Where the audio/telemetry that produced this event came from. */
export type EventSourceType = 'upload' | 'live-mic' | 'simulated-sensor';

export interface EventSource {
  type: EventSourceType;
  /** Set only for simulated-sensor events. */
  sensorId?: string;
  /** Set only for upload-sourced events. */
  fileName?: string;
}

/** Which classification backend actually produced this event's score. */
export type ModelProviderId = 'yamnet' | 'heuristic' | 'simulated-sensor';

export interface ModelProvenance {
  provider: ModelProviderId;
  /** Human-readable name, e.g. "YAMNet (AudioSet, TensorFlow.js, pretrained)". */
  name: string;
  /** Only set when a real, publishable version string exists — never invented. */
  version?: string;
}

/** How this event's confidence was arrived at via streak confirmation. */
export interface TemporalConfirmationInfo {
  windowsUsed: number;
  windowsRequired: number;
  threshold: number;
  isConfirmed: boolean;
}

/**
 * Whether start/end timestamps are derived from the model's known, verified
 * fixed framing (exact) or a best-effort fallback derivation (approximate).
 * Never presented in the UI with the same implied precision.
 */
export type TimingPrecision = 'exact' | 'approximate';

/** Mirrors the alert-lifecycle vocabulary already used across the dashboard. */
export type VerificationStatus = 'active' | 'acknowledged' | 'verified' | 'false_alarm' | 'resolved';

/**
 * How far this event's confidence sits above the minimum confirmation
 * threshold for its class/provider (see timelineSegmenter's
 * CONFIRMATION_POLICY_BY_PROVIDER) — a generic, honest "how solid is this
 * evidence" signal computed the same way for every class, not invented
 * per-class. 'weak' means it only just crossed the bar to become an event
 * at all; for classes where a false alarm is costly to cry (fire_anomaly,
 * metal_clank) this gates whether the event escalates to an actionable
 * alert — see eventPipeline.isAlertEligible.
 */
export type EvidenceStrength = 'weak' | 'moderate' | 'strong';

export interface EventTimelineEntry {
  /** ISO 8601 string — never a Date object (breaks localStorage round-trip). */
  timestamp: string;
  action: string;
  detail: string;
  actor?: string;
}

export interface VerificationInfo {
  status: VerificationStatus;
  notes?: string;
  history: EventTimelineEntry[];
}

/** Present only on simulated-sensor events, which have a real (if fictional) node coordinate. */
export interface EventLocation {
  lat: number;
  lng: number;
  zone: string;
}

/**
 * Real evidence slices for display. Absent (undefined) for events with no
 * genuine audio evidence (e.g. simulated-sensor telemetry) — the UI must
 * render "Evidence unavailable" in that case, never a placeholder.
 */
export interface EventEvidence {
  waveform?: number[];
  spectrogram?: number[][];
  sourceFileName?: string;
}

/**
 * Localization is a FUTURE PRODUCTION capability requiring multiple
 * synchronized sensor nodes independently detecting the same event
 * (time-difference-of-arrival). A single uploaded clip or one simulated
 * node can never genuinely localize a source — 'unavailable' is the
 * correct, honest state for those. 'simulated' is used only by Demo
 * Mode's explicitly-labeled multi-node scenario, which shows the UI
 * *concept* using synthetic arrival-time differences — never presented
 * as a real triangulation of a real event.
 */
export type LocalizationStatus = 'unavailable' | 'simulated';

export interface LocalizationEstimate {
  status: LocalizationStatus;
  /** Human-readable relative estimate, e.g. "≈2.1 km southeast of ARANYA-N01". */
  description: string;
  distanceMeters: number;
  uncertaintyMeters: number;
  /** 0..1 — how much the (simulated) arrival-time/amplitude agreement supports this estimate. */
  confidence: number;
  /** Node IDs whose (simulated) independent detections contributed. */
  contributingSensorIds: string[];
  referenceSensorId: string;
  /** Synthetic coordinate for map display — only ever set by the explicitly-simulated Demo Mode scenario. */
  estimatedLat: number;
  estimatedLng: number;
}

/**
 * A structured record of operator feedback on a detection, captured when
 * an event is marked verified/false-alarm. This is the raw material a
 * real deployment would accumulate into a labeled dataset for periodic
 * model retraining/calibration — the prototype stores it and displays
 * it, but does not retrain anything live. See services/feedbackStore.ts
 * and docs/prototype-limitations.md.
 */
export interface FeedbackRecord {
  id: string;
  eventId: string;
  /** ISO 8601 string. */
  recordedAt: string;
  predictedClass: SoundEventClass;
  predictedConfidence: number;
  eventTimestamp: string;
  sensorId?: string;
  zone?: string;
  audioReference: string;
  verdict: 'true_positive' | 'false_alarm';
  notes?: string;
}

export interface AranyaEvent {
  id: string;
  eventClass: SoundEventClass;
  /** ISO 8601 string. */
  detectedAt: string;
  /** Seconds into the source clip. Only meaningful for upload-sourced events. */
  startTime?: number;
  endTime?: number;
  confidence: number;
  severity: Severity;
  source: EventSource;
  model: ModelProvenance;
  temporalConfirmation: TemporalConfirmationInfo;
  timingPrecision: TimingPrecision;
  /** Derived from source.type — never hardcoded independently. */
  isSimulated: boolean;
  location?: EventLocation;
  evidence?: EventEvidence;
  verification: VerificationInfo;
  /**
   * Optional application-level relabeling of eventClass for display,
   * populated ONLY when the raw classifier output justifies it (e.g. a
   * 'vehicle' detection with genuinely elevated chainsaw/sawing signal
   * in the same window) — never a blanket rename. See eventPipeline.ts.
   */
  interpretationNote?: string;
  /** Human-readable pointer to the audio/telemetry this event came from. */
  audioReference: string;
  localization: LocalizationEstimate | { status: 'unavailable' };
  /** How far above the class's confirmation threshold this event's confidence sits — see EvidenceStrength. */
  evidenceStrength: EvidenceStrength;
  /**
   * Whether this event should surface as an actionable alert (Alerts page,
   * Dashboard "Active Alerts", badge counts). Computed ONCE at creation in
   * eventPipeline.isAlertEligible — the single source of truth for alert
   * policy. Non-alertable events remain fully real, persisted, and visible
   * in the audio timeline / Incident Details / Analytics — they are simply
   * not treated as a problem requiring a ranger's attention.
   */
  alertEligible: boolean;
}
