import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileAudio, AlertCircle, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAudioStore } from '../stores/audioStore';
import { WaveformDisplay } from '../components/audio/WaveformDisplay';
import { SpectrogramDisplay } from '../components/audio/SpectrogramDisplay';
import { DetectedEventsTimeline } from '../components/audio/DetectedEventsTimeline';
import { classifySequence } from '../services/audioClassifier';
import { segmentTimeline, SegmentedEvent } from '../services/timelineSegmenter';
import { createEventFromClassification, recordEvent } from '../services/eventPipeline';
import { processAudioBuffer, decodeAudioFile } from '../services/audioProcessor';
import { formatTimestamp, SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, SoundEventClass } from '../types';
import { AranyaEvent } from '../types/event';
import { FrameScore } from '../services/models/types';

/** Real mean of a class's pooled score across frames overlapping [startTime, endTime]. */
function meanScoreInRange(frames: FrameScore[], cls: SoundEventClass, startTime: number, endTime: number): number {
  const inRange = frames.filter((f) => f.endTime > startTime && f.startTime < endTime);
  if (inRange.length === 0) return 0;
  return inRange.reduce((sum, f) => sum + (f.scores[cls] ?? 0), 0) / inRange.length;
}

/** Real slice of the already-computed downsampled waveform/spectrogram for one event's time range. */
function sliceEvidence(
  waveform: number[],
  spectrogram: number[][],
  duration: number,
  startTime: number,
  endTime: number
) {
  if (!duration) return { waveform: undefined, spectrogram: undefined };
  const wStart = Math.max(0, Math.floor((startTime / duration) * waveform.length));
  const wEnd = Math.min(waveform.length, Math.ceil((endTime / duration) * waveform.length));
  const sStart = Math.max(0, Math.floor((startTime / duration) * spectrogram.length));
  const sEnd = Math.min(spectrogram.length, Math.ceil((endTime / duration) * spectrogram.length));
  return {
    waveform: waveform.slice(wStart, Math.max(wStart + 1, wEnd)),
    spectrogram: spectrogram.slice(sStart, Math.max(sStart + 1, sEnd)),
  };
}

