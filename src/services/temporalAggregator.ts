import { SoundEventClass, TemporalAggregation, TemporalWindow, generateId } from '../types';

export class TemporalAggregatorService {
  private windowsRequired: number;
  private threshold: number;
  private currentAggregation: TemporalAggregation | null = null;
  
  constructor(windowsRequired: number = 3, threshold: number = 0.7) {
    this.windowsRequired = windowsRequired;
    this.threshold = threshold;
  }

  addWindow(eventClass: SoundEventClass, confidence: number): TemporalAggregation {
    if (
      this.currentAggregation &&
      this.currentAggregation.eventClass === eventClass
    ) {
      // Continue tracking current event
      const windowIndex = this.currentAggregation.windows.length;
      
      if (confidence >= this.threshold) {
        this.currentAggregation.windows.push({
          windowIndex,
          eventClass,
          confidence,
          timestamp: new Date()
        });

        // Recalculate average
        const sum = this.currentAggregation.windows.reduce((acc, w) => acc + w.confidence, 0);
        this.currentAggregation.averageConfidence = sum / this.currentAggregation.windows.length;

        if (this.currentAggregation.windows.length >= this.windowsRequired) {
          this.currentAggregation.isThresholdReached = true;
        }
      } else {
        // Drop below threshold breaks the streak, reset
        this.reset();
        this.startNewAggregation(eventClass, confidence);
      }
    } else {
      // Different class or no current tracking, reset and start new
      this.reset();
      this.startNewAggregation(eventClass, confidence);
    }

    return this.getAggregation() as TemporalAggregation;
  }

  private startNewAggregation(eventClass: SoundEventClass, confidence: number) {
    if (confidence >= this.threshold) {
      this.currentAggregation = {
        id: generateId(),
        eventClass,
        windows: [{
          windowIndex: 0,
          eventClass,
          confidence,
          timestamp: new Date()
        }],
        averageConfidence: confidence,
        isThresholdReached: this.windowsRequired === 1,
        thresholdUsed: this.threshold,
        windowsRequired: this.windowsRequired
      };
    }
  }

  reset(): void {
    this.currentAggregation = null;
  }

  getAggregation(): TemporalAggregation | null {
    return this.currentAggregation;
  }
}

// Export singleton instance for app-wide use if needed
export const temporalAggregator = new TemporalAggregatorService();
