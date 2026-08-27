# ARANYA AI project history

This document records work through 27 August 2026. It covers the product idea, repository, browser prototype, ML work, dataset work, edge firmware, verification, and known gaps. It separates tracked files from ignored local data and generated outputs.

## Current snapshot

ARANYA AI now has a browser baseline, a Python training workspace, and ESP32-S3 edge firmware. The browser accepts microphone input or uploaded audio, runs local YAMNet inference, confirms events over time, and shows alerts in a dashboard.

The current application has these properties:

- React and TypeScript web application built with Vite.
- Local TensorFlow.js YAMNet assets under `public/models/yamnet/`.
- Mono 16 kHz audio preprocessing.
- Browser microphone capture through an AudioWorklet and a rolling PCM buffer.
- AudioSet to ARANYA target mapping.
- Independent target scores, temporal confirmation, event creation, persistence, and dashboard views.
- Simulated sensor network, location, and multi-node views. These are clearly marked as simulated.
- Tracked ESP32-S3 firmware for INMP441 capture, edge features, TFLite Micro inference, temporal confirmation, BME280 telemetry, and Wi-Fi event posting.
- No LoRaWAN path or production backend. The dashboard event receiver is still missing.

The local ML work has produced reproducible manifests, PC baselines, and an ESP32-compatible INT8 DS-CNN. It has not produced a released or field-validated ARANYA model.

The earlier full pilot run was a balanced log-mel MLP using a filtered FSD50K domain subset with chainsaw and ESC-50 additions. It reached test macro F1 `0.377902` on its held-out source split. A compact benchmark using C3GD, ESC-50, Tropical Gunshot WDA, and YAMNet embeddings reached test macro F1 `0.874643` after selecting F1 thresholds on validation data. The compact benchmark has only eight positive test clips for each non-gunfire class, so it is not field accuracy or release evidence.

The ESP32-S3 N16R8 was detected on `COM6`. The firmware compiled, flashed, and ran INT8 inference in 46 to 47 ms per window. Placeholder pins and network settings prevented a valid microphone, BME280, Wi-Fi, and dashboard test.

The full ML guide is in `docs/ml/README.md`. Experiment metrics are tracked in `docs/ml/results-history.md`.

## Product scope and decisions

### Long-term product vision

The production concept is a distributed outdoor forest node:

```text
MEMS microphone
    -> ESP32-S3 or similar edge processor
    -> local acoustic classifier
    -> environmental telemetry
    -> event generation
    -> long-range transport such as LoRaWAN
    -> gateway and backend
    -> monitoring dashboard
```

Possible future features include better microphones, BME280 sensing, GNSS, solar power, LiFePO4 storage, an outdoor enclosure, multiple nodes, TDOA localization, and a central backend.

### SIH prototype scope

The short-term prototype was reduced to the path that can be demonstrated reliably:

```text
INMP441 microphone
    -> ESP32-S3 N16R8
    -> edge inference
    -> event confirmation
    -> Wi-Fi
    -> local gateway or laptop
    -> ARANYA dashboard
```

LoRaWAN was not procured. Wi-Fi is the current prototype transport. LoRaWAN must be described as future work, not as an implemented feature.

The intended final demonstration requires a physical node, local inference on the ESP32-S3, metadata over Wi-Fi, and a repeatable dashboard alert. The browser YAMNet path is a baseline and development reference. It is not a substitute for edge inference.

### Explicit non-goals for the one-day demonstration

The following items were deliberately kept out of the blocking path:

- LoRaWAN.
- Multiple physical nodes.
- TDOA or other localization algorithms.
- GNSS.
- Solar and LiFePO4 power.
- A production backend.
- The full market taxonomy.
- A perfect PCB.
- Production retraining infrastructure.

A validated breadboard in an enclosure is more useful for the demonstration than an untested PCB.

## System architecture as implemented

The browser pipeline is currently:

```text
Browser microphone or uploaded audio
    -> Web Audio API
    -> mono PCM
    -> 16 kHz resampling
    -> local TensorFlow.js YAMNet
    -> 521 AudioSet scores
    -> ARANYA class mapping
    -> frame and timeline segmentation
    -> temporal confirmation
    -> canonical AranyaEvent
    -> Zustand event store
    -> dashboard, alerts, map, incidents, analytics
```

Important implementation boundaries:

