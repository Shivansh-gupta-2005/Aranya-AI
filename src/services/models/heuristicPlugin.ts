import { AudioModelPlugin, FrameScore } from './types';
import { ClassificationResult, SoundEventClass, generateId } from '../../types';
import { hannWindow, magnitudeSpectrum } from '../fft';

// ============================================================
// Heuristic DSP audio classifier
// ------------------------------------------------------------
// A genuinely real (non-random, deterministic) analysis of the
// actual audio signal using classic signal-processing features:
// spectral centroid, spectral flatness, band-energy ratios,
// crest factor, zero-crossing rate, and transient rate. These
// are combined with hand-tuned weights into a score per ARANYA
// sound class.
//
// This is NOT a trained neural network — it is used only as a
// transparent, dependency-free fallback for when a pretrained
// model (see yamnetPlugin.ts) cannot be loaded (e.g. offline, or
// the model host is unreachable). It always analyzes the real
// waveform that was captured/uploaded; it never fabricates a
// result. Confidence is intentionally capped below what a trained
// model would report, since rule-based heuristics are inherently
// less reliable.
// ============================================================

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const MAX_HEURISTIC_CONFIDENCE = 0.78;
const MIN_HEURISTIC_CONFIDENCE = 0.35;

// Outer chunking window for sequence/timeline analysis (distinct from the
// inner FRAME_SIZE/HOP_SIZE used by analyzeSignal's own feature-extraction
// framing, which stays unchanged and runs inside each outer chunk below).
// 1.0s/0.5s balances localizing short transients (e.g. a gunshot) against
// keeping enough samples per chunk for analyzeSignal's averaging to be
// stable. This is a chosen DSP parameter, not a measured value.
const SEQ_WINDOW_SECONDS = 1.0;
const SEQ_HOP_SECONDS = 0.5;

interface FrameFeatures {
  rms: number;
  centroid: number; // Hz
  flatness: number; // 0..1 (1 = noise-like, 0 = tonal)
  lowRatio: number; // 20-300Hz energy ratio
  midRatio: number; // 300-2000Hz
  highRatio: number; // 2000-6000Hz
  veryHighRatio: number; // 6000Hz+
  zcr: number;
}

function computeFrameFeatures(frame: Float32Array, window: Float32Array, sampleRate: number): FrameFeatures {
  let sumSq = 0;
  let zc = 0;
  for (let i = 0; i < frame.length; i++) {
    sumSq += frame[i] * frame[i];
    if (i > 0 && (frame[i] >= 0) !== (frame[i - 1] >= 0)) zc++;
  }
  const rms = Math.sqrt(sumSq / frame.length);
  const zcr = zc / frame.length;

  const mag = magnitudeSpectrum(frame, window);
  const binHz = sampleRate / (mag.length * 2);

  let energySum = 0;
  let weightedFreqSum = 0;
  let logSum = 0;
  let low = 0, mid = 0, high = 0, veryHigh = 0;

  for (let i = 1; i < mag.length; i++) {
    const m = mag[i];
    const freq = i * binHz;
    const power = m * m;
    energySum += power;
    weightedFreqSum += freq * power;
    logSum += Math.log(m + 1e-8);

    if (freq < 300) low += power;
    else if (freq < 2000) mid += power;
    else if (freq < 6000) high += power;
    else veryHigh += power;
  }

  const centroid = energySum > 0 ? weightedFreqSum / energySum : 0;
  const geoMean = Math.exp(logSum / (mag.length - 1));
  const arithMean = energySum > 0 ? Math.sqrt(energySum / (mag.length - 1)) : 1e-8;
  const flatness = Math.min(1, Math.max(0, geoMean / (arithMean + 1e-8)));

  const total = low + mid + high + veryHigh + 1e-8;

  return {
    rms,
    centroid,
    flatness,
    lowRatio: low / total,
    midRatio: mid / total,
    highRatio: high / total,
    veryHighRatio: veryHigh / total,
    zcr,
  };
}

