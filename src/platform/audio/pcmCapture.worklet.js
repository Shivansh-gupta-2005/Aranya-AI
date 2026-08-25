class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      const chunk = new Float32Array(input);
      this.port.postMessage(chunk, [chunk.buffer]);
      outputs[0]?.[0]?.set(input);
    }
    return true;
  }
}

registerProcessor('aranya-pcm-capture', PcmCaptureProcessor);
