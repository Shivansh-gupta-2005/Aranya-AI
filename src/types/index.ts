// ============================================================
// ARANYA AI: Core Type Definitions
// Distributed Acoustic Intelligence for Forest Protection
// ============================================================

// ---- Sound Event Classes ----
export type SoundEventClass =
  | 'chainsaw'
  | 'vehicle'
  | 'wildlife'
  | 'background'
  | 'gunfire'
  | 'tree_fall'
  | 'fire'
  | 'metal_tool_activity';

export const SOUND_CLASS_LABELS: Record<SoundEventClass, string> = {
  chainsaw: 'Chainsaw / Tree-cutting-like',
  vehicle: 'Vehicle / Engine',
  // Displayed as "Forest Ambience" everywhere in the app: this is the
  // ONE place that label is defined. Internally still the real model
  // class 'wildlife' (bird/animal/insect AudioSet classes); relabeled
  // for display because these are informational/contextual detections,
  // not a problem requiring a ranger's attention: see
  // eventBuilder.isAlertEligible for the alert-policy side of this.
  wildlife: 'Forest Ambience',
  background: 'Background / Natural',
  gunfire: 'Gunshot-like (Experimental)',
  tree_fall: 'Tree-impact / Falling-tree-like (Experimental)',
  fire: 'Fire-related Acoustic Anomaly (Experimental)',
  metal_tool_activity: 'Metal Clanking / Metallic Activity (Experimental)',
};

export const SOUND_CLASS_COLORS: Record<SoundEventClass, string> = {
  chainsaw: '#ef4444',
  vehicle: '#f59e0b',
  wildlife: '#22c55e',
  background: '#6b7280',
  gunfire: '#dc2626',
  tree_fall: '#d97706',
  fire: '#f97316',
  metal_tool_activity: '#a855f7',
};

// ---- Severity ----
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_COLORS: Record<Severity, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

// ---- Classification Result ----
export interface ClassificationResult {
  id: string;
  eventClass: SoundEventClass;
  confidence: number;
  alternativePredictions: { eventClass: SoundEventClass; confidence: number }[];
  timestamp: Date;
  isSimulated: boolean;
  processingTimeMs: number;
  /** Which backend produced this result. Optional: older/demo results omit it. */
  modelSource?: 'yamnet' | 'heuristic' | 'simulated';
}

// ---- Temporal Aggregation ----
export interface TemporalWindow {
  windowIndex: number;
  eventClass: SoundEventClass;
  confidence: number;
  timestamp: Date;
}

export interface TemporalAggregation {
  id: string;
  eventClass: SoundEventClass;
  windows: TemporalWindow[];
  averageConfidence: number;
  isThresholdReached: boolean;
  thresholdUsed: number;
  windowsRequired: number;
}

// ---- Sensor / Node ----
export type SensorStatus = 'online' | 'warning' | 'critical' | 'offline';

export interface SensorNode {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    zone: string;
    description: string;
  };
  battery: number; // 0-100
  signalStrength: number; // 0-100
  temperature: number; // Celsius
  humidity: number; // 0-100 %
  status: SensorStatus;
  lastHeartbeat: Date;
  uptime: number; // hours
  isSimulated: boolean;
}

// NOTE: DetectionEvent/Alert/AlertStatus/TimelineEntry/Incident/RiskZone/
// CoverageArea (pre-rebuild types) have been removed: superseded by the
// single canonical AranyaEvent type in ./event.ts.

// ---- Analytics ----
export interface AnalyticsData {
  eventsOverTime: { date: string; count: number; type: SoundEventClass }[];
  eventsByType: { type: SoundEventClass; count: number }[];
  eventsByZone: { zone: string; count: number }[];
  confidenceDistribution: { range: string; count: number }[];
  falseAlertRate: { date: string; rate: number }[];
  detectionLatency: { date: string; avgMs: number }[];
  sensorUptime: { sensorId: string; uptimePercent: number }[];
  batteryHealth: { sensorId: string; battery: number; trend: number[] }[];
}

// ---- Demo ----
export interface DemoStep {
  phase: 'event' | 'analysis' | 'confidence' | 'temporal' | 'sensor' | 'map' | 'alert' | 'incident';
  label: string;
  detail: string;
  isComplete: boolean;
  timestamp: Date;
}

// ---- Audio Processing ----
export interface AudioAnalysis {
  waveform: number[];
  spectrogram: number[][];
  sampleRate: number;
  duration: number;
  rmsLevel: number;
  peakLevel: number;
}

// ---- Navigation ----
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

// ---- App-wide event for alert descriptions ----
export const ALERT_DESCRIPTIONS: Record<SoundEventClass, string> = {
  chainsaw: 'Potential chainsaw activity detected',
  vehicle: 'Vehicle / engine sound detected in monitored area',
  wildlife: 'Natural forest ambience (wildlife/bird/insect sounds): informational, not a threat',
  background: 'Background environmental sound',
  gunfire: 'Potential gunfire-like sound detected (experimental)',
  tree_fall: 'Potential tree-impact / falling-tree-like sound (experimental)',
  fire: 'Fire-related acoustic anomaly: verify',
  metal_tool_activity: 'Metallic clanking/clattering sound detected (experimental)',
};

export function getSeverityFromClass(
  eventClass: SoundEventClass,
  confidence: number,
  evidenceStrength?: 'weak' | 'moderate' | 'strong'
): Severity {
  if (eventClass === 'background' || eventClass === 'wildlife') return 'low';
  // Weak evidence on an inherently ambiguous class must never present as
  // urgent, regardless of the raw confidence number: see
  // eventBuilder.isAlertEligible for the companion alert-gating rule.
  if ((eventClass === 'fire' || eventClass === 'metal_tool_activity') && evidenceStrength === 'weak') return 'low';
  if (confidence >= 0.9) return 'critical';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
