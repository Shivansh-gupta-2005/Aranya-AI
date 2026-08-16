import { ClassificationResult } from '../../types';

/**
 * Interface for a real audio-classification backend.
 *
 * Implement this to plug in a different model (e.g. a future custom
 * ARANYA-trained model) without touching the pages that consume it —
 * only `audioClassifier.ts` needs to know which plugin(s) to try.
 */
export interface AudioModelPlugin {
  /** Human-readable name shown in diagnostics / result metadata. */
  readonly name: string;
  /** Lazily prepares the model (downloads/compiles weights etc.). */
  load(): Promise<void>;
  /**
   * Classifies a mono PCM buffer.
   * @param audioData raw samples, range approx. [-1, 1]
   * @param sampleRate sample rate of `audioData` in Hz
   */
  predict(audioData: Float32Array, sampleRate: number): Promise<ClassificationResult>;
}
