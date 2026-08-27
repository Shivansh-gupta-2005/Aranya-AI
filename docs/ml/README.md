# ARANYA ML system

This document explains the current ML system, its data, training paths, edge model, results, and remaining work. Use [results history](results-history.md) for the full experiment table.

## Current state

ARANYA has two model paths:

1. The browser uses pretrained YAMNet through TensorFlow.js. It is a baseline and demo aid.
2. The ESP32-S3 uses a custom INT8 depthwise-separable CNN. It performs inference on the node.

The current ESP32 candidate is `aranya-edge-dscnn-nofc-v1`. Its INT8 model is 12,680 bytes. It reached test macro F1 `0.525767` on the compact recovery manifest. The firmware ran this model on the connected ESP32-S3 in 46 to 47 ms per audio window.

This score is not field accuracy. The test set has only eight positive clips for chainsaw, fire, metal tools, and vehicle. Real microphone capture, feature parity, and live event delivery still need verification.

The best PC benchmark reached macro F1 `0.882236`. It uses YAMNet embeddings and a small MLP. It is too large and unsuitable for direct ESP32 deployment. Its small non-gunfire test support also makes the score exploratory.

## Target classes

The ESP32 model uses six mutually exclusive outputs:

```text
gunfire
chainsaw
metal_tool_activity
fire
vehicle
background
```

The browser contract uses five independent alert scores. It treats background as the absence of an alert target. The browser uses `chainsaw`, while some handoff material uses `chainsaw_logging`. Freeze one external event name before the dashboard bridge is complete.

Background never creates an alert. It should include forest ambience and difficult negatives such as rain, wind, birds, insects, branches, people, generators, and normal vehicles.

## Data flow

```text
source audio and annotations
    -> provenance and license checks
    -> source-specific label mapping
    -> recording or session group assignment
    -> train, validation, and test group split
    -> 16 kHz mono normalization
    -> fixed audio windows
    -> 64 by 32 log-power features
    -> model training
    -> validation threshold selection
    -> test evaluation
    -> full integer quantization
    -> TFLite Micro export
    -> ESP32 firmware
```

Split groups before creating windows or augmentations. Audio from one recording group must stay in one split.

## Storage layout

Raw data and generated outputs stay below ignored `ml/work/`. Do not add them to Git.