function analyzeSignal(audioData: Float32Array, sampleRate: number) {
  const window = hannWindow(Math.min(FRAME_SIZE, audioData.length || FRAME_SIZE));
  const frames: FrameFeatures[] = [];
  const envelope: number[] = [];

  const padded = audioData.length >= FRAME_SIZE ? audioData : (() => {
    const p = new Float32Array(FRAME_SIZE);
    p.set(audioData);
    return p;
  })();

  for (let start = 0; start + window.length <= padded.length; start += HOP_SIZE) {
    const frame = padded.subarray(start, start + window.length);
    frames.push(computeFrameFeatures(frame, window, sampleRate));
    envelope.push(frames[frames.length - 1].rms);
  }

  if (frames.length === 0) {
    frames.push(computeFrameFeatures(padded.subarray(0, window.length), window, sampleRate));
    envelope.push(frames[0].rms);
  }

  // Peak / crest factor (overall)
  let peak = 0;
  for (let i = 0; i < audioData.length; i++) {
    const a = Math.abs(audioData[i]);
    if (a > peak) peak = a;
  }
  const meanRms = envelope.reduce((a, b) => a + b, 0) / envelope.length;
  const crestFactor = meanRms > 0 ? peak / meanRms : 1;

  // Transient rate: count envelope jumps that exceed 2x the local trailing average
  let transients = 0;
  for (let i = 2; i < envelope.length; i++) {
    const localAvg = (envelope[i - 1] + envelope[i - 2]) / 2 + 1e-6;
    if (envelope[i] > localAvg * 2.2) transients++;
  }
  const transientRate = transients / Math.max(1, envelope.length);

  const avg = (key: keyof FrameFeatures) =>
    frames.reduce((a, f) => a + f[key], 0) / frames.length;

  return {
    rms: avg('rms'),
    centroid: avg('centroid'),
    flatness: avg('flatness'),
    lowRatio: avg('lowRatio'),
    midRatio: avg('midRatio'),
    highRatio: avg('highRatio'),
    veryHighRatio: avg('veryHighRatio'),
    zcr: avg('zcr'),
    crestFactor,
    transientRate,
  };
}

type Features = ReturnType<typeof analyzeSignal>;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hand-tuned rule scores (0..1, un-normalized) per ARANYA class. */
function scoreClasses(f: Features): Record<SoundEventClass, number> {
  const lowMidTonal = clamp01(1 - f.flatness) * (f.lowRatio + f.midRatio);
  const steady = clamp01(1 - Math.min(1, f.crestFactor / 6));
  const impulsive = clamp01((f.crestFactor - 3) / 6);
  const sparseTransients = clamp01(f.transientRate * 3) * (1 - clamp01((f.crestFactor - 6) / 6));

  const scores: Record<SoundEventClass, number> = {
    chainsaw:
      0.45 * lowMidTonal +
      0.25 * steady +
      0.2 * clamp01(f.zcr * 8) +
      0.1 * clamp01(f.rms * 6),
    vehicle:
      0.5 * f.lowRatio +
      0.25 * steady +
      0.15 * clamp01(1 - f.flatness) +
      0.1 * clamp01(f.rms * 4),
    wildlife:
      0.4 * clamp01(1 - f.flatness) * (f.midRatio + f.highRatio) +
      0.3 * clamp01(f.zcr * 5) +
      0.3 * (1 - steady) * 0.6,
    background:
      0.55 * f.flatness +
      0.25 * steady +
      0.2 * (f.lowRatio + f.midRatio + f.highRatio + f.veryHighRatio > 0 ? 1 - Math.abs(f.lowRatio - 0.25) : 0),
    gunshot:
      0.55 * impulsive * clamp01(1 - f.transientRate * 2) +
      0.25 * clamp01(f.rms * 5) +
      0.2 * (f.lowRatio + f.midRatio),
    tree_fall:
      0.4 * impulsive +
      0.3 * sparseTransients +
      0.3 * f.lowRatio,
    fire_anomaly:
      0.5 * sparseTransients +
      0.3 * f.veryHighRatio +
      0.2 * f.flatness,
    // Metallic clanking: impulsive like gunshot/tree_fall, but with more
    // tonal "ring" (resonance) than a broadband gunshot report and more
    // high-frequency energy than a duller wood impact.
    metal_clank:
      0.4 * impulsive +
      0.3 * f.veryHighRatio +
      0.3 * clamp01(1 - f.flatness),
  };

  return scores;
}

