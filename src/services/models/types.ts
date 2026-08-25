import { ClassificationResult, SoundEventClass } from '../../types';

/**
 * Whether a frame's start/end timestamps come from the model's known,
 * verified fixed framing (exact) or a best-effort fallback derivation
 * (approximate). Must be surfaced to the UI, never presented uniformly.
 */
export type TimingPrecision = 'exact' | 'approximate';

/**
 * One time-localized set of per-class scores, produced by sliding-window /
 * frame-based analysis of a full clip. Scores are normalized to sum to
 * ~1 across ARANYA's classes for that frame.
 */
export interface FrameScore {
  startTime: number;
  endTime: number;
  scores: Record<SoundEventClass, number>;
  timingPrecision: TimingPrecision;
}

/**
 * Interface for a real audio-classification backend.
 *
 * Implement this to plug in a different model (e.g. a future custom
 * ARANYA-trained model) without touching the pages that consume it :
 * only `audioClassifier.ts` needs to know which plugin(s) to try.
 */
export interface AudioModelPlugin {
  /** Human-readable name shown in diagnostics / result metadata. */
  readonly name: string;
  /** Lazily prepares the model (downloads/compiles weights etc.). */
  load(): Promise<void>;
  /**
   * Classifies a mono PCM buffer as a single whole-buffer result.
   * @param audioData raw samples, range approx. [-1, 1]
   * @param sampleRate sample rate of `audioData` in Hz
   */
  predict(audioData: Float32Array, sampleRate: number): Promise<ClassificationResult>;
  /**
   * Classifies a mono PCM buffer as a time-ordered sequence of frame-level
   * scores, preserving *when* within the clip each score applies: the
   * basis for multi-event, timestamped detection over a full recording.
   * @param audioData raw samples, range approx. [-1, 1]
   * @param sampleRate sample rate of `audioData` in Hz
   */
  predictSequence(audioData: Float32Array, sampleRate: number): Promise<FrameScore[]>;
}
