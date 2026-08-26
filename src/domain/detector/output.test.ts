import { describe, expect, it } from 'vitest';
import { createDetectorOutput } from './output';

describe('createDetectorOutput', () => {
  it('keeps independent target detections', () => {
    const output = createDetectorOutput({
      inferenceId: 'inference-1',
      modelId: 'yamnet-a1',
      modelVersion: '1',
      preprocessingId: 'yamnet-16khz-v1',
      startSeconds: 0,
      endSeconds: 0.96,
      timingPrecision: 'exact',
      scores: {
        gunfire: 0.8,
        chainsaw: 0.7,
        metal_tool_activity: 0.1,
        fire: 0.2,
        vehicle: 0.3,
      },
      thresholds: {
        gunfire: 0.6,
        chainsaw: 0.6,
        metal_tool_activity: 0.6,
        fire: 0.6,
        vehicle: 0.6,
      },
    });

    expect(output.detections.map((detection) => detection.classId)).toEqual([
      'gunfire',
      'chainsaw',
    ]);
    expect('background' in output.scores).toBe(false);
  });

  it('rejects invalid timestamps and provenance', () => {
    expect(() =>
      createDetectorOutput({
        inferenceId: '',
        modelId: 'model',
        modelVersion: '1',
        preprocessingId: 'prep',
        startSeconds: Number.NaN,
        endSeconds: 1,
        timingPrecision: 'exact',
        scores: {
          gunfire: 0,
          chainsaw: 0,
          metal_tool_activity: 0,
          fire: 0,
          vehicle: 0,
        },
        thresholds: {
          gunfire: 0.6,
          chainsaw: 0.6,
          metal_tool_activity: 0.6,
          fire: 0.6,
          vehicle: 0.6,
        },
      })
    ).toThrow('inferenceId');
  });
});
