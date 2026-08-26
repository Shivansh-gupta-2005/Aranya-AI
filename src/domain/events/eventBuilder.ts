import { getSeverityFromClass, SoundEventClass, ALERT_DESCRIPTIONS } from '../../types';
import {
  AranyaEvent,
  EventSource,
  ModelProvenance,
  TemporalConfirmationInfo,
  TimingPrecision,
  EventLocation,
  EventEvidence,
  LocalizationEstimate,
} from '../../types/event';

// ============================================================
// The bridge that was missing in the pre-rebuild prototype: this
// is the ONE place that turns a classification result into a
// canonical AranyaEvent, called identically by Audio Upload, Live
// Listen, and the simulated-sensor path. Whichever page calls this
// is what reaches the dashboard/alerts/map/incidents/analytics :
// there is no second, parallel event system.
// ============================================================

/**
 * Minimum pooled secondary-class score during a confirmed event's window
 * required to justify an application-level interpretation note (e.g.
 * "Vehicle / Chainsaw-like activity"). Deliberately NOT triggered by
 * trace-level noise: chosen as a modest but real bar above what pure
 * background noise produces for an unrelated class. This is a heuristic
 * threshold, not a measured value; it exists so the note is genuinely
 * data-justified per event rather than a blanket relabel of every
 * 'vehicle' detection.
 */
const INTERPRETATION_SCORE_FLOOR = 0.12;

/**
 * Application-level interpretation layer: relabels a raw classifier
 * result ONLY when a specific, justified secondary signal is present in
 * the SAME event's window: never a blanket rename of a whole class.
 * Currently covers the one case product/judges explicitly care about:
 * a real chainsaw's motor noise sometimes lands the model on the
 * broader 'vehicle'/engine family rather than the narrow 'chainsaw'
 * AudioSet classes (verified during development against real chainsaw
 * recordings: see docs/architecture/browser-inference.md). If the same window also shows
 * elevated chainsaw-family signal, we say so; otherwise the raw label
 * stands unqualified.
 */
export function computeInterpretationNote(
  eventClass: SoundEventClass,
  relatedScores?: Partial<Record<SoundEventClass, number>>
): string | undefined {
  if (eventClass !== 'vehicle') return undefined;
  const chainsawScore = relatedScores?.chainsaw ?? 0;
  if (chainsawScore >= INTERPRETATION_SCORE_FLOOR) {
    return `Classifier's top label was "Vehicle/Engine", but chainsaw-family signal was also elevated in this window (${(chainsawScore * 100).toFixed(0)}%): may be chainsaw/motorized-tool activity rather than a vehicle.`;
  }
  return undefined;
}

// ============================================================
// ALERT POLICY: single source of truth (Alerts page, Dashboard "Active
// Alerts"/badge counts, and Analytics all read AranyaEvent.alertEligible
// rather than re-deriving their own rule).
// ------------------------------------------------------------
// Every class listed here always continues to be genuinely detected and
// stored (visible in the audio timeline, Incident Details, Analytics) :
// this policy only controls whether it also escalates to an actionable
// alert.
// ============================================================

/** Never escalate to an alert regardless of confidence: purely informational/contextual. */
const NEVER_ALERT_CLASSES: SoundEventClass[] = ['wildlife', 'background'];

/**
 * Classes where a false alarm is costly enough (crying "fire" or "metal
 * clanking" on ambiguous/generic acoustic evidence) that we require more
 * than the bare minimum confirmation margin before treating it as an
 * actionable problem. Below 'moderate' evidence, the event is still real
 * and recorded, but shown as ambiguous rather than pushed into Alerts.
 */
const EVIDENCE_GATED_ALERT_CLASSES: SoundEventClass[] = ['fire', 'metal_tool_activity'];

/**
 * How far above its class's confirmation threshold (timelineSegmenter's
 * CONFIRMATION_POLICY_BY_PROVIDER: the SAME threshold already used to
 * decide "is this an event at all") a confidence value sits. Reused here
 * rather than inventing a second set of numbers.
 */
