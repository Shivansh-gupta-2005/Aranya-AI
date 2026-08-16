import { AudioModelPlugin } from './types';
import { ClassificationResult, SoundEventClass, generateId } from '../../types';
import { AUDIOSET_TO_ARANYA, AUDIOSET_NUM_CLASSES } from './audiosetMapping';

// ============================================================
// YAMNet plugin
// ------------------------------------------------------------
// Loads Google's pretrained YAMNet model (521-class AudioSet
// event classifier) via TensorFlow.js and maps its output onto
// ARANYA's 7 forest-relevant sound classes (see audiosetMapping.ts).
//
// YAMNet expects a mono waveform at 16kHz as input and outputs
// per-frame class scores of shape [numFrames, 521], which we
// mean-pool across frames.
//
// The model is fetched from TF Hub's hosted TFJS weights over the
// network the first time it's used, and cached in memory for the
// rest of the session. If the model can't be loaded or inference
// fails for any reason (offline, blocked host, unsupported
// browser), `load()`/`predict()` reject and the caller (see
// audioClassifier.ts) falls back to the offline heuristic plugin —
// the app never breaks or fabricates a result because of this.
// ============================================================

const MODEL_URL =
  'https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/model.json';
const TARGET_SAMPLE_RATE = 16000;
const LOAD_TIMEOUT_MS = 12000;
const PREDICT_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** Simple linear-interpolation resampler (good enough for classification, not for playback quality). */
function resampleTo16k(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === TARGET_SAMPLE_RATE) return samples;
  const ratio = TARGET_SAMPLE_RATE / sourceRate;
  const newLength = Math.max(1, Math.round(samples.length * ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcPos = i / ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    result[i] = a + (b - a) * frac;
  }
  return result;
}

class YamnetPlugin implements AudioModelPlugin {
  readonly name = 'YAMNet (AudioSet, TensorFlow.js, pretrained)';

  private tf: typeof import('@tensorflow/tfjs') | null = null;
  private model: import('@tensorflow/tfjs').GraphModel | null = null;
  private loadPromise: Promise<void> | null = null;
  private permanentlyFailed = false;

  async load(): Promise<void> {
    if (this.model) return;
    if (this.permanentlyFailed) {
      throw new Error('YAMNet previously failed to load in this session.');
    }
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = withTimeout(this.doLoad(), LOAD_TIMEOUT_MS, 'YAMNet model load')
      .catch((err) => {
        this.permanentlyFailed = true;
        this.loadPromise = null;
        throw err;
      });

    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    this.tf = tf;
    this.model = await tf.loadGraphModel(MODEL_URL);
  }

  async predict(audioData: Float32Array, sampleRate: number): Promise<ClassificationResult> {
    const start = performance.now();
    await this.load();

    if (!this.tf || !this.model) {
      throw new Error('YAMNet model is not available.');
    }

    const tf = this.tf;
    const resampled = resampleTo16k(audioData, sampleRate);

    const scores = await withTimeout(
      (async () => {
        return tf.tidy(() => {
          const waveform = tf.tensor1d(resampled);
          const output = this.model!.execute(waveform) as
            | import('@tensorflow/tfjs').Tensor
            | import('@tensorflow/tfjs').Tensor[];
          // YAMNet's TFJS export returns [scores, embeddings, spectrogram];
          // scores is shape [numFrames, 521].
          const scoresTensor = Array.isArray(output) ? output[0] : output;
          const meanScores = scoresTensor.mean(0) as import('@tensorflow/tfjs').Tensor1D;
          return meanScores.arraySync() as number[];
        });
      })(),
      PREDICT_TIMEOUT_MS,
      'YAMNet inference'
    );

    if (!scores || scores.length !== AUDIOSET_NUM_CLASSES) {
      throw new Error('Unexpected YAMNet output shape.');
    }

    const pooled: Record<SoundEventClass, number> = {
      chainsaw: 0, vehicle: 0, wildlife: 0, background: 0,
      gunshot: 0, tree_fall: 0, fire_anomaly: 0,
    };

    for (const [cls, indices] of Object.entries(AUDIOSET_TO_ARANYA) as [SoundEventClass, number[]][]) {
      let sum = 0;
      for (const idx of indices) sum += scores[idx] ?? 0;
      pooled[cls] = sum;
    }

    const total = Object.values(pooled).reduce((a, b) => a + b, 0) || 1e-6;
    const ranked = (Object.entries(pooled) as [SoundEventClass, number][])
      .map(([eventClass, v]) => ({ eventClass, confidence: v / total }))
      .sort((a, b) => b.confidence - a.confidence);

    const elapsed = performance.now() - start;

    return {
      id: generateId(),
      eventClass: ranked[0].eventClass,
      confidence: Math.min(0.97, ranked[0].confidence),
      alternativePredictions: ranked.slice(1),
      timestamp: new Date(),
      isSimulated: false,
      processingTimeMs: Math.max(1, Math.round(elapsed)),
    };
  }
}

export const yamnetPlugin = new YamnetPlugin();
