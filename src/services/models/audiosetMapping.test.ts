import { describe, expect, it } from 'vitest';
import {
  AUDIOSET_NUM_CLASSES,
  poolCurrentNormalizedScores,
  poolIndependentTargetScores,
} from './audiosetMapping';

function scores(values: Record<number, number>): number[] {
  const result = new Array<number>(AUDIOSET_NUM_CLASSES).fill(0);
  for (const [index, value] of Object.entries(values)) {
    result[Number(index)] = value;
  }
  return result;
}

describe('AudioSet baselines', () => {
  it('keeps A0 normalized across current classes', () => {
    const pooled = poolCurrentNormalizedScores(scores({ 421: 0.4, 341: 0.2, 277: 0.4 }));

    expect(Object.values(pooled).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(pooled.gunfire).toBeCloseTo(0.4);
  });

  it('keeps A1 target scores independent from background', () => {
    const withoutBackground = poolIndependentTargetScores(scores({ 421: 0.4 }));
    const withBackground = poolIndependentTargetScores(scores({ 421: 0.4, 277: 0.9 }));

    expect(withBackground.gunfire).toBeCloseTo(withoutBackground.gunfire);
    expect(Object.keys(withBackground)).toEqual([
      'gunfire',
      'chainsaw',
      'metal_tool_activity',
      'fire',
      'vehicle',
    ]);
  });
});