/**
 * Normalizes raw per-class heuristic scores into a probability-like
 * distribution, then rescales the winner into a believable, capped band
 * (a rule-based heuristic should never claim near-certainty) based on how
 * far it leads the runner-up. Shared by both the single-shot predict()
 * result and the per-frame predictSequence() timeline so a given signal
 * is scored consistently regardless of which entry point is used.
 */
function scaleHeuristicScores(
  rawScores: Record<SoundEventClass, number>
): { top: SoundEventClass; scaled: Record<SoundEventClass, number> } {
  const entries = Object.entries(rawScores) as [SoundEventClass, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;

  const normalized = entries
    .map(([eventClass, v]) => ({ eventClass, confidence: v / total }))
    .sort((a, b) => b.confidence - a.confidence);

  const spread = normalized[0].confidence - (normalized[1]?.confidence ?? 0);
  const scaledTop =
    MIN_HEURISTIC_CONFIDENCE +
    clamp01(spread * 2.2) * (MAX_HEURISTIC_CONFIDENCE - MIN_HEURISTIC_CONFIDENCE);

  const scaled = {} as Record<SoundEventClass, number>;
  normalized.forEach((entry, i) => {
    scaled[entry.eventClass] = i === 0 ? scaledTop : entry.confidence * scaledTop;
  });

  return { top: normalized[0].eventClass, scaled };
}

function toClassificationResult(
  scores: Record<SoundEventClass, number>,
  processingTimeMs: number
): ClassificationResult {
  const { top, scaled } = scaleHeuristicScores(scores);
  const ranked = (Object.entries(scaled) as [SoundEventClass, number][]).sort((a, b) => b[1] - a[1]);

  return {
    id: generateId(),
    eventClass: top,
    confidence: scaled[top],
    alternativePredictions: ranked.slice(1).map(([eventClass, confidence]) => ({ eventClass, confidence })),
    timestamp: new Date(),
    isSimulated: false,
    processingTimeMs,
  };
}

class HeuristicPlugin implements AudioModelPlugin {
  readonly name = 'ARANYA-DSP-Heuristic-v1 (rule-based, offline)';

  async load(): Promise<void> {
    // No weights to load — pure signal processing.
    return;
  }

  async predict(audioData: Float32Array, sampleRate: number): Promise<ClassificationResult> {
    const start = performance.now();
    if (!audioData || audioData.length === 0) {
      throw new Error('Empty audio buffer — nothing to analyze.');
    }
    const features = analyzeSignal(audioData, sampleRate);
    const scores = scoreClasses(features);
    const elapsed = performance.now() - start;
    return toClassificationResult(scores, Math.max(1, Math.round(elapsed)));
  }

  async predictSequence(audioData: Float32Array, sampleRate: number): Promise<FrameScore[]> {
    if (!audioData || audioData.length === 0) {
      throw new Error('Empty audio buffer — nothing to analyze.');
    }

    const windowSamples = Math.max(FRAME_SIZE, Math.round(SEQ_WINDOW_SECONDS * sampleRate));
    const hopSamples = Math.max(1, Math.round(SEQ_HOP_SECONDS * sampleRate));

    const frames: FrameScore[] = [];
    for (let start = 0; start < audioData.length; start += hopSamples) {
      const end = Math.min(start + windowSamples, audioData.length);
      const chunk = audioData.subarray(start, end);
      const features = analyzeSignal(chunk, sampleRate);
      const rawScores = scoreClasses(features);
      const { scaled } = scaleHeuristicScores(rawScores);

      frames.push({
        startTime: start / sampleRate,
        endTime: end / sampleRate,
        scores: scaled,
        // Heuristic chunking is a chosen fixed hop, not a verified model
        // framing constant — always tagged approximate.
        timingPrecision: 'approximate',
      });

      if (end >= audioData.length) break;
    }

    return frames;
  }
}

export const heuristicPlugin = new HeuristicPlugin();
