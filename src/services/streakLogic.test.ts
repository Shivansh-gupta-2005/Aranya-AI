import { describe, expect, it } from 'vitest';
import { initStreak, stepStreak } from './streakLogic';

describe('stepStreak', () => {
  it('confirms only after the required consecutive windows', () => {
    const first = stepStreak(initStreak<string>(), 'chainsaw', 0.7, 0.6, 2);
    const second = stepStreak(first.state, 'chainsaw', 0.8, 0.6, 2);

    expect(first.isConfirmed).toBe(false);
    expect(second.isConfirmed).toBe(true);
    expect(second.state.confidences).toEqual([0.7, 0.8]);
  });

  it('resets the streak below the threshold', () => {
    const first = stepStreak(initStreak<string>(), 'chainsaw', 0.7, 0.6, 2);
    const second = stepStreak(first.state, 'chainsaw', 0.4, 0.6, 2);

    expect(second.state).toEqual(initStreak<string>());
    expect(second.isConfirmed).toBe(false);
  });
});
