import { ClassificationResult, DemoScenario, SoundEventClass, generateId } from '../types';
import { AudioModelPlugin } from './models/types';
import { yamnetPlugin } from './models/yamnetPlugin';
import { heuristicPlugin } from './models/heuristicPlugin';

// Re-exported for backward compatibility with anything importing the
// plugin interface from this module.
export type { AudioModelPlugin };

/**
 * Real audio classification entry point used by Audio Upload and Live Listen.
 *
 * Tries the pretrained YAMNet (AudioSet) model first — a real, general-purpose
 * sound-event classifier — and falls back to a transparent, offline
 * DSP/signal-processing heuristic classifier if the model can't be loaded or
 * inference fails (e.g. no network access to fetch model weights, WebGL
 * unavailable, etc). Both paths analyze the actual audio that was
 * uploaded/captured; neither ever fabricates a result. Only if both real
 * paths fail outright (e.g. a genuinely empty/corrupt buffer) do we fall
 * back to a clearly-labeled simulated placeholder so the UI never breaks.
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
  }

  // Last-resort placeholder — only reached if the audio buffer itself is
  // unusable. Clearly labeled as simulated so it's never mistaken for a
  // real analysis result.
  const delay = 200;
  const classes: SoundEventClass[] = ['chainsaw', 'vehicle', 'wildlife', 'background', 'gunshot', 'tree_fall', 'fire_anomaly'];
  const topClass = classes[Math.floor(Math.random() * classes.length)];
  return {
    id: generateId(),
    eventClass: topClass,
    confidence: 0.5,
    alternativePredictions: classes
      .filter((c) => c !== topClass)
      .map((c) => ({ eventClass: c, confidence: 0.1 })),
    timestamp: new Date(),
    isSimulated: true,
    processingTimeMs: delay,
    modelSource: 'simulated',
  };
};

export const classifyForDemo = async (scenario: DemoScenario): Promise<ClassificationResult> => {
  const delay = Math.random() * 600 + 200;
  await new Promise((resolve) => setTimeout(resolve, delay));

  let eventClass: SoundEventClass = 'background';
  let minConf = 0;
  let maxConf = 0;

  switch (scenario) {
    case 'chainsaw':
      eventClass = 'chainsaw';
      minConf = 0.87;
      maxConf = 0.95;
      break;
    case 'vehicle':
      eventClass = 'vehicle';
      minConf = 0.82;
      maxConf = 0.91;
      break;
    case 'wildlife':
      eventClass = 'wildlife';
      minConf = 0.78;
      maxConf = 0.92;
      break;
    case 'gunshot':
      eventClass = 'gunshot';
      minConf = 0.71;
      maxConf = 0.85;
      break;
    case 'fire':
      eventClass = 'fire_anomaly';
      minConf = 0.65;
      maxConf = 0.80;
      break;
  }

  const confidence = minConf + Math.random() * (maxConf - minConf);

  const classes: SoundEventClass[] = ['chainsaw', 'vehicle', 'wildlife', 'background', 'gunshot', 'tree_fall', 'fire_anomaly'];
  const alternativePredictions = classes
    .filter(c => c !== eventClass)
    .map(c => ({
      eventClass: c,
      confidence: Math.random() * (minConf - 0.2) // Keep alternatives lower than main prediction
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    id: generateId(),
    eventClass,
    confidence,
    alternativePredictions,
    timestamp: new Date(),
    isSimulated: true,
    processingTimeMs: delay,
  };
};
