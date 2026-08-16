import { create } from 'zustand';
import { AudioAnalysis, ClassificationResult, TemporalAggregation } from '../types';

interface AudioStoreState {
  isListening: boolean;
  isProcessing: boolean;
  currentAnalysis: AudioAnalysis | null;
  currentClassification: ClassificationResult | null;
  temporalAggregation: TemporalAggregation | null;
  liveAudioLevel: number;
  error: string | null;
  setListening: (v: boolean) => void;
  setProcessing: (v: boolean) => void;
  setAnalysis: (a: AudioAnalysis | null) => void;
  setClassification: (c: ClassificationResult | null) => void;
  setTemporalAggregation: (t: TemporalAggregation | null) => void;
  setLiveAudioLevel: (l: number) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  isListening: false,
  isProcessing: false,
  currentAnalysis: null,
  currentClassification: null,
  temporalAggregation: null,
  liveAudioLevel: 0,
  error: null,
  setListening: (v: boolean) => set({ isListening: v }),
  setProcessing: (v: boolean) => set({ isProcessing: v }),
  setAnalysis: (a: AudioAnalysis | null) => set({ currentAnalysis: a }),
  setClassification: (c: ClassificationResult | null) => set({ currentClassification: c }),
  setTemporalAggregation: (t: TemporalAggregation | null) => set({ temporalAggregation: t }),
  setLiveAudioLevel: (l: number) => set({ liveAudioLevel: l }),
  setError: (e: string | null) => set({ error: e }),
  reset: () => set({
    isListening: false,
    isProcessing: false,
    currentAnalysis: null,
    currentClassification: null,
    temporalAggregation: null,
    liveAudioLevel: 0,
    error: null
  })
}));
