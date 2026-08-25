import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Activity, AlertCircle, Zap } from 'lucide-react';
import { useAudioStore } from '../stores/audioStore';
import { WaveformDisplay } from '../components/audio/WaveformDisplay';
import { AudioLevelMeter } from '../components/audio/AudioLevelMeter';
import { SpectrogramDisplay } from '../components/audio/SpectrogramDisplay';
import { ClassificationDisplay } from '../components/audio/ClassificationDisplay';
import { TemporalDisplay } from '../components/audio/TemporalDisplay';
import { classifyAudio } from '../services/audioClassifier';
import { TemporalAggregatorService } from '../services/temporalAggregator';
import { createEventFromClassification, recordEvent } from '../services/eventPipeline';
import { SOUND_CLASS_LABELS } from '../types';

// How much recent audio (seconds) we keep in the rolling buffer that gets
// fed to the classifier. Short enough to feel responsive, long enough for
// the model to have something meaningful to analyze.
const ROLLING_WINDOW_SECONDS = 2;
// How often we automatically re-classify while listening.
const AUTO_CLASSIFY_INTERVAL_MS = 1600;

export const LiveListen: React.FC = () => {
  const {
    isListening,
    setListening,
    isProcessing,
    setProcessing,
    currentClassification,
    setClassification,
    temporalAggregation,
    setTemporalAggregation,
    liveAudioLevel,
    setLiveAudioLevel,
    error,
    setError
  } = useAudioStore();

  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [spectrogramData, setSpectrogramData] = useState<number[][]>([]);
  const [micPermission, setMicPermission] = useState<PermissionState | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentSinkRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestFrameRef = useRef<number>();
  const autoClassifyTimerRef = useRef<number | null>(null);

  // Mirrors `isListening` synchronously so the rAF loop (which is set up
  // once per start) always sees the current value instead of a stale
  // closure from the render that called startListening().
  const isListeningRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Circular buffer of raw PCM samples captured continuously from the mic.
  const ringBufferRef = useRef<Float32Array | null>(null);
  const ringWriteIndexRef = useRef(0);
  const ringFilledRef = useRef(false);

  const aggregatorRef = useRef(new TemporalAggregatorService(3, 0.6));
  // Tracks which confirmed streak (by aggregation id) we've already
  // recorded a real event for, so a long sustained streak doesn't create
  // a duplicate event on every 1.6s re-classification tick.
  const alertedAggregationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          setMicPermission(result.state);
          result.onchange = () => setMicPermission(result.state);
        })
        .catch(() => { /* permissions API not supported in this browser — non-fatal */ });
    }

    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assembleLinearBuffer = (): Float32Array | null => {
    const ring = ringBufferRef.current;
    if (!ring) return null;

    if (!ringFilledRef.current) {
      return ring.slice(0, ringWriteIndexRef.current);
    }
    const w = ringWriteIndexRef.current;
    const ordered = new Float32Array(ring.length);
    ordered.set(ring.subarray(w));
    ordered.set(ring.subarray(0, w), ring.length - w);
    return ordered;
  };

  const runClassification = useCallback(async () => {
    if (isProcessingRef.current) return;
    const audioCtx = audioContextRef.current;
    const buffer = assembleLinearBuffer();
    if (!audioCtx || !buffer || buffer.length < 512) return;

    isProcessingRef.current = true;
    setProcessing(true);
    try {
      const result = await classifyAudio(buffer, audioCtx.sampleRate);
      setClassification(result);
      const agg = aggregatorRef.current.addWindow(result.eventClass, result.confidence);
      setTemporalAggregation(agg);

      // Real classification result -> real event, through the exact same
      // pipeline Audio Upload and the simulated-sensor path use. Fires
      // once per confirmed streak, not on every re-classification tick.
      // Skipped if the classifier fell all the way through to its
      // last-resort random placeholder (result.isSimulated) — that path
      // exists only so the UI never crashes on an unusable buffer, and
      // must never be recorded as a real detection.
      if (!result.isSimulated && agg?.isThresholdReached && agg.id !== alertedAggregationIdRef.current) {
        alertedAggregationIdRef.current = agg.id;
        const event = createEventFromClassification({
          eventClass: agg.eventClass,
          confidence: agg.averageConfidence,
          source: { type: 'live-mic' },
          model: {
            provider: result.modelSource === 'heuristic' ? 'heuristic' : 'yamnet',
            name: result.modelSource === 'heuristic' ? 'ARANYA-DSP-Heuristic-v1 (rule-based, offline)' : 'YAMNet (AudioSet, TensorFlow.js, pretrained)',
          },
          temporalConfirmation: {
            windowsUsed: agg.windows.length,
            windowsRequired: agg.windowsRequired,
            threshold: agg.thresholdUsed,
            isConfirmed: true,
          },
          timingPrecision: 'approximate',
        });
        recordEvent(event);
      }
    } catch (err) {
      console.error('Classification error', err);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setClassification, setProcessing, setTemporalAggregation]);

  const startListening = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioContextCtor();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // Rolling capture buffer, fed continuously via a ScriptProcessorNode.
      // Routed through a zero-gain node so audio is captured for analysis
      // without being played back (no feedback/echo).
      ringBufferRef.current = new Float32Array(Math.round(audioCtx.sampleRate * ROLLING_WINDOW_SECONDS));
      ringWriteIndexRef.current = 0;
      ringFilledRef.current = false;

      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const ring = ringBufferRef.current;
        if (!ring) return;
        let idx = ringWriteIndexRef.current;
        for (let i = 0; i < input.length; i++) {
          ring[idx] = input[i];
          idx++;
          if (idx >= ring.length) {
            idx = 0;
            ringFilledRef.current = true;
          }
        }
        ringWriteIndexRef.current = idx;
      };
      source.connect(processor);
      const silentSink = audioCtx.createGain();
      silentSink.gain.value = 0;
      processor.connect(silentSink);
      silentSink.connect(audioCtx.destination);
      processorRef.current = processor;
      silentSinkRef.current = silentSink;

      isListeningRef.current = true;
      setListening(true);
      aggregatorRef.current.reset();
      alertedAggregationIdRef.current = null;
      setTemporalAggregation(null);
      setClassification(null);
      setSpectrogramData([]);

      processAudioFrame();

      autoClassifyTimerRef.current = window.setInterval(() => {
        if (isListeningRef.current) runClassification();
      }, AUTO_CLASSIFY_INTERVAL_MS);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings to use Live Listen.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('An error occurred while trying to access the microphone: ' + err.message);
      }
      stopListening();
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;

    if (autoClassifyTimerRef.current !== null) {
      window.clearInterval(autoClassifyTimerRef.current);
      autoClassifyTimerRef.current = null;
    }
    if (requestFrameRef.current) {
      cancelAnimationFrame(requestFrameRef.current);
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (silentSinkRef.current) {
      silentSinkRef.current.disconnect();
      silentSinkRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    ringBufferRef.current = null;

    setListening(false);
    setLiveAudioLevel(0);
    setWaveformData([]);
  };

  const processAudioFrame = () => {
    if (!analyserRef.current || !isListeningRef.current) return;

    const analyser = analyserRef.current;

    // Waveform data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    const step = Math.max(1, Math.floor(bufferLength / 200));
    const reducedWaveform = [];
    for (let i = 0; i < bufferLength; i += step) {
      reducedWaveform.push(dataArray[i]);
    }
    setWaveformData(reducedWaveform);

    // Audio level (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const normalizedLevel = Math.min(1, Math.max(0, rms * 5));
    setLiveAudioLevel(normalizedLevel);

    // Spectrogram data (real FFT-based frequency data from the AnalyserNode)
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);

    const numBins = 64;
    const binSize = Math.max(1, Math.floor(analyser.frequencyBinCount / numBins));
    const frame: number[] = [];
    for (let i = 0; i < numBins; i++) {
      let binSum = 0;
      for (let j = 0; j < binSize; j++) {
        binSum += freqData[i * binSize + j] ?? 0;
      }
      frame.push((binSum / binSize) / 255);
    }

    setSpectrogramData(prev => {
      const newData = [...prev, frame];
      const maxFrames = 50;
      if (newData.length > maxFrames) {
        return newData.slice(newData.length - maxFrames);
      }
      return newData;
    });

    if (isListeningRef.current) {
      requestFrameRef.current = requestAnimationFrame(processAudioFrame);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Live Edge Listening</h1>
          <p className="text-gray-400">Stream audio from your microphone for continuous AI classification.</p>
        </div>

        <button
          onClick={toggleListening}
          className={`btn-primary px-8 py-3 rounded-full flex items-center gap-2 font-semibold text-lg transition-all ${
            isListening 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border-red-500' 
              : 'bg-forest-600 hover:bg-forest-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] border-forest-500'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" /> Stop Listening
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" /> Listen Now
            </>
          )}
        </button>
      </div>

      {isListening && (
        <div className="glass-card px-4 py-3 flex items-center gap-3 border border-forest-800/50">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-forest-500" />
          </span>
          <span className="text-forest-300 font-mono text-sm">🎙 Listening...</span>
          {currentClassification && (
            <span className="text-gray-300 text-sm">
              {SOUND_CLASS_LABELS[currentClassification.eventClass]} — {(currentClassification.confidence * 100).toFixed(0)}%
            </span>
          )}
          {isProcessing && <Zap className="w-4 h-4 text-amber-400 animate-pulse ml-auto" />}
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-400 font-semibold mb-1">Microphone Error</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {micPermission === 'denied' && !error && (
        <div className="bg-amber-950/50 border border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-semibold mb-1">Microphone Access Blocked</h3>
            <p className="text-amber-300 text-sm">Please update your browser settings to allow microphone access on this page.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-forest-500" /> Live Waveform
              </h2>
              {isListening && (
                <div className="flex items-center gap-2 text-xs font-mono text-forest-400">
                  <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
                  STREAMING
                </div>
              )}
            </div>

            <div className="flex gap-4 h-[120px]">
              <div className="flex-1">
                <WaveformDisplay 
                  data={waveformData} 
                  height={120} 
                  isLive={isListening} 
                  color={isListening ? '#22c55e' : '#6b7280'}
                />
              </div>
              <AudioLevelMeter level={liveAudioLevel} />
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 font-mono">
              <span>0ms</span>
              <span>Rolling {ROLLING_WINDOW_SECONDS}s Analysis Window</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Live Spectrogram</h2>
            <SpectrogramDisplay data={spectrogramData} height={160} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <button
              onClick={runClassification}
              disabled={!isListening || isProcessing}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                !isListening
                  ? 'bg-[#111916] text-gray-600 cursor-not-allowed border border-[#1a2420]'
                  : isProcessing
                  ? 'bg-forest-900/50 text-forest-300 border border-forest-700/50 cursor-wait'
                  : 'bg-forest-600 hover:bg-forest-500 text-white border border-forest-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
              }`}
            >
              {isProcessing ? 'Analyzing Window...' : 'Analyze Now'}
            </button>
            <p className="text-xs text-center text-gray-500 mt-3">
              {isListening
                ? `Auto-updating every ${(AUTO_CLASSIFY_INTERVAL_MS / 1000).toFixed(1)}s — tap to analyze immediately.`
                : 'Start listening to enable live classification.'}
            </p>
          </div>

          <ClassificationDisplay 
            result={currentClassification} 
            isProcessing={isProcessing} 
          />

          <TemporalDisplay aggregation={temporalAggregation} />
        </div>
      </div>
    </div>
  );
};