- `src/app/commands/` owns state-writing commands and event IDs.
- `src/domain/` contains pure detector and event rules.
- `src/platform/` contains browser adapters such as audio capture and persistence.
- `src/services/` contains model adapters, audio processing, temporal logic, simulations, and visual analysis helpers.
- `src/components/` and `src/pages/` contain presentation and user flows.
- `contracts/` contains versioned interfaces shared by TypeScript and Python.
- `ml/src/aranya_ml/` contains the Python data, feature, model, training, and evaluation package.

The repository keeps one web application at its root. It does not add an `apps/web` wrapper until another deployable application exists.

## Browser prototype work

### Audio input and preprocessing

The prototype supports uploaded files and live browser microphone input. Audio is converted to mono and resampled to 16 kHz before model inference.

Live capture was moved to `AudioWorklet` through `src/platform/audio/rollingPcmCapture.ts`. A tested ring buffer retains the newest two seconds. The worklet transfers PCM chunks away from the audio rendering thread.

The application also has waveform, FFT, and spectrogram displays. These views support inspection and demonstration. They are not additional classifiers.

### YAMNet baseline

YAMNet is loaded locally from `public/models/yamnet/`. The browser reads 521 AudioSet scores. The model is a published general audio model and has not been fine-tuned on ARANYA data.

Two browser baselines were made explicit:

- A0 keeps compatibility with the original UI. It pools eight current classes and normalizes their scores.
- A1 pools the five ARANYA targets independently and clips scores to the range 0 to 1. Background and context scores cannot suppress a target.

A1 is the evaluation path. It must pass threshold evaluation before it replaces A0.

The browser model asset is a TensorFlow.js conversion of published YAMNet weights. Conversion inputs and temporary converter environments remain outside Git. Runtime output shapes are validated because converter output ordering is not treated as a stable interface.

### Detector and event flow

The detector contract validates model output before it enters the application. The event builder creates a canonical `AranyaEvent` only after the detector rules and temporal confirmation pass.

The event command layer supplies IDs and timestamps, then writes to Zustand state. Persisted browser state has a versioned migration for legacy class IDs.

The dashboard contains pages for the main dashboard, alerts, incident details, analytics, live listening, audio upload, demo mode, forest map, sensor details, and sensor network. Human feedback remains in browser storage. It does not retrain or calibrate a model.

## Taxonomy and contract state

The committed detector contract defines five candidate target outputs:

1. `gunfire`
2. `chainsaw`
3. `metal_tool_activity`
4. `fire`
5. `vehicle`

Context classes used by the browser baseline include `wildlife`, `background`, and `tree_fall`.

`background` is not a sixth target output in the current contract. It means that no target crossed its threshold. The local pilot data pipeline accepts background rows as all-negative examples, but the model output order remains the five target classes above.

This is important because the project handoff used `chainsaw_logging` and described six output classes including `background`. The repository currently uses `chainsaw` and five outputs. That mismatch must be resolved before an exported model and ESP32 firmware are frozen. It must not be hidden by renaming fields in only one layer.

Legacy persisted IDs are migrated as follows:

```text
gunshot       -> gunfire
fire_anomaly  -> fire
metal_clank   -> metal_tool_activity
```

Scores are independent. They are not normalized across target classes. A window can contain more than one target.

## Repository and data boundaries

### Tracked directories

```text
contracts/                 Shared taxonomy and JSON schemas
docs/                      Architecture, policy, product, and project history
src/                       Browser application
public/models/yamnet/      Browser YAMNet model assets
ml/datasets/               Tracked metadata, annotations, and frozen splits
ml/src/aranya_ml/          Python ML package
ml/tests/                  Python tests
scripts/                   Repository checks
```

### Ignored local directories

```text
ml/work/                   Raw downloads, derived audio, manifests, caches, and runs
ml/artifacts/              Generated model artifacts
ml/checkpoints/            Training checkpoints
ml/runs/                   Generated experiment outputs
ml/outputs/                Generated exports
ml/reports/                Generated reports and figures
```

Raw audio, embeddings, checkpoints, generated reports, and exported models are not committed. The provenance, schema, source records, and split decisions belong in tracked files. The current `.gitignore` covers Node output, Python environments, conversion tools, ML data, experiment artifacts, local configuration, IDE files, and temporary files.

This separation keeps Git usable and prevents raw audio or local model outputs from becoming accidental release artifacts.

## Committed ML foundation

The Python package is under `ml/src/aranya_ml/`. It is installed and run through `uv` using the lockfile.

### Catalog and policy

The historical tracked catalog is under `ml/datasets/v1/`. It separates source licenses, recordings, target intervals, and frozen group-to-split assignments.

It contains 13 historical recordings and 10 target intervals. All recordings are in the `legacy-v0` test split because they influenced previous prototype testing. None is training eligible.