export function computeEvidenceStrength(confidence: number, threshold: number): 'weak' | 'moderate' | 'strong' {
  const margin = confidence - threshold;
  if (margin < 0.1) return 'weak';
  if (margin < 0.25) return 'moderate';
  return 'strong';
}

/**
 * The actual alert-eligibility decision. Gunshot, chainsaw, vehicle, and
 * tree_fall are the threat classes the whole project is built around :
 * any confirmed detection of them is worth a ranger's attention. Fire and
 * metal-clanking are real but acoustically ambiguous classes (see
 * audiosetMapping.ts's comments on fire, and heuristicPlugin's
 * hand-tuned metal_tool_activity formula): they require at least 'moderate'
 * evidence before crying alarm. Wildlife/background never alert.
 */
export function isAlertEligible(eventClass: SoundEventClass, evidenceStrength: 'weak' | 'moderate' | 'strong'): boolean {
  if (NEVER_ALERT_CLASSES.includes(eventClass)) return false;
  if (EVIDENCE_GATED_ALERT_CLASSES.includes(eventClass)) return evidenceStrength !== 'weak';
  return true;
}

export interface CreateEventInput {
  eventClass: SoundEventClass;
  confidence: number;
  startTime?: number;
  endTime?: number;
  source: EventSource;
  model: ModelProvenance;
  temporalConfirmation: TemporalConfirmationInfo;
  timingPrecision: TimingPrecision;
  location?: EventLocation;
  evidence?: EventEvidence;
  /** Pooled scores of other classes during this event's window, used only for computeInterpretationNote. */
  relatedScores?: Partial<Record<SoundEventClass, number>>;
  /** Only set by the explicitly-simulated multi-node Demo Mode scenario. */
  localization?: LocalizationEstimate;
}

export interface EventBuildContext {
  id: string;
  detectedAt: string;
}

function describeAudioReference(input: CreateEventInput): string {
  if (input.source.type === 'upload') {
    const range =
      input.startTime !== undefined && input.endTime !== undefined
        ? ` @ ${input.startTime.toFixed(2)}s to ${input.endTime.toFixed(2)}s`
        : '';
    return `${input.source.fileName ?? 'uploaded audio'}${range}`;
  }
  if (input.source.type === 'live-mic') {
    return 'Live microphone capture (browser)';
  }
  return 'Simulated sensor telemetry: no audio evidence';
}

export function buildEvent(input: CreateEventInput, context: EventBuildContext): AranyaEvent {
  // isSimulated is derived from the source, never set independently :
  // the pre-rebuild code hardcoded `isSimulated: true` unconditionally
  // in alertManager.createAlert, which would have mislabeled real
  // upload/live-mic events had it been reused as-is.
  const isSimulated = input.source.type === 'simulated-sensor';
  const nowIso = context.detectedAt;
  const interpretationNote = computeInterpretationNote(input.eventClass, input.relatedScores);
  const evidenceStrength = computeEvidenceStrength(input.confidence, input.temporalConfirmation.threshold);
  const alertEligible = isAlertEligible(input.eventClass, evidenceStrength);

  return {
    id: context.id,
    eventClass: input.eventClass,
    detectedAt: nowIso,
    startTime: input.startTime,
    endTime: input.endTime,
    confidence: input.confidence,
    severity: getSeverityFromClass(input.eventClass, input.confidence, evidenceStrength),
    source: input.source,
    model: input.model,
    temporalConfirmation: input.temporalConfirmation,
    timingPrecision: input.timingPrecision,
    isSimulated,
    location: input.location,
    evidence: input.evidence,
    interpretationNote,
    audioReference: describeAudioReference(input),
    localization: input.localization ?? { status: 'unavailable' },
    evidenceStrength,
    alertEligible,
    verification: {
      status: 'active',
      history: [
        {
          timestamp: nowIso,
          action: 'Event Created',
          detail: `${ALERT_DESCRIPTIONS[input.eventClass] ?? 'Acoustic event detected'}: ${(
            input.confidence * 100
          ).toFixed(1)}% confidence via ${input.model.name} (source: ${input.source.type}).`,
          actor: 'System',
        },
      ],
    },
  };
}
