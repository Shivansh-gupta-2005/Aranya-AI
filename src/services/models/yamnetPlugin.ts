import { AudioModelPlugin, FrameScore, TimingPrecision } from './types';
import { ClassificationResult, SoundEventClass, generateId } from '../../types';
import {
  AUDIOSET_NUM_CLASSES,
  poolCurrentNormalizedScores,
} from './audiosetMapping';

// ============================================================
// YAMNet plugin
// ------------------------------------------------------------
// Loads Google's pretrained YAMNet model (521-class AudioSet
// event classifier) via TensorFlow.js and maps its output onto
// ARANYA's 7 forest-relevant sound classes (see audiosetMapping.ts).
//
// YAMNet expects a mono waveform at 16kHz as input and internally
// frames it into overlapping patches (its own STFT + mel-spectrogram
// + patch windowing), outputting one 521-class score vector per
// patch: shape [numFrames, 521]. We run the model ONCE on the full
// waveform and read that native per-frame output directly (used by
// predictSequence, for multi-event timestamped analysis); predict()
// additionally mean-pools it into a single whole-clip result for
// backward-compatible single-shot callers (e.g. Live Listen's short
// rolling buffer).
//
// The model is served locally from this app's own public/ assets
// (public/models/yamnet/model.json + weight shards), converted from
// Google's original published yamnet.h5 weights: see
// docs/architecture/browser-inference.md for the conversion procedure. The original TF
// Hub-hosted TFJS bundle this used to load from is no longer publicly
// reachable (confirmed: storage.googleapis.com/tfhub-tfjs-modules/...
// returns 403; the tfhub.dev handle now redirects to Kaggle's generic
// model-search page instead of the asset). Loading from a same-origin
// static path keeps this browser-only with no backend, and the weights
// are still fetched over HTTP on first use (from localhost instead of
// a third party) and cached in memory for the rest of the session: so
// this remains real network-loaded client-side inference, not offline/
// embedded edge inference. If the model can't be loaded or inference
// fails for any reason, `load()`/`predict()`/`predictSequence()` reject
// and the caller (see audioClassifier.ts) falls back to the offline
// heuristic plugin: the app never breaks or fabricates a result because
// of this.
// ============================================================

const MODEL_URL = '/models/yamnet/model.json';
const TARGET_SAMPLE_RATE = 16000;
const LOAD_TIMEOUT_MS = 12000;
const PREDICT_TIMEOUT_MS = 8000;

// YAMNet's published, fixed internal patch framing (Google Research
// yamnet/params.py: PATCH_WINDOW_SECONDS=0.96, PATCH_HOP_SECONDS=0.48).
// Used to compute frame timestamps, cross-checked at runtime against the
// actual frame count the loaded graph returns: see deriveFrameTiming().
const PATCH_WINDOW_SECONDS = 0.96;
const PATCH_HOP_SECONDS = 0.48;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/**
 * Resamples to 16kHz using the browser's own OfflineAudioContext rather
 * than a hand-rolled interpolator. A naive linear-interpolation resample
 * (the previous approach here) has no anti-aliasing filter, which folds
 * high-frequency energy back into the audible band as noise: exactly the
 * kind of artifact that would corrupt the harmonically-rich high-frequency
 * detail a real classifier relies on (e.g. distinguishing a chainsaw's
 * buzz). The browser's resampler is a proper, high-quality implementation
 * already used elsewhere in the app (decodeAudioData); reusing it here
 * for the 48kHz(device-native)->16kHz(YAMNet input) step is strictly more
 * correct, independent of what audio is being analyzed.
 */
