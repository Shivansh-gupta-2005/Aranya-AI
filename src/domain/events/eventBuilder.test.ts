import { describe, expect, it } from 'vitest';
import { buildEvent, CreateEventInput } from './eventBuilder';

function input(eventClass: CreateEventInput['eventClass']): CreateEventInput {
  return {
    eventClass,
    confidence: 0.81,
    source: { type: 'upload', fileName: 'sample.wav' },
    model: { provider: 'yamnet', name: 'YAMNet baseline' },
    temporalConfirmation: {
      windowsUsed: 3,
      windowsRequired: 3,
      threshold: 0.6,
      isConfirmed: true,
    },
    timingPrecision: 'exact',
  };
}

describe('buildEvent', () => {
  it('is deterministic for supplied context', () => {
    const context = { id: 'event-1', detectedAt: '2026-08-26T00:00:00.000Z' };

    expect(buildEvent(input('gunfire'), context)).toEqual(buildEvent(input('gunfire'), context));
  });

  it('keeps context classes out of actionable alerts', () => {
    const event = buildEvent(input('background'), {
      id: 'event-2',
      detectedAt: '2026-08-26T00:00:00.000Z',
    });

    expect(event.alertEligible).toBe(false);
  });
});