The policy requires:

- Verified provenance and a license decision for every training record.
- Technical metadata and a stable recording group.
- Review of target intervals.
- No assumption that unreviewed time is background.
- Group-safe splits before window extraction.
- Frozen test material after it affects a decision.
- Privacy and location controls for field recordings.

### Pilot manifest

`ml/src/aranya_ml/data/pilot_manifest.py` adds an external-manifest path for the current six-class data collection work. It accepts the five target classes plus `background`, tracks provenance, checks group-safe splits, maps FSD50K labels, marks provisional rows, and checks release eligibility.

Background rows become all-negative target vectors. They help train a detector but do not add a sixth output.

### Features and models

The feature package provides:

- Windowed log-mel features.
- Optional YAMNet embedding features through a local Python SavedModel.
- Fingerprinted feature caching.

The model package provides:

- The browser-compatible baseline mapping.
- One-vs-rest logistic regression.
- A small multi-output MLP.

The training package records configuration, data audits, feature settings, split information, thresholds, metrics, and model artifacts. Experiment caches are bound to the full configuration so a changed setting cannot reuse an incompatible cache.

### Evaluation rules

The evaluation protocol compares A0, A1, logistic regression on embeddings, and a small MLP. Thresholds are selected on validation data. Test data is reserved for final reporting.

The required release report includes per-class precision, recall, F2, PR-AUC, calibration error, event recall, event precision, detection delay, duplicate events, false-positive events per background hour, latency, model size, confidence intervals, and supported slices such as source, session, device, distance, and weather.

No candidate class has been promoted. Promotion requires preserving or improving event recall without increasing the approved false-alert budget.

## Dataset acquisition and processing

Downloaded sources and generated audio belong below `ml/work/`. They are ignored by Git.

### Existing forest chainsaw source

Current source path:

```text
ml/work/raw/chainsaw_zenodo/original
```

The current workspace contains eight unique WAV files and eight matching Praat TextGrid annotations. All 16 files match their official Zenodo MD5 values. TextGrids are annotation files, not audio.

The annotation parser found:

- 9 TextGrids.
- 1,255 total intervals.
- 609 padded chainsaw windows before merging and deduplication.
- 7,051 background candidates.

The processing script merges nearby events, pads event windows by about two seconds, converts clips to 16 kHz mono PCM, and checks duplicate source recordings.

Two WAV files were byte-identical:

```text
RP3_0h30_to1h20.wav
RP6_0h30_to1h20.wav
```

`RP6_0h30_to1h20.wav` was retained. `RP3_0h30_to1h20.wav` was excluded as a duplicate. The decision is recorded in:

```text
ml/work/derived/v2/chainsaw_preferred/dedupe_exclusions.csv
```

The current workspace has eight unique recording groups. Clip rebuilding and human listening are still pending. The model must not treat this source as release-approved until review decisions are recorded.

### Tropical forest gunshot source

Raw source:

```text
ml/work/raw/tropical_gunshot/original
```

The source card describes augmented training gunshots, training backgrounds, validation gunshots, and validation backgrounds. The downloaded WAV files were 8 kHz mono even though the source description suggested a different technical format. The processor normalized them to 16 kHz mono.

The candidate manifest contains 7,300 normalized rows. The source has limited independent groups. Training rows are conservatively grouped together, and validation rows are grouped separately. Augmented copies must not be treated as independent recordings.

### C3GD gunshot source

Raw archive and extraction:

```text
ml/work/raw/c3gd/original/C3GD-Dataset.zip
ml/work/raw/c3gd/extracted/C3GD-Dataset
```

The extraction contains 8,015 WAV files and metadata. Event IDs and day or part metadata are preserved. Clips are grouped by event and collection context, not treated as independent just because their files are separate.

### FSD50K

Raw metadata and audio archives:

```text
ml/work/raw/fsd50k/metadata
ml/work/raw/fsd50k/original
ml/work/raw/fsd50k/extracted
```

The first eight audio downloads reached the official file sizes but failed the official Zenodo MD5 checks. 7-Zip also reported data and header errors. Those files and the partial extraction were preserved below `ml/work/raw/fsd50k/corrupt/`.

All eight replacement audio archive parts match the official Zenodo MD5 values. Clean extraction produced 40,966 development WAV files and 10,231 evaluation WAV files.

The processor kept these label mappings:

```text
Gunshot_and_gunfire                                      -> gunfire
Fire, Crackle                                             -> fire
Drill, Sawing, Power_tool, Hammer, Tools                  -> metal_tool_activity
Motor_vehicle_(road), Vehicle, Car_passing_by             -> vehicle
Accelerating_and_revving_and_vroom, Engine_starting       -> vehicle
Engine, Motorcycle, Truck, Car                             -> vehicle
Bird, insects, rain, wind, water, wild animals             -> background
```

The tracked processor uses exact FSD50K label spellings. It accepts CC0 and CC-BY clips only. It rejects CC-BY-NC and Sampling+ clips. It assigns each uploader to one split, with test taking priority over validation and validation over train. This prevents uploader leakage across splits.

The processor added 10,209 eligible FSD50K rows. It excluded 40,988 rows because of class mapping, ambiguity, or license rules.

FSD50K is a donor dataset. Its labels do not perfectly represent illegal logging, forest fire, or forest vehicle activity. Tool and vehicle classes need hard-negative review before field claims.

### ESC-50

Raw source:

```text
ml/work/raw/esc50/original
```

Selected categories were normalized to 16 kHz mono under `ml/work/derived/v2/esc50/`. The 400 selected clips cover chainsaw, crackling fire, engine, hand saw, rain, wind, chirping birds, insects, pouring water, and sea waves. Official folds were preserved, with folds 1 to 3 for training, fold 4 for validation, and fold 5 for test. The source license is CC-BY-4.0.

ESC-50 is small. It is useful for coverage and hard negatives, not as the primary source for any target.

### Compact recovery manifests

The current local manifests are:

```text
ml/work/derived/v2/fast_manifest.csv
ml/work/derived/v2/fast_manifest_tropical.csv
```

The first manifest contains 8,455 rows from C3GD and ESC-50. The expanded manifest contains 15,755 rows and adds Tropical Gunshot WDA. The v3 manifest at `ml/work/derived/v3/edge_manifest_fsd.csv` contains 25,964 rows after adding 10,209 FSD50K rows. All three are pilot assets with source and class imbalance.

## Exploratory training runs

The runs were PC experiments using local generated features. They did not use an ESP32 and did not produce a release artifact.

### Run 1: full log-mel logistic baseline

Output:

```text
ml/work/runs/pc-logmel-v1b
```

This run used a basic log-mel feature pipeline and multinomial logistic regression. It used 25,596 rows and reached:

| Split | Macro F1 |
| --- | ---: |
| Train | 0.578818 |
| Validation | 0.321340 |
| Test | 0.264051 |

The optimizer emitted a convergence warning at 500 iterations. This run was useful as a reference, not as a candidate model.

### Run 2: balanced logistic baseline

Output:

```text
ml/work/runs/pc-logmel-balanced-v1
```

The training set was capped at 1,000 rows per class. Results were:

| Split | Macro F1 |
| --- | ---: |
| Train | 0.710334 |
| Validation | 0.321651 |
| Test | 0.291876 |

Balancing improved training fit but did not solve source or class confusion on the test set.

### Run 3: balanced log-mel MLP

Output:

```text
ml/work/runs/pc-logmel-mlp-balanced-v1
```

The MLP used hidden layers `(128, 64)`. Results were:

| Split | Macro F1 |
| --- | ---: |
| Train | 0.785617 |
| Validation | 0.401103 |
| Test | 0.319327 |

### Run 4: FSD domain-focused balanced MLP

Output:

```text
ml/work/runs/pc-logmel-mlp-fsd-domain-v1
```

This run focused on FSD domain classes and added chainsaw and ESC-50 coverage. It is the best recorded pilot run:

| Split | Macro F1 |
| --- | ---: |
| Train | 0.741802 |
| Validation | 0.362056 |
| Test | 0.377902 |

The held-out test uses source partitions rather than a field recording evaluation. The score only supports the conclusion that this setup is a better exploratory baseline than the earlier runs. It does not support a claim of field readiness.

### Recovery run: compact YAMNet benchmark

The previous local pilot artifacts were not visible in the current checkout. To continue within the demonstration window, a smaller reproducible benchmark was rebuilt under ignored `ml/work/`:

- C3GD supplies gunfire clips.
- ESC-50 supplies chainsaw, crackling fire, engine, hand saw, fireworks, rain, wind, birds, insects, water, and wave examples.
- C3GD groups are split by source file ID. ESC-50 keeps official folds and groups repeated takes by source file.
- The manifest contains 8,455 rows with no group crossing train, validation, and test.
- The test set has 1,340 rows, but only eight positive clips for each non-gunfire target.
- YAMNet embeddings are pooled as mean and maximum vectors, then classified with balanced independent MLP heads.
- The experiment output is `ml/work/runs/fast-yamnet-mlp-f1-v1`.

