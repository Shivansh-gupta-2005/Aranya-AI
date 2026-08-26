export class PcmRingBuffer {
  private readonly samples: Float32Array;
  private writeIndex = 0;
  private filled = false;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('PCM ring buffer capacity must be a positive integer.');
    }
    this.samples = new Float32Array(capacity);
  }

  append(chunk: Float32Array): void {
    for (const sample of chunk) {
      this.samples[this.writeIndex] = sample;
      this.writeIndex += 1;
      if (this.writeIndex === this.samples.length) {
        this.writeIndex = 0;
        this.filled = true;
      }
    }
  }

  snapshot(): Float32Array {
    if (!this.filled) {
      return this.samples.slice(0, this.writeIndex);
    }
    const ordered = new Float32Array(this.samples.length);
    ordered.set(this.samples.subarray(this.writeIndex));
    ordered.set(this.samples.subarray(0, this.writeIndex), this.samples.length - this.writeIndex);
    return ordered;
  }
}
