import { buildEvent, CreateEventInput } from '../../domain/events/eventBuilder';
import { useEventStore } from '../../stores/eventStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { formatTimestamp, generateId } from '../../types';
import { AranyaEvent, FeedbackRecord, VerificationStatus } from '../../types/event';

export function createEventFromClassification(input: CreateEventInput): AranyaEvent {
  return buildEvent(input, {
    id: generateId(),
    detectedAt: new Date().toISOString(),
  });
}

export function recordEvent(event: AranyaEvent): void {
  useEventStore.getState().addEvent(event);
}

export function recordVerification(
  event: AranyaEvent,
  status: VerificationStatus,
  notes?: string,
  actor: string = 'User'
): void {
  useEventStore.getState().updateVerification(event.id, status, notes, actor);

  if (status === 'verified' || status === 'false_alarm') {
    const record: FeedbackRecord = {
      id: generateId(),
      eventId: event.id,
      recordedAt: new Date().toISOString(),
      predictedClass: event.eventClass,
      predictedConfidence: event.confidence,
      eventTimestamp: formatTimestamp(new Date(event.detectedAt)),
      sensorId: event.source.sensorId,
      zone: event.location?.zone,
      audioReference: event.audioReference,
      verdict: status === 'verified' ? 'true_positive' : 'false_alarm',
      notes,
    };
    useFeedbackStore.getState().addRecord(record);
  }
}
