# ARANYA ML results history

This file records completed ML runs whose artifacts exist in `ml/work/runs/`. Add a row after each completed run. Keep failed or rejected runs because they explain later choices.

Generated run files stay ignored. Each row names its source run directory so the metrics can be checked locally.

## How to read the results

PC pilot models use five independent alert outputs. The edge models use six mutually exclusive classes, including background. Their macro F1 values are not directly comparable.

Most compact recovery tests contain 1,402 gunfire samples but only eight positive samples for each other alert class. Scores above `0.8` are exploratory. They are not field accuracy or release evidence.

## Current run table

| Run | Model and features | Test macro F1 | Test rows | INT8 bytes | Decision |
| --- | --- | ---: | ---: | ---: | --- |
| `fast-yamnet-mlp-v1` | YAMNet embeddings, MLP | 0.800381 | 1,340 | n/a | Superseded by tropical manifest |
| `fast-yamnet-mlp-f1-v1` | YAMNet embeddings, MLP, F1 thresholds | 0.860616 | 1,340 | n/a | Superseded by tropical manifest |
| `fast-yamnet-mlp-tropical-f1-v1` | YAMNet embeddings, MLP | 0.874643 | 1,640 | n/a | Primary PC benchmark |
| `fast-yamnet-mlp-tropical-f1-seed-7` | Same model, seed 7 | 0.882236 | 1,640 | n/a | Best score, seed sensitivity check |
| `fast-yamnet-mlp-tropical-f1-seed-42` | Same model, seed 42 | 0.818656 | 1,640 | n/a | Kept, shows seed sensitivity |
| `fast-yamnet-mlp-tropical-f1-seed-20260827` | Same model, alternate seed | 0.878110 | 1,640 | n/a | Kept, seed sensitivity check |
| `fast-logmel-mlp-tropical-f1-v1` | Pooled log-mel, MLP | 0.533170 | 1,640 | n/a | Rejected for edge use |
| `aranya-edge-logmel-candidate-v1` | Dense log-mel model, INT8 | 0.406073 | 1,640 | 179,544 | Rejected, too large and weak |
| `aranya-edge-dscnn-fast-v1` | DS-CNN, INT8 | 0.478953 | 1,640 | 12,600 | Superseded |
| `aranya-edge-dscnn-fast-v2` | DS-CNN with changed thresholds, INT8 | 0.441726 | 1,640 | 12,600 | Rejected, thresholds hurt test F1 |
| `aranya-edge-dscnn-nofc-v1` | DS-CNN without dense head, INT8 | 0.525767 | 1,640 | 12,680 | Current ESP32 candidate |
| `aranya-edge-dscnn-nofc-wide-v1` | Wider DS-CNN, INT8 | 0.404101 | 1,640 | 22,592 | Rejected, width hurt test F1 |

## Current ESP32 candidate

Run: `ml/work/runs/aranya-edge-dscnn-nofc-v1`

| Class | INT8 test F1 | Test support |
| --- | ---: | ---: |
| gunfire | 0.947549 | 1,402 |
| chainsaw | 0.300000 | 8 |
| metal tool activity | 0.875000 | 8 |
| fire | 0.200000 | 8 |
| vehicle | 0.400000 | 8 |
| background | 0.432056 | 206 |
| Macro | 0.525767 | 1,640 total |

FP32 test macro F1 was `0.473689`. INT8 changed the decision boundaries and raised measured macro F1 to `0.525767`. This improvement can be test noise because several classes have only eight examples.

The model is 12,680 bytes. Its SHA-256 is `b1c186ab83255358c5cdcb9567c4fc9003bc5683c9357311c68f7239753b913d`. Measured ESP32-S3 inference time was 46 to 47 ms per 0.96 second window.

## Primary PC benchmark

Run: `ml/work/runs/fast-yamnet-mlp-tropical-f1-v1`

| Class | Test F1 | Test support |
| --- | ---: | ---: |
| gunfire | 0.985612 | 1,402 |
| chainsaw | 0.857143 | 8 |
| metal tool activity | 0.875000 | 8 |
| fire | 0.714286 | 8 |
| vehicle | 0.941176 | 8 |
| Macro | 0.874643 | 1,640 total |

Validation selected the F1 thresholds. The result shows that pretrained embeddings separate the compact sources well. It does not prove field performance because four target classes have tiny test support.

## Earlier recorded baselines

These older results are recorded in the [project history](../ARANYA_PROJECT_HISTORY.md). Their run directories are not present in the current `ml/work/runs/` tree.

| Run | Test macro F1 | Note |
| --- | ---: | --- |
| `pc-logmel-v1b` | 0.264051 | Unbalanced logistic baseline |
| `pc-logmel-balanced-v1` | 0.291876 | Balanced logistic baseline |
| `pc-logmel-mlp-balanced-v1` | 0.319327 | Balanced log-mel MLP |
| `pc-logmel-mlp-fsd-domain-v1` | 0.377902 | Earlier best domain-focused pilot |

## Next result entry

The next run should use the verified FSD50K audio and processed forest chainsaw source. Record these fields:

```text
run name
manifest fingerprint
source counts
group counts per split and class
feature settings
model settings
random seed
FP32 validation and test metrics
INT8 validation and test metrics
per-class support and F1
confusion matrix path
model size and SHA-256
ESP32 latency
decision and reason
```
