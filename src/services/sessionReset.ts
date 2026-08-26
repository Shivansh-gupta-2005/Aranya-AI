import { useEventStore } from '../stores/eventStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useSensorStore } from '../stores/sensorStore';
import { useAudioStore } from '../stores/audioStore';

// ============================================================
// "Reset Demo": the single place that clears all SESSION state so the
// prototype can be re-run cleanly between demonstrations. Deliberately
// does NOT touch anything that isn't session data: the converted YAMNet
// model files, app configuration, and code are untouched: this only
// clears the persisted Zustand stores (events, feedback) and resets the
// simulated sensor telemetry + transient audio-analysis UI state back to
// their initial values.
// ============================================================

export function resetDemoSession(): void {
  useEventStore.getState().clearAll();
  useFeedbackStore.getState().clearAll();
  useSensorStore.getState().resetTelemetry();
  useAudioStore.getState().reset();
}
