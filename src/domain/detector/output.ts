import { TARGET_CLASSES, TargetClass } from './taxonomy';

export type TargetScores = Record<TargetClass, number>;

export interface DetectorOutputInput {
  inferenceId: string;
  modelId: string;
  modelVersion: string;
  preprocessingId: string;
  startSeconds: number;
  endSeconds: number;
  timingPrecision: 'exact' | 'approximate';
  scores: TargetScores;
  thresholds: TargetScores;
}

export interface DetectorOutput extends Omit<DetectorOutputInput, 'thresholds'> {
  schemaVersion: '1';
  detections: Array<{ classId: TargetClass; score: number; threshold: number }>;
}

function assertScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

export function createDetectorOutput(input: DetectorOutputInput): DetectorOutput {
  if (input.startSeconds < 0 || input.endSeconds <= input.startSeconds) {
    throw new Error('Detector output needs a valid time interval.');
  }
  const detections = TARGET_CLASSES.flatMap((classId) => {
    const score = input.scores[classId];
    const threshold = input.thresholds[classId];
    assertScore(score, `${classId} score`);
    assertScore(threshold, `${classId} threshold`);
    return score >= threshold ? [{ classId, score, threshold }] : [];
  });
  return {
    schemaVersion: '1',
    inferenceId: input.inferenceId,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    preprocessingId: input.preprocessingId,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
    timingPrecision: input.timingPrecision,
    scores: input.scores,
    detections,
  };
}