```text
ml/work/
|-- raw/
|   |-- c3gd/
|   |-- chainsaw_zenodo/
|   |-- esc50/
|   |-- fsd50k/
|   `-- tropical_gunshot/
|-- derived/
|   |-- v2/
|   `-- v3/
|-- features/
|-- models/
`-- runs/
```

Tracked code, tests, contracts, and documentation stay outside `ml/work/`.

## Dataset inventory

### Forest chainsaw

Path: `ml/work/raw/chainsaw_zenodo/original`

The source contains eight unique WAV and TextGrid pairs. All 16 downloaded files match the official Zenodo MD5 values. The omitted `RP3_0h30_to1h20` recording is byte-identical to `RP6_0h30_to1h20`.

The TextGrid files contain manually marked `saw` intervals. The next data task is to merge nearby intervals, make group-safe fixed windows, sample clean background, and complete listening-based quality control.

Eight recording groups are too few for a strong release claim. Keep the source because it has the best forest domain match. Do not inflate its test support with overlapping windows.

### Tropical Gunshot WDA

Path: `ml/work/raw/tropical_gunshot/original`

This source contributes tropical forest gunfire and matched forest background. The normalized candidate manifest contains 7,300 rows. Preserve the source training and validation boundary. Treat augmented copies as one source group where the source metadata permits it.

### C3GD

Path: `ml/work/raw/c3gd/extracted/C3GD-Dataset`

C3GD contributes 8,015 outdoor gunshot clips. Group clips by collection event and context. Do not split clips only by filename.

### FSD50K

Paths:

```text
ml/work/raw/fsd50k/original
ml/work/raw/fsd50k/extracted
ml/work/raw/fsd50k/metadata
```

All eight clean audio archive parts match the official Zenodo MD5 values. Extraction produced 40,966 development WAV files and 10,231 evaluation WAV files.

The source mapper accepts only CC0 and CC-BY clips. It rejects CC-BY-NC and Sampling+ clips. It also prevents uploader leakage across splits.

The current mapping uses:

| ARANYA class | Selected FSD50K families |
| --- | --- |
| gunfire | Gunshot and gunfire |
| metal tool activity | Drill, sawing, power tool, hammer, selected tools |
| fire | Fire, crackle |
| vehicle | Road motor vehicle, engine, motorcycle, truck, car, revving |
| background | Selected birds, insects, rain, wind, water, and wild animals |

Broad or ambiguous clips are excluded. FSD50K labels are weak donor labels. They are not proof of illegal logging or forest fire detection.

### ESC-50

Path: `ml/work/raw/esc50/original`

ESC-50 contributes small, clean supplemental sets for chainsaw, hand saw, crackling fire, engine, and environmental negatives. Preserve its official folds. Do not use it as the main source for a target class.

## Current combined manifest

Path: `ml/work/derived/v3/edge_manifest_fsd.csv`

The manifest contains 25,964 rows:

| Split | Rows |
| --- | ---: |
| Train | 19,028 |
| Validation | 2,744 |
| Test | 4,192 |

Source totals are:

| Source | Rows |
| --- | ---: |
| FSD50K | 10,209 |
| C3GD | 8,015 |
| Tropical Gunshot WDA | 7,300 |
| ESC-50 | 440 |

No recording group crosses a split. The manifest is still not release eligible. Chainsaw has only five test groups before the dedicated forest chainsaw source is processed.

## PC training path

The general pilot path supports log-mel or YAMNet features with logistic regression or a small MLP. It uses five independent alert targets. Background rows become all-negative examples.

From `ml`:

```powershell
.\work\uv\uv.exe run aranya-ml audit-pilot `
  --manifest .\work\derived\v2\fast_manifest_tropical.csv `
  --allow-provisional

.\work\uv\uv.exe run aranya-ml train-pilot `
  --manifest .\work\derived\v2\fast_manifest_tropical.csv `
  --output .\work\runs\fast-yamnet-mlp-tropical-f1-v1 `
  --features yamnet `
  --yamnet-model .\work\models\yamnet-savedmodel `
  --model mlp `
  --threshold-metric f1 `
  --allow-provisional
```

The PC model is useful for testing data quality and an upper-bound baseline. It is not the ESP32 model.

## Edge feature pipeline

The edge feature extractor is implemented in `ml/src/aranya_ml/edge/features.py`. The matching firmware code is in `firmware/aranya_node/edge_features.cpp`.

Feature settings:

| Setting | Value |
| --- | ---: |
| Sample rate | 16,000 Hz |
| Audio window | 15,360 samples, or 0.96 seconds |
| FFT size | 256 |
| Frame hop | 240 samples |
| Frames | 64 |
| Bands | 32 |
| Band construction | Four FFT bins per band |
| Compression | `log1p` of power |

Python and firmware must produce matching features for the same PCM test vector. That parity test is still pending.

## Edge model

The model builder is in `ml/src/aranya_ml/edge/model.py`. It uses depthwise-separable convolution blocks, a 1 by 1 convolutional head, global averaging, and softmax.

The head avoids a fully connected layer. The Chirale TensorFlow Lite Micro library linked unwanted ARM CMSIS symbols when the firmware included that operator.

The selected candidate has:

| Property | Value |
| --- | --- |
| Run | `aranya-edge-dscnn-nofc-v1` |
| Runtime | TFLite Micro |
| Quantization | Full INT8 |
| Model size | 12,680 bytes |
| SHA-256 | `b1c186ab83255358c5cdcb9567c4fc9003bc5683c9357311c68f7239753b913d` |
| ESP32 inference time | 46 to 47 ms per window |
| Test macro F1 | 0.525767 |

