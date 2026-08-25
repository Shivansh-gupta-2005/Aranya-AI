# Evaluation Protocol

## Comparisons

Evaluate every model on the same frozen dataset version and split:

1. A0: exact current browser mapping.
2. A1: independent YAMNet target pools without cross-class normalization.
3. B: one-vs-rest logistic regression on YAMNet embeddings.
4. C: a small multi-output MLP on the same embeddings.

## Threshold selection

Select one threshold per target on validation data. Optimize event-level F2 while keeping false positive events per background hour no worse than A1. Do not use test data to tune thresholds.

Before field use, a ranger or product owner must approve an absolute false-alert budget for each promoted class.

## Required results

Report per-class precision, recall, F2, PR-AUC, calibration error, event recall, event precision, detection delay, duplicate events, false positive events per background hour, P50 latency, P95 latency, and model size.

Include confidence intervals and slices for unseen sessions, sources, devices, distance, and weather when the dataset supports them.

## Release rule

A class may be promoted only when the frozen test evaluation preserves or improves A1 event recall without increasing false alerts. Publish the model bundle, model card, dataset version, split version, environment lock, known failures, and parity vectors together.