Results:

| Split | Macro F1 | Macro precision | Macro recall |
| --- | ---: | ---: | ---: |
| Train | 0.945041 | 0.961231 | 0.933333 |
| Validation | 0.843132 | 0.908333 | 0.800000 |
| Test | 0.860616 | 0.911111 | 0.825000 |

The test per-class F1 values were gunfire `1.000`, chainsaw `0.857`, metal tool activity `0.933`, fire `0.571`, and vehicle `0.941`. Fire is the main remaining weakness. Because the rare-class test support is eight clips, this score is a benchmark milestone, not a claim of generalization to forest recordings.

The ML evaluation code now supports both F1 and F2 validation threshold objectives. The CLI option is:

```powershell
uv run aranya-ml train-pilot `
  --manifest work/derived/v2/fast_manifest.csv `
  --output work/runs/fast-yamnet-mlp-f1-v1 `
  --features yamnet `
  --yamnet-model work/models/yamnet-savedmodel `
  --model mlp `
  --threshold-metric f1
```

This option changes threshold selection only. It does not change the underlying model or data.

### Expanded compact benchmark result

The expanded manifest adds 7,000 Tropical Gunshot WDA training rows and keeps its 300 official validation rows in the test split. It contains 15,755 rows and passes the group split audit with no crossing errors. The run output is:

```text
ml/work/runs/fast-yamnet-mlp-tropical-f1-v1
```

Results:

| Split | Macro F1 | Macro precision | Macro recall |
| --- | ---: | ---: | ---: |
| Train | 0.932636 | 0.933819 | 0.931777 |
| Validation | 0.863591 | 0.886111 | 0.848810 |
| Test | 0.874643 | 0.918283 | 0.845435 |

Test per-class F1 values were gunfire `0.986`, chainsaw `0.857`, metal tool activity `0.875`, fire `0.714`, and vehicle `0.941`. The test set has 1,640 rows. It has 1,402 gunfire positives but only eight positives for each other target. The score is therefore a useful PC benchmark and a training direction, not evidence of balanced real-world performance.

### Edge model candidate export

The first deployable model path was started from the same expanded manifest. It trains a small independent-branch MLP on the 192-value log-mel summary feature vector. The tracked exporter is `ml/tools/export_edge_candidate.py`.

The exporter produced these local artifacts:

```text
ml/work/runs/aranya-edge-logmel-candidate-v1/aranya_edge_logmel_int8.tflite
ml/work/runs/aranya-edge-logmel-candidate-v1/aranya_edge_logmel_float32.tflite
ml/work/runs/aranya-edge-logmel-candidate-v1/metadata.json
ml/work/runs/aranya-edge-logmel-candidate-v1/test_vectors.npz
```

The INT8 file is 179,544 bytes. Its SHA-256 is `7af94b27a7ca20c8cce3e6a187de2c87b8387d3e42067fa3b0882402307ac5f1`. The model has an INT8 input tensor of shape `[1, 192]` and an INT8 output tensor of shape `[1, 5]`.

Quantized test macro F1 was `0.406073`. This is below the YAMNet PC benchmark and the candidate is not selected for deployment. The exporter disables per-channel quantization because the Arduino TFLite Micro port produced mismatched class scores with that kernel path. The revised INT8 model compiled and ran on the ESP32-S3 with a 220 KB internal-RAM tensor arena. Its zero-vector scores matched the PC TFLite interpreter: `0.501952, 0.007843, 0.925474, 0.000000, 0.870573`. Full audio preprocessing, latency, RAM use under the real pipeline, and end-to-end event transport are still pending. The candidate metadata is intentionally separate from the production model-bundle contract because its input is a feature vector rather than raw audio.

### 26 August 2026: environment recovery and data expansion

The local ML environment was restored with the locked Python dependencies and a local YAMNet SavedModel. The host GPU was verified as an NVIDIA GeForce RTX 5070 Ti with 16 GB of memory. TensorFlow 2.19.0 runs successfully, but its native Windows build reports no TensorFlow GPU device. The YAMNet feature extraction runs used the CPU.

The following raw sources were downloaded below ignored `ml/work/raw/`:

- C3GD at `ml/work/raw/c3gd/`, with 8,015 gunfire WAV files and its metadata.
- ESC-50 at `ml/work/raw/esc50/original/`, with its audio, metadata, and license files.
- Tropical Gunshot WDA at `ml/work/raw/tropical_gunshot/original/`, with 3,500 augmented gunfire clips, 3,500 augmented background clips, 150 held-out gunfire clips, and 150 held-out background clips.

