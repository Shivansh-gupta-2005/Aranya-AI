# Browser Inference

The browser loads the committed YAMNet TensorFlow.js graph from `public/models/yamnet/`. It resamples mono PCM to 16 kHz and reads the model's 521 AudioSet scores.

## Baselines

A0 is the deployed compatibility path. It pools eight current classes and normalizes their scores. This preserves existing UI behavior.

A1 is the evaluation path. It pools five target classes independently and clips each score to 0..1. It does not use background or context scores as a denominator. A1 must pass threshold evaluation before it replaces A0.

## Live capture

Live microphone capture uses `AudioWorklet` through `src/platform/audio/rollingPcmCapture.ts`. A tested ring buffer keeps the newest two seconds. The worklet sends PCM chunks off the audio rendering thread.

## Event flow

Pure event rules live in `src/domain/events/eventBuilder.ts`. `src/app/commands/eventCommands.ts` supplies IDs and timestamps, then writes Zustand state. Persisted state migrates legacy class IDs at version 1.

## Model asset history

The browser model is a local TensorFlow.js conversion of published YAMNet weights. Keep conversion inputs outside Git unless their license and size policy are reviewed. Validate output shapes at runtime because converter output order is not a stable interface.
