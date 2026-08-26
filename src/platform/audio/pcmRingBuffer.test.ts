import { describe, expect, it } from 'vitest';
import { PcmRingBuffer } from './pcmRingBuffer';

describe('PcmRingBuffer', () => {
  it('returns samples in capture order before it fills', () => {
    const buffer = new PcmRingBuffer(5);

    buffer.append(Float32Array.from([1, 2, 3]));

    expect(Array.from(buffer.snapshot())).toEqual([1, 2, 3]);
  });

  it('keeps the newest samples after wrapping', () => {
    const buffer = new PcmRingBuffer(5);

    buffer.append(Float32Array.from([1, 2, 3]));
    buffer.append(Float32Array.from([4, 5, 6, 7]));

    expect(Array.from(buffer.snapshot())).toEqual([3, 4, 5, 6, 7]);
  });
});