The first compact manifest has 8,455 rows. The expanded manifest has 15,755 rows. The expanded manifest keeps the Tropical Gunshot WDA training split in train and its unaugmented validation split in test. Both manifests pass the split audit with no recording-group crossing errors. These manifests and all generated features and models remain local artifacts. They are not committed to Git.

The training CLI now accepts `--threshold-metric f1` or `--threshold-metric f2`. The default remains F2 for compatibility. F1 threshold selection was added with tests, and the compact F1 run is recorded above. Threshold selection does not change the classifier or turn a PC pilot into an edge model.

### 27 August 2026: DS-CNN edge pipeline and board test

A six-class DS-CNN pipeline now uses this firmware-friendly feature contract:

```text
16 kHz mono PCM
    -> 15,360-sample window
    -> 256-point Hann FFT
    -> 240-sample frame hop
    -> 64 frames by 32 four-bin spectral bands
    -> log1p band power
    -> INT8 DS-CNN
```

The first DS-CNN reached INT8 test macro F1 `0.478953` and produced a 12,600-byte model. Validation-selected class thresholds reduced its test score to `0.441726`, so that threshold variant was rejected.

The Chirale ESP32 library linked an ARM-only fully connected kernel. The model head was changed to a 1 by 1 convolution, global mean, and softmax. A regression test now rejects `FULLY_CONNECTED` in the edge model. The revised INT8 model is 12,680 bytes and reached test macro F1 `0.525767` on the same imbalanced pilot.

A 2.0 width multiplier produced a 22,592-byte INT8 model. Validation accuracy improved during training, but test macro F1 fell to `0.404101`. This candidate was rejected. More capacity did not solve the source imbalance.

A top-two-window recording aggregation was tested to mirror temporal confirmation. It reduced the compact model's test macro F1 to `0.503171`, compared with `0.525767` for mean aggregation. Mean aggregation remains the default. Top-k aggregation is available only as an explicit experiment option.

Tracked firmware now covers INMP441 I2S capture, matching spectral features, TFLite Micro inference, two-window temporal confirmation, optional BME280 readings, and Wi-Fi JSON event posting. The tensor arena is allocated in the board's 8 MB PSRAM. The targeted seven-op resolver replaced `AllOpsResolver`.

The firmware compiled and flashed to the connected ESP32-S3. Measured build use was 1,039,095 bytes of flash and 121,132 bytes of internal global memory. Live INT8 inference took 46 to 47 ms per window.

The default pin map and network values are placeholders. The board reported `bme=missing` and `wifi=offline`. It produced a constant gunfire score with the placeholder microphone wiring. This confirms model execution, but it does not confirm valid microphone capture or end-to-end event delivery. The hardware pin map and Wi-Fi settings must be supplied before that test.

### 27 August 2026: verified data expansion and ML documentation

All eight replacement FSD50K audio archive parts passed their official MD5 checks. Clean extraction produced 51,197 WAV files. The FSD50K mapper accepted 10,209 CC0 or CC-BY rows and excluded 40,988 rows.

The combined v3 edge manifest now has 25,964 rows. It contains 19,028 training rows, 2,744 validation rows, and 4,192 test rows. No recording group crosses a split. The manifest is not release eligible because its dedicated forest chainsaw coverage remains too small.

The eight unique forest chainsaw WAV and TextGrid pairs were downloaded again into the current workspace. All 16 files passed their official Zenodo MD5 checks. Clip processing and listening-based quality control remain pending.

A separate ML guide was added at `docs/ml/README.md`. It covers storage, data sources, splits, PC training, edge features, DS-CNN training, quantization, firmware export, evaluation rules, and remaining work. `docs/ml/results-history.md` now records completed PC and edge experiments without hiding rejected runs.

## Changelog by commit

The following is the implementation history in chronological order. Commit subjects are preserved in plain text.

### 16 August 2026

- `aa195bd` Baseline: Arya existing Aranya prototype.
  - Established the original browser prototype.
  - This was the starting point for the current application.

### 25 August 2026

- `b829dc9` Prepare Aranya for collaborative development.
  - Removed committed `dist` output.
  - Added `.editorconfig`, `.gitattributes`, README, and contribution guidance.
  - Added ML scaffolding and committed browser YAMNet assets.
  - Added ignore rules for raw data, generated outputs, converter tools, and local environments.
  - Reorganized browser services and state boundaries.

### 26 August 2026: repository foundation