async function resampleTo16k(samples: Float32Array, sourceRate: number): Promise<Float32Array> {
  if (sourceRate === TARGET_SAMPLE_RATE) return samples;

  const OfflineCtor =
    (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const durationSeconds = samples.length / sourceRate;
  const targetLength = Math.max(1, Math.ceil(durationSeconds * TARGET_SAMPLE_RATE));

  const offlineCtx = new OfflineCtor(1, targetLength, TARGET_SAMPLE_RATE);
  const sourceBuffer = offlineCtx.createBuffer(1, samples.length, sourceRate);
  sourceBuffer.copyToChannel(samples, 0);

  const src = offlineCtx.createBufferSource();
  src.buffer = sourceBuffer;
  src.connect(offlineCtx.destination);
  src.start();

  const rendered: AudioBuffer = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Computes, for each of `numFrames` output frames, a [startTime, endTime]
 * pair and whether that timing should be trusted as exact.
 *
 * Strategy: compute the frame count YAMNet's fixed 0.96s/0.48s framing
 * would be expected to produce for `durationSeconds`, and compare against
 * the graph's *actual* `numFrames`. If they agree (within rounding), the
 * hardcoded hop is used and timing is tagged 'exact'. If they disagree :
 * meaning this specific hosted graph pads/frames differently than assumed :
 * timing falls back to an even split of the real duration and is tagged
 * 'approximate', so the UI never claims precision that isn't there.
 */
function deriveFrameTiming(
  numFrames: number,
  durationSeconds: number
): { starts: number[]; ends: number[]; precision: TimingPrecision } {
  const expectedFrames =
    durationSeconds <= PATCH_WINDOW_SECONDS
      ? 1
      : Math.floor((durationSeconds - PATCH_WINDOW_SECONDS) / PATCH_HOP_SECONDS) + 1;

  const matchesExpected = Math.abs(expectedFrames - numFrames) <= 1;

  if (matchesExpected) {
    const starts: number[] = [];
    const ends: number[] = [];
    for (let i = 0; i < numFrames; i++) {
      const start = i * PATCH_HOP_SECONDS;
      starts.push(start);
      ends.push(Math.min(start + PATCH_WINDOW_SECONDS, durationSeconds));
    }
    return { starts, ends, precision: 'exact' };
  }

  // Fallback: even split across the real duration.
  const hop = numFrames > 0 ? durationSeconds / numFrames : durationSeconds;
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    starts.push(i * hop);
    ends.push((i + 1) * hop);
  }
  return { starts, ends, precision: 'approximate' };
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
    // Plain same-origin model.json: NOT a tfhub.dev archive handle,
    // so fromTFHub must not be set (that option expects TF Hub's
    // special versioned-archive URL scheme, not a static model.json).
    this.model = await tf.loadGraphModel(MODEL_URL);
  }

  /** Runs the model once on the full waveform and returns the raw, un-pooled [numFrames, 521] scores. */
  private async runRawInference(audioData: Float32Array, sampleRate: number): Promise<number[][]> {
    await this.load();
    if (!this.tf || !this.model) {
      throw new Error('YAMNet model is not available.');
    }
    const tf = this.tf;
    const resampled = await resampleTo16k(audioData, sampleRate);

    const rawScores = await withTimeout(
      (async () => {
        return tf.tidy(() => {
          const waveform = tf.tensor1d(resampled);
          const output = this.model!.execute(waveform) as
            | import('@tensorflow/tfjs').Tensor
            | import('@tensorflow/tfjs').Tensor[];
          // The YAMNet model exposes 3 outputs (predictions [numFrames,521],
          // embeddings [numFrames,1024], log_mel_spectrogram [numSTFTframes,64]).
          // Don't assume list order: the SavedModel->TFJS conversion may not
          // preserve the original Python output ordering. Find the tensor
          // whose last dimension is exactly 521 (the class-score tensor),
          // identified by shape, not position.
          const outputs = Array.isArray(output) ? output : [output];
          // eslint-disable-next-line no-console
          console.log('[Aranya][yamnet] model outputs:', outputs.map((t) => t.shape));
          const scoresTensor = outputs.find((t) => t.shape[t.shape.length - 1] === AUDIOSET_NUM_CLASSES);
          if (!scoresTensor) {
            throw new Error(
              `Could not locate the ${AUDIOSET_NUM_CLASSES}-class scores tensor among model outputs with shapes: ${outputs
                .map((t) => `[${t.shape.join(',')}]`)
                .join(', ')}`
            );
          }
          return scoresTensor.arraySync() as number[][];
        });
      })(),
      PREDICT_TIMEOUT_MS,
      'YAMNet inference'
    );

    if (!rawScores || rawScores.length === 0 || rawScores[0].length !== AUDIOSET_NUM_CLASSES) {
      throw new Error('Unexpected YAMNet output shape.');
    }
    return rawScores;
  }

  async predict(audioData: Float32Array, sampleRate: number): Promise<ClassificationResult> {
    const start = performance.now();
    const rawScores = await this.runRawInference(audioData, sampleRate);

    // Mean-pool across frames for a single whole-buffer result (used by
    // short-buffer callers like Live Listen's rolling window, where the
    // buffer is already a short slice and per-frame detail isn't needed).
    const numClasses = rawScores[0].length;
    const meanScores = new Array<number>(numClasses).fill(0);
    for (const frame of rawScores) {
      for (let i = 0; i < numClasses; i++) meanScores[i] += frame[i];
    }
    for (let i = 0; i < numClasses; i++) meanScores[i] /= rawScores.length;

    const pooled = poolCurrentNormalizedScores(meanScores);
    const ranked = (Object.entries(pooled) as [SoundEventClass, number][]).sort((a, b) => b[1] - a[1]);

    const elapsed = performance.now() - start;

    return {
      id: generateId(),
      eventClass: ranked[0][0],
      confidence: Math.min(0.97, ranked[0][1]),
      alternativePredictions: ranked.slice(1).map(([eventClass, confidence]) => ({ eventClass, confidence })),
      timestamp: new Date(),
      isSimulated: false,
      processingTimeMs: Math.max(1, Math.round(elapsed)),
    };
  }

  async predictSequence(audioData: Float32Array, sampleRate: number): Promise<FrameScore[]> {
    const rawScores = await this.runRawInference(audioData, sampleRate);
    const durationSeconds = audioData.length / sampleRate;
    const { starts, ends, precision } = deriveFrameTiming(rawScores.length, durationSeconds);

    return rawScores.map((frame, i) => ({
      startTime: starts[i],
      endTime: ends[i],
      scores: poolCurrentNormalizedScores(frame),
      timingPrecision: precision,
    }));
  }
}

export const yamnetPlugin = new YamnetPlugin();
