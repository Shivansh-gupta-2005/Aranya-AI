import { PcmRingBuffer } from './pcmRingBuffer';

export interface RollingPcmCapture {
  snapshot(): Float32Array;
  stop(): void;
}

export async function createRollingPcmCapture(
  audioContext: AudioContext,
  source: MediaStreamAudioSourceNode,
  windowSeconds: number
): Promise<RollingPcmCapture> {
  const capacity = Math.max(1, Math.round(audioContext.sampleRate * windowSeconds));
  const ring = new PcmRingBuffer(capacity);
  const moduleUrl = new URL('./pcmCapture.worklet.js', import.meta.url);
  await audioContext.audioWorklet.addModule(moduleUrl);

  const captureNode = new AudioWorkletNode(audioContext, 'aranya-pcm-capture');
  const silentSink = audioContext.createGain();
  silentSink.gain.value = 0;
  captureNode.port.onmessage = (event: MessageEvent<Float32Array>) => ring.append(event.data);
  source.connect(captureNode);
  captureNode.connect(silentSink);
  silentSink.connect(audioContext.destination);

  return {
    snapshot: () => ring.snapshot(),
    stop: () => {
      captureNode.port.onmessage = null;
      source.disconnect(captureNode);
      captureNode.disconnect();
      silentSink.disconnect();
    },
  };
}