export const AudioUpload: React.FC = () => {
  const navigate = useNavigate();
  const {
    isProcessing,
    setProcessing,
    currentAnalysis,
    setAnalysis,
    error,
    setError
  } = useAudioStore();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<Date | null>(null);
  const [detectedEvents, setDetectedEvents] = useState<AranyaEvent[] | null>(null);
  const [modelDiagnostics, setModelDiagnostics] = useState<{
    modelSource: string;
    modelName: string;
    numFrames: number;
  } | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioElRef = useRef<HTMLAudioElement>(null);

  // Local audio buffer for playback
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // Decoded PCM data kept around so "Analyze" can run on the real samples
  const decodedBufferRef = useRef<AudioBuffer | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File) => {
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
      setError('Invalid file format. Please upload .wav, .mp3, .ogg, or .flac files.');
      return false;
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum size is 50MB.');
      return false;
    }

    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setAnalysisTimestamp(null);
    setDetectedEvents(null);
    setModelDiagnostics(null);
    setPlaybackTime(0);
    setIsDecoding(true);
    setError(null);

    try {
      const buffer = await decodeAudioFile(file);
      decodedBufferRef.current = buffer;
      const analysis = processAudioBuffer(buffer);
      setAnalysis(analysis);
    } catch (err: any) {
      console.error('Error decoding audio:', err);
      setError('Failed to decode audio file. It might be corrupted or in an unsupported format.');
      setAnalysis(null);
      decodedBufferRef.current = null;
    } finally {
      setIsDecoding(false);
    }
  };

  const handleAnalyze = async () => {
    const buffer = decodedBufferRef.current;
    if (!currentAnalysis || !buffer) return;

    setProcessing(true);
    setError(null);
    setDetectedEvents(null);
    setModelDiagnostics(null);
    try {
      // Feed the model the real decoded PCM samples (mono, mixed down if needed).
      const channelData = buffer.numberOfChannels > 1
        ? mixDownToMono(buffer)
        : buffer.getChannelData(0);

      // Real sliding-window analysis over the FULL clip — not a single
      // whole-clip classification. classifySequence tries YAMNet first and
      // falls back to the offline heuristic only if YAMNet genuinely fails;
      // whichever ran is reported, never silently relabeled.
      const seq = await classifySequence(channelData, buffer.sampleRate);
      const segments: SegmentedEvent[] = segmentTimeline(seq.frames, seq.modelSource);

      setModelDiagnostics({
        modelSource: seq.modelSource,
        modelName: seq.modelName,
        numFrames: seq.frames.length,
      });

      const events = segments.map((seg) => {
        // Real secondary-class signal from the same window, used only to
        // justify an application-level interpretation note (see
        // eventPipeline.computeInterpretationNote) — never fabricated.
        const relatedScores =
          seg.eventClass === 'vehicle'
            ? { chainsaw: meanScoreInRange(seq.frames, 'chainsaw', seg.startTime, seg.endTime) }
            : undefined;

        const evidence = sliceEvidence(
          currentAnalysis.waveform,
          currentAnalysis.spectrogram,
          currentAnalysis.duration,
          seg.startTime,
          seg.endTime
        );

        const event = createEventFromClassification({
          eventClass: seg.eventClass,
          confidence: seg.confidence,
          startTime: seg.startTime,
          endTime: seg.endTime,
          source: { type: 'upload', fileName: file?.name },
          model: { provider: seq.modelSource, name: seq.modelName },
          temporalConfirmation: {
            windowsUsed: seg.windowsUsed,
            windowsRequired: seg.windowsRequired,
            threshold: seg.threshold,
            isConfirmed: true,
          },
          timingPrecision: seg.timingPrecision,
          relatedScores,
          evidence: {
            waveform: evidence.waveform,
            spectrogram: evidence.spectrogram,
            sourceFileName: file?.name,
          },
        });
        recordEvent(event);
        return event;
      });

      setDetectedEvents(events);
      setAnalysisTimestamp(new Date());
    } catch (err) {
      console.error('Classification error', err);
      setError('Failed to run AI classification on the audio file. ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(false);
    }
  };

  const mixDownToMono = (buffer: AudioBuffer): Float32Array => {
    const length = buffer.length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += data[i] / buffer.numberOfChannels;
      }
    }
    return mono;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekTo = (seconds: number) => {
    if (audioElRef.current) {
      audioElRef.current.currentTime = seconds;
      setPlaybackTime(seconds);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Audio Analysis</h1>
        <p className="text-gray-400">Upload a real audio recording — the AI genuinely analyzes it in sliding windows across the full clip.</p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm mt-0.5">{error}</p>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isDecoding && !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-forest-500 bg-forest-900/20'
            : 'border-[#1a2420] bg-[#0a0f0d] hover:bg-[#111916] hover:border-gray-700'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          className="hidden"
          accept=".wav,.mp3,.ogg,.flac,.m4a"
        />

        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-forest-900/50 text-forest-400' : 'bg-[#111916] text-gray-500'}`}>
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          {isDragging ? 'Drop audio file here' : 'Click or drag audio file to upload'}
        </h3>
        <p className="text-sm text-gray-500 max-w-md">
          Supports WAV, MP3, FLAC, and OGG formats up to 50MB.
        </p>
      </div>

      {isDecoding && (
        <div className="glass-card p-8 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-forest-900 border-t-forest-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-300 font-medium">Decoding Audio File...</p>
        </div>
      )}

      {file && currentAnalysis && !isDecoding && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-400">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{file.name}</h3>
                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{formatDuration(currentAnalysis.duration)}</span>
                    <span>{currentAnalysis.sampleRate} Hz</span>
                    <span>mono (mixed down for analysis)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className={`btn-primary px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  isProcessing
                    ? 'opacity-70 cursor-wait'
                    : ''
                }`}
              >
                {isProcessing ? 'Analyzing...' : 'Analyze Audio'}
              </button>
            </div>

            {audioUrl && (
              <div className="mb-6 bg-[#111916] p-3 rounded-lg border border-[#1a2420]">
                <audio
                  ref={audioElRef}
                  controls
                  src={audioUrl}
                  className="w-full h-10 outline-none"
                  onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Waveform Overview</h4>
                <WaveformDisplay
                  data={currentAnalysis.waveform}
                  height={100}
                  color="#22c55e"
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Spectrogram Profile</h4>
                <SpectrogramDisplay
                  data={currentAnalysis.spectrogram}
                  height={150}
                />
              </div>

              {detectedEvents !== null && detectedEvents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Event Timeline (click to seek)</h4>
                  <DetectedEventsTimeline
                    events={detectedEvents}
                    duration={currentAnalysis.duration}
                    currentTime={playbackTime}
                    onSeek={seekTo}
                  />
                </div>
              )}
            </div>
          </div>

          {(isProcessing || detectedEvents !== null) && (
            <div className="glass-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  Detected Events
                </h3>
                {modelDiagnostics && (
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      modelDiagnostics.modelSource === 'yamnet'
                        ? 'bg-blue-900/40 text-blue-300 border-blue-700/40'
                        : 'bg-amber-900/40 text-amber-300 border-amber-700/40'
                    }`}
                  >
                    {modelDiagnostics.modelSource === 'yamnet'
                      ? 'Pretrained Model (YAMNet / AudioSet)'
                      : 'YAMNet unavailable — offline heuristic fallback used'}
                  </span>
                )}
              </div>

              {isProcessing && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <div className="w-8 h-8 border-4 border-forest-900 border-t-forest-500 rounded-full animate-spin mb-3" />
                  Running sliding-window analysis over the full clip…
                </div>
              )}

              {!isProcessing && detectedEvents && (
                <>
                  {modelDiagnostics && (
                    <p className="text-xs text-gray-500 mb-4">
                      Model: {modelDiagnostics.modelName} · {modelDiagnostics.numFrames} frame(s) analyzed
                      {analysisTimestamp ? ` · analyzed at ${formatTimestamp(analysisTimestamp)}` : ''}
                    </p>
                  )}

                  {detectedEvents.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      No events crossed the confirmation threshold for this clip. This is the model's actual
                      result for this audio — not every clip contains a confidently-classifiable event.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#1a2420] text-gray-500">
                            <th className="pb-2 pr-4 font-medium">Class</th>
                            <th className="pb-2 pr-4 font-medium">Start</th>
                            <th className="pb-2 pr-4 font-medium">End</th>
                            <th className="pb-2 pr-4 font-medium">Confidence</th>
                            <th className="pb-2 pr-4 font-medium">Severity</th>
                            <th className="pb-2 pr-4 font-medium">Alert?</th>
                            <th className="pb-2 pr-4 font-medium">Timing</th>
                            <th className="pb-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detectedEvents.map((ev) => (
                            <React.Fragment key={ev.id}>
                              <tr
                                className="border-b border-[#1a2420]/50 hover:bg-[#111916] cursor-pointer"
                                onClick={() => ev.startTime !== undefined && seekTo(ev.startTime)}
                              >
                                <td className="py-2 pr-4 font-medium" style={{ color: SOUND_CLASS_COLORS[ev.eventClass] }}>
                                  {SOUND_CLASS_LABELS[ev.eventClass]}
                                </td>
                                <td className="py-2 pr-4 text-gray-300 font-mono">{ev.startTime?.toFixed(2)}s</td>
                                <td className="py-2 pr-4 text-gray-300 font-mono">{ev.endTime?.toFixed(2)}s</td>
                                <td className="py-2 pr-4 text-gray-300">{(ev.confidence * 100).toFixed(1)}%</td>
                                <td className="py-2 pr-4 text-gray-300 uppercase text-xs">{ev.severity}</td>
                                <td className="py-2 pr-4 text-xs">
                                  {ev.alertEligible ? (
                                    <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40">ALERT</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-400 border border-gray-600/40">Info</span>
                                  )}
                                </td>
                                <td className="py-2 pr-4 text-gray-500 text-xs">{ev.timingPrecision}</td>
                                <td className="py-2 text-right">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${ev.id}`); }}
                                    className="text-forest-500 hover:text-forest-400 text-xs flex items-center gap-1"
                                  >
                                    Details <ChevronRight className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                              {ev.interpretationNote && (
                                <tr className="border-b border-[#1a2420]/50">
                                  <td colSpan={8} className="py-2 text-xs text-amber-400/90 bg-amber-950/10">
                                    ⓘ {ev.interpretationNote}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 bg-[#111916] p-4 rounded-lg border border-[#1a2420]">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-forest-500" />
                      Verification Recommended
                    </h4>
                    <p className="text-gray-400 text-xs">
                      This analysis is based on a general-purpose pretrained acoustic model (or, if that model
                      couldn't load, an offline signal-processing heuristic — see the badge above), not a
                      trained Aranya-specific classifier. All detections should be verified against other
                      sensor data before dispatching field teams.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