The firmware uses a targeted seven-operator resolver. It allocates a 420 KB tensor arena in PSRAM.

## Edge training command

From `ml`:

```powershell
.\work\uv\uv.exe run python .\tools\train_edge_dscnn.py `
  --manifest .\work\derived\v3\edge_manifest_fsd.csv `
  --output .\work\runs\aranya-edge-dscnn-fsd-v1 `
  --cache .\work\features\edge_spectrogram_fsd_v1.npz `
  --samples-per-class 2000 `
  --max-windows-per-recording 3 `
  --epochs 60 `
  --workers 8 `
  --width-multiplier 1.0
```

This is the next planned run. Add the processed forest chainsaw source to a new manifest first. Do not overwrite an old run directory.

## Quantization and firmware export

The trainer writes FP32 and INT8 TFLite files, metadata, metrics, and fixed test vectors. Export the chosen model as a C header:

```powershell
.\work\uv\uv.exe run python .\tools\tflite_to_c_header.py `
  .\work\runs\aranya-edge-dscnn-nofc-v1\aranya_edge_dscnn_int8.tflite `
  ..\firmware\aranya_node\model_data.h
```

Do this only after the candidate beats the current edge model and passes quantized evaluation.

## Evaluation rules

Use validation data to select thresholds and make model choices. Use test data only for final comparison.

Always report:

- Macro F1 and per-class F1.
- Per-class support and independent group counts.
- FP32 and INT8 results for an edge candidate.
- Model size and measured target latency.
- Confusion matrix.
- False-positive events per background hour when long background recordings exist.
- Data limitations and release eligibility.

Do not describe a confidence score as accuracy. Do not compare the five-output PC macro F1 directly with the six-class edge macro F1.

## Current result summary

| Model | Platform | Test macro F1 | Main limitation |
| --- | --- | ---: | --- |
| YAMNet embeddings plus MLP, best seed | PC | 0.882236 | Tiny test support outside gunfire |
| YAMNet embeddings plus MLP, primary run | PC | 0.874643 | Tiny test support outside gunfire |
| DS-CNN without dense head, INT8 | ESP32 candidate | 0.525767 | Trained before FSD50K and forest chainsaw integration |
| Wider DS-CNN, INT8 | ESP32 candidate | 0.404101 | Wider model made generalization worse |

See [results history](results-history.md) for all current runs and per-class details.

## What remains

Work in this order:

1. Process the eight verified forest chainsaw recordings.
2. Review a sample of positive and background chainsaw clips.
3. Add those rows to a new group-safe v3 manifest.
4. Train the compact DS-CNN with the verified FSD50K data.
5. Inspect the confusion matrix and per-class support.
6. Run one focused correction based on the largest error.
7. Quantize and compare FP32 with INT8.
8. Replace the firmware model only if the new candidate wins.
9. Run Python and firmware feature parity on fixed PCM.
10. Set the real INMP441 and BME280 pins.
11. Verify microphone capture, Wi-Fi event posting, and dashboard display.
12. Record long-background false positives and repeat the physical demo.

The goal of macro F1 `0.8` is not yet met by the ESP32 model. The PC benchmark has crossed `0.8`, but its test design is too small for a field claim.

## Checks

From `ml`:

```powershell
.\work\uv\uv.exe run ruff check src tests tools
.\work\uv\uv.exe run ruff format --check src tests tools
.\work\uv\uv.exe run pyright
.\work\uv\uv.exe run pytest -q
```

Related documents:

- [Dataset policy](dataset-policy.md)
- [Taxonomy](taxonomy.md)
- [Evaluation protocol](evaluation-protocol.md)
- [Project history](../ARANYA_PROJECT_HISTORY.md)
- [Firmware guide](../../firmware/README.md)
