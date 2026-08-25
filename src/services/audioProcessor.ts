import { AudioAnalysis } from '../types';
import { hannWindow, magnitudeSpectrum } from './fft';

export const processAudioBuffer = (buffer: AudioBuffer): AudioAnalysis => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const waveform = downsampleWaveform(data, 500);
  const spectrogram = createSpectrogram(data, sampleRate);
  const rmsLevel = calculateRMS(data);
  const peakLevel = calculatePeak(data);

  return {
    waveform,
    spectrogram,
    sampleRate,
    duration,
    rmsLevel,
    peakLevel,
  };
};

/**
 * Real short-time Fourier transform (STFT) spectrogram.
 * Splits the signal into overlapping windowed frames, runs an FFT on each,
 * and returns log-scaled, normalized magnitudes as [time][frequencyBin].
 * Capped to a fixed number of time/frequency bins for rendering.
 */
export const createSpectrogram = (audioData: Float32Array, _sampleRate: number): number[][] => {
  const targetFrames = 100;
  const targetBins = 96;
  const frameSize = 1024;

  if (!audioData || audioData.length === 0) {
    return [];
  }

  const hop = Math.max(1, Math.floor(audioData.length / targetFrames));
  const window = hannWindow(frameSize);

  const rawFrames: number[][] = [];
  let maxLog = -Infinity;
  let minLog = Infinity;

  for (let start = 0; start + frameSize <= audioData.length && rawFrames.length < targetFrames; start += hop) {
    const frame = audioData.subarray(start, start + frameSize);
    const mag = magnitudeSpectrum(frame, window);

    // Bin the full magnitude spectrum down to targetBins (log-ish grouping
    // so lower frequencies — where most forest-relevant sound energy lives
    // — get more resolution).
    const usableBins = Math.floor(mag.length * 0.5); // ignore top half (very high freq, mostly noise for this use)
    const binned = new Array<number>(targetBins).fill(0);
    for (let b = 0; b < targetBins; b++) {
      const startBin = Math.floor((b / targetBins) ** 1.5 * usableBins);
      const endBin = Math.max(startBin + 1, Math.floor(((b + 1) / targetBins) ** 1.5 * usableBins));
      let sum = 0;
      let count = 0;
      for (let i = startBin; i < Math.min(endBin, usableBins); i++) {
        sum += mag[i];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      const logVal = Math.log10(avg + 1e-6);
      binned[b] = logVal;
      if (logVal > maxLog) maxLog = logVal;
      if (logVal < minLog) minLog = logVal;
    }
    rawFrames.push(binned);
  }

  if (rawFrames.length === 0) {
    return [];
  }

  const range = Math.max(1e-6, maxLog - minLog);
  return rawFrames.map((frame) => frame.map((v) => Math.min(1, Math.max(0, (v - minLog) / range))));
};

export const calculateRMS = (data: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
};

export const calculatePeak = (data: Float32Array): number => {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > max) max = abs;
  }
  return max;
};

export const downsampleWaveform = (data: Float32Array, targetLength: number): number[] => {
  const result: number[] = [];
  const step = Math.ceil(data.length / targetLength);
  for (let i = 0; i < data.length; i += step) {
    let max = 0;
    const end = Math.min(i + step, data.length);
    for (let j = i; j < end; j++) {
      const val = Math.abs(data[j]);
      if (val > max) max = val;
    }
    result.push(max);
  }
  return result;
};

export const decodeAudioFile = async (file: File): Promise<AudioBuffer> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};
