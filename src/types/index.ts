// ============================================================
// ARANYA AI — Core Type Definitions
// Distributed Acoustic Intelligence for Forest Protection
// ============================================================

// ---- Sound Event Classes ----
export type SoundEventClass =
  | 'chainsaw'
  | 'vehicle'
  | 'wildlife'
  | 'background'
  | 'gunshot'
  | 'tree_fall'
  | 'fire_anomaly';

export const SOUND_CLASS_LABELS: Record<SoundEventClass, string> = {
  chainsaw: 'Chainsaw / Tree-cutting-like',
  vehicle: 'Vehicle / Engine',
  wildlife: 'Wildlife Vocalization',
  background: 'Background / Natural',
  gunshot: 'Gunshot-like (Experimental)',
  tree_fall: 'Tree-impact / Falling-tree-like (Experimental)',
  fire_anomaly: 'Fire-related Acoustic Anomaly (Experimental)',
};

export const SOUND_CLASS_COLORS: Record<SoundEventClass, string> = {
  chainsaw: '#ef4444',
  vehicle: '#f59e0b',
  wildlife: '#22c55e',
  background: '#6b7280',
  gunshot: '#dc2626',
  tree_fall: '#d97706',
  fire_anomaly: '#f97316',
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
  /** Which backend produced this result. Optional — older/demo results omit it. */
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
  detectionHistory: DetectionEvent[];
  isSimulated: boolean;
}

// ---- Detection Event ----
export interface DetectionEvent {
  id: string;
  sensorId: string;
  eventClass: SoundEventClass;
  confidence: number;
  severity: Severity;
  timestamp: Date;
  duration: number; // seconds
  isSimulated: boolean;
  location: {
    lat: number;
    lng: number;
    zone: string;
  };
  audioData?: Float32Array;
}

// ---- Alert ----
export type AlertStatus = 'active' | 'acknowledged' | 'verified' | 'false_alarm' | 'resolved';

export interface Alert {
  id: string;
  eventClass: SoundEventClass;
  confidence: number;
  severity: Severity;
  sensorId: string;
  sensorName: string;
  location: {
    lat: number;
    lng: number;
    zone: string;
  };
  timestamp: Date;
  status: AlertStatus;
  isSimulated: boolean;
  description: string;
  temporalAggregation?: TemporalAggregation;
  contributingSensors?: string[];
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  timestamp: Date;
  action: string;
  detail: string;
  actor?: string;
}

// ---- Incident (detailed alert) ----
export interface Incident extends Alert {
  audioUrl?: string;
  spectrogramData?: number[][];
  waveformData?: number[];
  verificationNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  investigatorNotes?: string;
}

// ---- Map types ----
export interface RiskZone {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number; // meters
  riskLevel: Severity;
  description: string;
}

export interface CoverageArea {
  id: string;
  sensorId: string;
  center: { lat: number; lng: number };
  radius: number; // meters — labeled as experimental/planning
  label: string;
}

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
export type DemoScenario = 'chainsaw' | 'vehicle' | 'wildlife' | 'gunshot' | 'fire';

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
  wildlife: 'Wildlife vocalization detected',
  background: 'Background environmental sound',
  gunshot: 'Potential gunshot-like sound detected (experimental)',
  tree_fall: 'Potential tree-impact / falling-tree-like sound (experimental)',
  fire_anomaly: 'Fire-related acoustic/environmental anomaly — verify',
};

export function getSeverityFromClass(eventClass: SoundEventClass, confidence: number): Severity {
  if (eventClass === 'background' || eventClass === 'wildlife') return 'low';
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
