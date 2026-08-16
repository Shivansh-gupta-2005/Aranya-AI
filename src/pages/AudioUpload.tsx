import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, Play, Pause, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useAudioStore } from '../stores/audioStore';
import { WaveformDisplay } from '../components/audio/WaveformDisplay';
import { SpectrogramDisplay } from '../components/audio/SpectrogramDisplay';
import { ClassificationDisplay } from '../components/audio/ClassificationDisplay';
import { classifyAudio } from '../services/audioClassifier';
import { processAudioBuffer, decodeAudioFile } from '../services/audioProcessor';
import { formatTimestamp } from '../types';

export const AudioUpload: React.FC = () => {
  const {
    isProcessing,
    setProcessing,
    currentAnalysis,
    setAnalysis,
    currentClassification,
    setClassification,
    error,
    setError
  } = useAudioStore();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setClassification(null);
    setAnalysisTimestamp(null);
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
    try {
      // Feed the model the real decoded PCM samples (mono, mixed down if needed).
      const channelData = buffer.numberOfChannels > 1
        ? mixDownToMono(buffer)
        : buffer.getChannelData(0);

      const result = await classifyAudio(channelData, buffer.sampleRate);
      setClassification(result);
      setAnalysisTimestamp(new Date());
    } catch (err) {
      console.error("Classification error", err);
      setError("Failed to run AI classification on the audio file.");
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Audio Analysis</h1>
        <p className="text-gray-400">Upload pre-recorded audio files for AI classification.</p>
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
                <audio controls src={audioUrl} className="w-full h-10 outline-none" />
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
            </div>
          </div>

          {(currentClassification || isProcessing) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ClassificationDisplay 
                result={currentClassification} 
                isProcessing={isProcessing} 
              />
              
              {currentClassification && analysisTimestamp && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    Analysis Report
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b border-[#1a2420] pb-2">
                      <span className="text-gray-500">Analyzed At</span>
                      <span className="text-gray-300">{formatTimestamp(analysisTimestamp)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2420] pb-2">
                      <span className="text-gray-500">Model Version</span>
                      <span className="text-gray-300">ARANYA-Audio-v1.4 (Proto)</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2420] pb-2">
                      <span className="text-gray-500">Processing Time</span>
                      <span className="text-gray-300">{currentClassification.processingTimeMs}ms</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2420] pb-2">
                      <span className="text-gray-500">Audio Duration</span>
                      <span className="text-gray-300">{currentAnalysis.duration.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a2420] pb-2">
                      <span className="text-gray-500">Data Source</span>
                      <span className="text-gray-300">Manual Upload</span>
                    </div>
                    
                    <div className="mt-6 bg-[#111916] p-4 rounded-lg border border-[#1a2420]">
                      <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-forest-500" />
                        Verification Recommended
                      </h4>
                      <p className="text-gray-400 text-xs">
                        This analysis is based on prototype acoustic models. All alerts should be verified against other sensor data (e.g., visual or seismic) before dispatching field teams.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
