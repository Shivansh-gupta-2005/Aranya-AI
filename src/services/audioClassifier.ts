import { ClassificationResult } from '../types';
import { AudioModelPlugin, FrameScore } from './models/types';
import { yamnetPlugin } from './models/yamnetPlugin';
import { heuristicPlugin } from './models/heuristicPlugin';

// Re-exported for backward compatibility with anything importing the
// plugin interface from this module.
export type { AudioModelPlugin };

export type ModelSource = 'yamnet' | 'heuristic';

export interface SequenceClassificationResult {
  frames: FrameScore[];
  modelSource: ModelSource;
  modelName: string;
}

/**
 * Real audio classification entry point used by Audio Upload and Live Listen.
 *
 * Tries the pretrained YAMNet (AudioSet) model first: a real, general-purpose
 * sound-event classifier: and falls back to a transparent, offline
 * DSP/signal-processing heuristic classifier if the model can't be loaded or
 * inference fails (e.g. no network access to fetch model weights, WebGL
 * unavailable, etc). Both paths analyze the actual audio that was
 * uploaded or captured. Neither path fabricates a result. If both paths
 * fail, this function throws so the caller can report an inference failure
 * without creating an event.
 */
export const classifyAudio = async (
  audioData: Float32Array,
  sampleRate: number
): Promise<ClassificationResult> => {
  try {
    const result = await yamnetPlugin.predict(audioData, sampleRate);
    return { ...result, modelSource: 'yamnet' };
  } catch (yamnetError) {
    console.warn('YAMNet unavailable, falling back to heuristic classifier:', yamnetError);
  }

  try {
    const result = await heuristicPlugin.predict(audioData, sampleRate);
    return { ...result, modelSource: 'heuristic' };
  } catch (heuristicError) {
    console.error('Heuristic classifier failed:', heuristicError);
    throw heuristicError;
  }
};

/**
 * Real sliding-window/frame-based classification entry point used by Audio
 * Upload's full-timeline analysis. Same YAMNet-first, heuristic-fallback
 * cascade philosophy as classifyAudio() above, but preserves per-frame
 * timing so multiple distinct, timestamped events can be derived from one
 * clip (see timelineSegmenter.ts) instead of collapsing to one result.
 *
 * Unlike classifyAudio(), this has no last-resort fabricated placeholder :
 * if both real backends fail, it throws, and the caller must report that
 * honestly rather than inventing a timeline.
 */
export const classifySequence = async (
  audioData: Float32Array,
  sampleRate: number
): Promise<SequenceClassificationResult> => {
  try {
    const frames = await yamnetPlugin.predictSequence(audioData, sampleRate);
    return { frames, modelSource: 'yamnet', modelName: yamnetPlugin.name };
  } catch (yamnetError) {
    console.warn('YAMNet unavailable, falling back to heuristic classifier for sequence analysis:', yamnetError);
  }

  const frames = await heuristicPlugin.predictSequence(audioData, sampleRate);
  return { frames, modelSource: 'heuristic', modelName: heuristicPlugin.name };
};
