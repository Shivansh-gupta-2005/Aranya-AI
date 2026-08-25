import { SoundEventClass, TemporalAggregation, TemporalWindow, generateId } from '../types';
import { StreakState, initStreak, stepStreak } from './streakLogic';

// ============================================================
// Live/streaming counterpart to timelineSegmenter's batch analysis.
// Wraps the shared streakLogic primitive with wall-clock Date
// timestamps and instance state for LiveListen's rolling-buffer loop.
//
// Previously this class's addWindow() could leave currentAggregation
// null after a broken streak while still claiming (via an `as
// TemporalAggregation` cast) to return a real TemporalAggregation.
// It now returns null honestly — callers already handle a nullable
// TemporalAggregation (see stores/audioStore.ts).
// ============================================================

export class TemporalAggregatorService {
  private windowsRequired: number;
  private threshold: number;
  private streak: StreakState<SoundEventClass> = initStreak<SoundEventClass>();
  private windows: TemporalWindow[] = [];
  private aggregationId: string | null = null;

  constructor(windowsRequired: number = 3, threshold: number = 0.7) {
    this.windowsRequired = windowsRequired;
    this.threshold = threshold;
  }

  addWindow(eventClass: SoundEventClass, confidence: number): TemporalAggregation | null {
    const result = stepStreak(this.streak, eventClass, confidence, this.threshold, this.windowsRequired);
    this.streak = result.state;

    if (result.state.eventClass === null) {
      this.windows = [];
      this.aggregationId = null;
      return null;
    }

    if (result.extended) {
      this.windows.push({
        windowIndex: this.windows.length,
        eventClass: result.state.eventClass,
        confidence,
        timestamp: new Date(),
      });
    } else {
      this.windows = [
        {
          windowIndex: 0,
          eventClass: result.state.eventClass,
          confidence,
          timestamp: new Date(),
        },
      ];
      this.aggregationId = generateId();
    }

    return {
      id: this.aggregationId ?? (this.aggregationId = generateId()),
      eventClass: result.state.eventClass,
      windows: this.windows,
      averageConfidence: result.averageConfidence,
      isThresholdReached: result.isConfirmed,
      thresholdUsed: this.threshold,
      windowsRequired: this.windowsRequired,
    };
  }

  reset(): void {
    this.streak = initStreak<SoundEventClass>();
    this.windows = [];
    this.aggregationId = null;
  }

  getAggregation(): TemporalAggregation | null {
    if (this.streak.eventClass === null || this.windows.length === 0) return null;
    return {
      id: this.aggregationId ?? generateId(),
      eventClass: this.streak.eventClass,
      windows: this.windows,
      averageConfidence:
        this.streak.confidences.reduce((a, b) => a + b, 0) / this.streak.confidences.length,
      isThresholdReached: this.windows.length >= this.windowsRequired,
      thresholdUsed: this.threshold,
      windowsRequired: this.windowsRequired,
    };
  }
}

// Export singleton instance for app-wide use if needed
export const temporalAggregator = new TemporalAggregatorService();
