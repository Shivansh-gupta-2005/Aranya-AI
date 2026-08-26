import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyAudio } from './audioClassifier';
import { heuristicPlugin } from './models/heuristicPlugin';
import { yamnetPlugin } from './models/yamnetPlugin';

describe('classifyAudio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when every real backend fails instead of fabricating a result', async () => {
    vi.spyOn(yamnetPlugin, 'predict').mockRejectedValue(new Error('yamnet failed'));
    vi.spyOn(heuristicPlugin, 'predict').mockRejectedValue(new Error('heuristic failed'));

    await expect(classifyAudio(new Float32Array([0]), 16_000)).rejects.toThrow('heuristic failed');
  });
});