- `4628189` Ignore local worktrees.
- `6a5bf9b` Establish tested project foundations.
  - Repackaged Python ML modules.
  - Removed static reports from the tracked implementation.
  - Moved modules below `ml/src/aranya_ml/`.
- `80d0d78` Add current web and ML quality gates.
  - Added shared taxonomy and detector contracts.
  - Added JSON schemas.
  - Added CI, ESLint, Vitest, and the `uv` lockfile.
  - Added architecture, dataset, evaluation, and taxonomy documentation.
- `f3e45e1` Package Python ML modules and packages.
- `64e2c43` Normalize multi-label ML foundations.
  - Replaced the old flat manifest and scripts with the catalog structure under `ml/datasets/v1`.
  - Added shared contract loading, catalog validation, baseline mapping, and classifier modules.

### 26 August 2026: browser contract repair

- `337656d` Align browser with detector contracts.
  - Added shared taxonomy use in the browser.
  - Added detector output validation.
  - Added the canonical event builder and event commands.
  - Updated the audio pipeline and YAMNet mapping.
  - Added rolling PCM capture, temporal logic, and timeline event logic.
  - Added CI and style checks.
  - Added persistence migration for legacy class IDs.
- `9aea0e2` Remove duplicate listening label.
- `369faf3` Prevent fabricated detection results.
  - Tightened output validation.
  - Added detector and classifier tests.
  - Tightened the data catalog.
- `968012b` Merge ARANYA foundation.

### 26 August 2026: ML repair design

- `9db893d` Specify ML training repair design.
- `6f5bc66` Plan ML training repair.
- `8a463a7` Validate pilot multi-label data.
  - Added `pilot_manifest.py`.
  - Added six-class pilot ingestion with five target outputs plus background rows.
  - Added group-safe split checks, FSD50K mapping, provenance, and release eligibility checks.
- `a61906f` Evaluate independent target scores.
  - Added multilabel metrics and tests.
- `b3426a1` Add windowed feature backends.
  - Added log-mel features, feature caching, YAMNet helpers, and tests.
- `8b7f34c` Balance independent target models.
  - Added logistic and MLP classifier functions and tests.
- `1c741d1` Add reproducible ML experiments.
  - Added experiment configuration.
  - Added fingerprinted feature caching.
  - Added data audit, threshold selection, and model artifact output.
- `6a5b35a` Expose repaired ML experiments through the CLI.
  - Added `audit-pilot` and `train-pilot`.
  - Updated ML documentation and tests.
- `62c855e` Skip linked data in style checks.
- `131b93a` Bind experiment caches to the full configuration.
  - Added tests for cache invalidation when settings change.

### 26 August 2026: field improvement and review controls

- `ee90722` Design the field F2 improvement program.
- `5b23a0f` Plan the field F2 improvement program.
  - Added plans for the program, student work, teachers, promotion, and foundation work.
- `f6f88cd` Validate field annotation reviews.
  - Added field dataset review metadata and catalog validation.
- `08144d6` Require final field review decisions.
  - Added a dataset metadata file and more catalog tests.
- `213c6ae` Measure reviewed acoustic events.
  - Added tracked event windowing and reviewed-event evaluation modules.
  - Added extensive tests.
- `5b7830e` Correct reviewed event evaluation.
  - Fixed event and window metric behavior.
  - Added regression tests.
- `91995fd` Fix type catalog test fixtures.
  - Current `main` HEAD.

Some field F2 work appears in commit history, but the current checkout should be treated as authoritative. Do not assume a file exists because it appeared in an earlier commit or a different branch. For example, `ml/datasets/field-v1` is not present in the current working tree and should not be described as a current data release.

## Checks and quality gates

The web package defines these commands in `package.json`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check:style
```

The Python package uses:

```powershell
cd ml
uv sync --locked --group dev
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest
```

The latest Python check passed 64 tests. Ruff, formatting, and Pyright also passed. The root web checks previously passed: TypeScript typecheck, 53 browser tests, the production build, and targeted ESLint. Running `uv run pytest -q` from the repository root can accidentally collect tests from a cloned ESC-50 checkout and fail on an optional matplotlib dependency. Run it from `ml`.

The root checks are also run in CI on pull requests and pushes to `main`. `git diff --check` is required before claiming documentation or code is clean.

## Current gaps

### Hardware and edge deployment

- The firmware compiles, flashes, and runs INT8 inference on the ESP32-S3.
- The actual breadboard pin map has not replaced the placeholder firmware pins.
- Valid INMP441 signal capture has not been observed with the current pin settings.
- BME280 detection and Wi-Fi connection are still unverified.
- Python and firmware feature parity still needs a fixed audio test vector.
- Dashboard event delivery has not been tested from the physical node.

### Data and model quality

- The verified forest chainsaw source still needs clip processing and human quality review.
- The pilot combines very different source domains.
- The tropical gunshot source has limited independent recording groups.
- FSD50K is verified and mapped, but the edge model has not been retrained on the v3 manifest.
- FSD50K labels are broad donor labels, not direct field labels.
- Background contains both natural ambience and machinery, so hard-negative review is still needed.
- No approved validation threshold or false-alert budget has been set.
- No candidate class has passed a release gate.

### Contract and product integration

- The handoff name `chainsaw_logging` differs from the repository contract name `chainsaw`.
- The handoff describes six output classes. The committed model contract has five outputs and treats background as all-negative context.
- The firmware can post event JSON, but its endpoint has not been connected to the dashboard event store.
- The browser uses YAMNet. It does not prove that an edge model will match browser output.
- Simulated sensor and location data must remain labeled as simulated.

## Reproduction commands

### Start the browser application

From the repository root:

```powershell
npm ci
npm run dev
```

The browser model must remain at `public/models/yamnet/model.json` with its shard files.

### Validate the tracked ML catalog

From `ml`:

```powershell
uv sync --locked --group dev
uv run aranya-ml validate-catalog --catalog datasets/v1
uv run pytest -q
```

The historical catalog is expected to contain no training-eligible rows.

### Audit and train a local pilot manifest

From `ml`:

```powershell
uv run aranya-ml audit-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --allow-provisional

uv run aranya-ml train-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --output work/runs/repaired-logmel-mlp-v1 `
  --features logmel `
  --model mlp `
  --allow-provisional
```

The command writes generated features and outputs below ignored `ml/work/`. It does not alter the tracked catalog.

YAMNet experiments require a local Python SavedModel. Browser TFJS assets are not directly accepted by the Python runner:

```powershell
uv run aranya-ml train-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --output work/runs/repaired-yamnet-logistic-v1 `
  --features yamnet `
  --yamnet-model work/models/yamnet-savedmodel `
  --model logistic `
  --allow-provisional
```

## How to continue work with Codex

Keep all raw downloads and generated audio below the repository's ignored `ml/work/` tree. Use one source directory per dataset:

```text
ml/work/raw/<source>/original
ml/work/raw/<source>/extracted
ml/work/derived/v2/<source>
ml/work/runs/<experiment-name>
```

When asking Codex to process data, provide:

1. The absolute or repository-relative raw source path.
2. The source URL and license terms if known.
3. The intended target mapping.
4. Any source or session grouping rule.
5. The output manifest path.
6. Whether rows are provisional or approved.
7. The command or script that should be repeatable.

A useful prompt is:

```text
Process the dataset at ml/work/raw/<source>/original.
Map only these labels: ...
Write normalized 16 kHz mono audio under ml/work/derived/v2/<source>.
Preserve source IDs, license metadata, recording groups, and official splits.
Do not add raw or generated files to Git.
Run the manifest audit and report counts, exclusions, and unresolved review items.
```

For training, ask Codex to use the manifest rather than scanning raw folders. For evaluation, name the frozen split and ask for per-class metrics, confusion matrices, false-positive events per background hour, and a clear statement of whether the result is exploratory or release eligible.

## Source and provenance links

The external sources used by the local pilot are:

- Tropical forest gunshot data: <https://huggingface.co/datasets/Tairooonz/tropical-gunshot-wda-dataset>
- FSD50K: <https://zenodo.org/records/4060432>
- FSD50K explorer: <https://fsannotator.upf.edu/fsd/release/FSD50K/>
- C3GD: <https://github.com/Stonewall-Defense/C3GD>
- ESC-50: <https://github.com/karolpiczak/ESC-50>

Retain the original source records and per-clip license metadata under `ml/work/raw/`. Do not publish or redistribute downloaded audio without checking the source license for the specific clip.

## Definition of current success

The software foundation is in place. The local pilot data pipeline and exploratory training path work on a PC. The project is not complete as an edge prototype until the following are verified on the target hardware:

```text
INMP441 capture
    -> ESP32-S3 preprocessing
    -> ESP32-S3 model inference
    -> temporal confirmation
    -> Wi-Fi event metadata
    -> dashboard alert
    -> repeatable physical demonstration
```

Until those checks are recorded, use the words `browser baseline`, `PC pilot`, `simulated`, `provisional`, and `not release eligible` where they apply.
