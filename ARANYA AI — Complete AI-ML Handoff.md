# ARANYA AI — Complete AI/ML Handoff

## 1. Purpose

This document is the handoff for the **AI/ML workstream of ARANYA AI**.

The objective is to move ARANYA from:

**working browser-based YAMNet prototype**

to:

**measured ARANYA-specific acoustic classifier**

and eventually to:

**compact edge model deployable on ESP32-S3**.

The existing project is currently a browser-based React prototype with real audio preprocessing, local YAMNet inference, temporal processing, event generation, dashboard visualization, and simulated sensor-network/localization behaviour.

No ARANYA-specific model has been trained yet. The ML scaffolding exists, but the major missing ingredient is labelled, domain-relevant acoustic data.

---

# 2. Current AI System

The current real inference pipeline is:

```text
Browser microphone / uploaded audio
        ↓
Web Audio API
        ↓
Mono PCM
        ↓
16 kHz resampling
        ↓
TensorFlow.js YAMNet
        ↓
521 AudioSet scores
        ↓
ARANYA manual mapping
        ↓
Temporal processing
        ↓
Canonical AranyaEvent
        ↓
Zustand
        ↓
Dashboard / Alerts / Incidents / Analytics
```

This architecture is documented in the current project handoff.

The current model is **YAMNet**, a pretrained general-purpose AudioSet model.

It is:

- not trained specifically for ARANYA,
- not trained specifically for Indian forests,
- not fine-tuned for the intended deployment environment.

The application currently primarily uses YAMNet's **521 class-score output**. YAMNet's **1024-dimensional embeddings** have not yet been used for an ARANYA-specific trained classifier.

---

# 3. Official ARANYA Target Classes

The AI/ML target classes are now fixed as:

```text
1. Gunfire
2. Chainsaw
3. Metal Tool Activity
4. Fire
5. Vehicle
```

Machine-friendly names:

```text
gunfire
chainsaw
metal_tool_activity
fire
vehicle
```

These match categories already represented in the current YAMNet-to-ARANYA mapping, which includes gunshot, chainsaw, vehicle/engine, fire-related sound, and metallic activity.

---

# 4. Background / No-Target Data

Although the visible ARANYA system has five target classes, the ML dataset also requires **non-target/background audio**.

Internal label:

```text
background
```

or:

```text
no_target
```

This is not necessarily a sixth alert category.

It exists so the system can learn:

> None of the five target sounds are present.

Background data should include subtypes such as:

```text
forest_ambience
birds_animals
wind
rain
human_activity
speech
insects
machinery
generic_impacts
other_environmental_noise
```

The existing ML design already retains hard-negative background subtypes because they help identify why false positives occur.

---

# 5. Class Definitions

## Gunfire

### Include

```text
single firearm discharge
multiple firearm discharges
distant firearm-like shots
repeated gunfire
```

### Common hard negatives

```text
firecrackers
balloon pops
thunder
wood impacts
metal impacts
door slams
construction impulses
```

The final dataset must clearly document whether fireworks/firecrackers are considered Gunfire or a hard negative.

---

## Chainsaw

### Include

```text
chainsaw startup
chainsaw idle
chainsaw revving
active chainsaw operation
chainsaw cutting
```

### Hard negatives

```text
motorcycles
generators
tractors
small engines
brush cutters
power tools
vehicle engines
```

Important:

The label should remain:

```text
chainsaw
```

not:

```text
chainsaw_logging
```

because audio can detect chainsaw activity but cannot determine whether the activity is legal, illegal, or actually cutting a tree.

Threat interpretation should happen later in the application.

---

# 6. Metal Tool Activity

This is the most difficult and least acoustically precise class.

### Intended examples

```text
metal hammering
metal striking
metal cutting
tool-on-metal activity
repeated metallic impacts
strong clang/clatter patterns
```

### Hard negatives

```text
vehicle rattling
gates
dropped objects
construction
machinery
small incidental clinks
normal human activity
```

This class must be watched carefully during evaluation.

If results show that it cannot be defined consistently from audio, the class definition should be narrowed rather than forcing the model to learn an ambiguous concept.

---

# 7. Fire

### Intended examples

```text
active fire crackling
burning wood
sustained combustion-like acoustic patterns
```

### Hard negatives

```text
rain
static
dry leaves
frying-like noise
plastic crackling
paper crumpling
electrical noise
```

Fire detection from audio alone may be difficult.

Therefore this class should only remain if evaluation proves that its signal is sufficiently discriminative.

---

# 8. Vehicle

### Include

```text
cars
motorcycles
trucks
tractors
off-road vehicles
engine activity
```

### Hard negatives

```text
chainsaw
generator
machinery
power tools
other small engines
```

Vehicle is particularly important because vehicle/engine sounds can become chainsaw false positives.

---

# 9. Recommended Model Output

The long-term classifier should not force exactly one class.

Real forest audio can contain:

```text
rain + chainsaw
vehicle + chainsaw
fire + vehicle
wind + gunfire
```

Therefore the preferred future formulation is **multi-label detection**.

Example:

```text
Gunfire             0.03
Chainsaw            0.91
Metal Tool Activity 0.07
Fire                0.02
Vehicle             0.48
```

Each class should eventually have its own threshold.

Conceptually:

```text
score(class) > threshold(class)
        ↓
class detected
```

rather than:

```text
pick exactly one class
```

---

# 10. Existing Confidence Logic

The current browser application pools relevant AudioSet scores into ARANYA categories, may add reduced-weight supporting classes, normalizes the results, and selects the highest category.

The current displayed confidence:

- is not calibrated probability,
- is not model accuracy,
- is capped at approximately 0.97.

Therefore never report:

```text
Confidence = 94%
therefore accuracy = 94%
```

Correct interpretation:

```text
94% = current baseline scoring value
```

Actual model performance must come from labelled evaluation data.

---

# 11. AI/ML Repository

The current ML workspace is:

```text
ml/
├── README.md
├── requirements.txt
├── configs/
│   └── experiment_v0.yaml
├── data/
│   ├── README.md
│   └── manifest.schema.json
├── src/
│   ├── audio_windows.py
│   ├── baseline_mapping.py
│   ├── classifiers.py
│   ├── evaluation.py
│   ├── manifest.py
│   ├── metrics.py
│   └── yamnet_embeddings.py
├── scripts/
│   ├── benchmark_latency.py
│   ├── create_grouped_splits.py
│   ├── evaluate_models.py
│   ├── extract_embeddings.py
│   ├── train_logistic.py
│   ├── train_mlp.py
│   └── validate_manifest.py
└── tests/
    ├── test_group_split.py
    ├── test_manifest.py
    └── test_metrics.py
```



The scaffolding has already passed its initial ten unit tests.

No dataset was downloaded and no ARANYA-specific model was trained at that stage.

---

# 12. AI/ML Development Sequence

Follow this order.

Do not skip directly to neural-network training.

```text
STEP 1
Finalize class definitions
        ↓
STEP 2
Inventory existing audio
        ↓
STEP 3
Create dataset manifest
        ↓
STEP 4
Validate manifest
        ↓
STEP 5
Collect missing target data
        ↓
STEP 6
Collect long background / hard-negative recordings
        ↓
STEP 7
Dataset audit
        ↓
STEP 8
Leakage-safe grouped split
        ↓
STEP 9
Freeze test set
        ↓
STEP 10
Evaluate current YAMNet baseline
        ↓
STEP 11
Extract YAMNet embeddings
        ↓
STEP 12
Train Logistic Regression
        ↓
STEP 13
Evaluate Logistic Regression
        ↓
STEP 14
Train small MLP
        ↓
STEP 15
Compare all models
        ↓
STEP 16
Event-level evaluation
        ↓
STEP 17
Error analysis
        ↓
STEP 18
Collect hard negatives
        ↓
STEP 19
Retrain
        ↓
STEP 20
Select ARANYA ML v1
        ↓
STEP 21
Design compact edge model
        ↓
STEP 22
Quantize to INT8
        ↓
STEP 23
ESP32-S3 testing
```

---

# 13. Step 1 — Class Definitions

Current status:

**Done conceptually.**

Official target classes:

```text
gunfire
chainsaw
metal_tool_activity
fire
vehicle
```

Plus:

```text
background
```

for training/evaluation negatives.

Before labelling large amounts of data, create one authoritative label-definition file.

Recommended:

```text
ml/data/class_definitions.md
```

It should define:

```text
class name
definition
included examples
excluded examples
hard negatives
ambiguous cases
labeling rules
```

---

# 14. Step 2 — Existing Audio Inventory

Before downloading datasets or training models, inspect all recordings already available.

The project handoff already defines dataset inventory as the immediate next step.

For every recording capture:

```text
file_path
recording_id
session_id
label
duration
sample_rate
channels
device
microphone
source
environment
location_group
distance
weather
license/provenance
notes
```

Unknown values should be explicitly marked unknown.

Do not guess them.

---

# 15. Step 3 — Manifest

Create:

```text
ml/data/manifest.csv
```

The manifest should become the source of truth.

Recommended columns:

```text
file_path
recording_id
session_id
source_id
label
background_subtype
device_id
microphone_model
sample_rate
channels
duration_seconds
distance_m
environment
weather
source_dataset
license
split
quality_status
notes
```

Do not rely only on directory names.

---

# 16. Step 4 — Manifest Validation

Use:

```text
python -B ml/scripts/validate_manifest.py --manifest ml/data/manifest.csv
```

The validator should catch:

```text
invalid labels
missing files
missing IDs
bad metadata
duplicate rows
invalid split values
unknown provenance
```

---

# 17. Step 5 — Dataset Collection

The project specifically recognizes that team-recorded audio is important because it represents:

```text
intended microphone
outdoor conditions
local noise
distance
weather
relevant machinery
```



Collect recordings across:

```text
multiple distances
multiple locations
multiple sessions
different source orientations
different weather
different devices where practical
different background conditions
```

Do not focus only on clip count.

The number of independent sessions is more important than producing thousands of windows from a few recordings.

---

# 18. Step 6 — Background and Hard Negatives

Collect long recordings of:

```text
forest ambience
birds
animals
wind
rain
speech
footsteps
vehicles
machinery
generators
motorcycles
metal impacts
human activity
insects
other environmental sound
```

Aim for continuous recordings where no target occurs.

These are needed for:

```text
false positives / hour
```

The project's planned evaluation already identifies false positives/hour as a critical metric.

---

# 19. Step 7 — Dataset Audit

Before training, check for hidden shortcuts.

Example bad dataset:

```text
all gunfire = public MP3 files
all chainsaws = YouTube
all background = team-recorded WAV
```

The model could learn:

```text
dataset source
```

instead of:

```text
acoustic event
```

Audit:

```text
class × source
class × session
class × device
class × environment
class × microphone
class × sample rate
```

Also inspect class duration and distance distributions.

---

# 20. Step 8 — Leakage-Safe Split

Never do:

```text
one recording
        ↓
hundreds of overlapping windows
        ↓
random train/test split
```

The current project explicitly rejects this because nearly identical windows can leak between train and test.

Correct procedure:

```text
Original recording/session
        ↓
Group by source/session
        ↓
Train / validation / test
        ↓
Generate windows
```

Initial split:

```text
Train       70%
Validation  15%
Test        15%
```

The exact percentages are less important than maintaining independence.

---

# 21. Step 9 — Freeze Test Set

After splitting:

```text
TRAIN
used to fit models

VALIDATION
used for thresholds and model selection

TEST
used only after development decisions are complete
```

The current project specifically states that the final test set should remain untouched until model selection is finished.

---

# 22. Step 10 — Measure Current YAMNet Baseline

Model A:

```text
Audio
 ↓
YAMNet
 ↓
521 AudioSet scores
 ↓
Existing ARANYA mapping
```

Measure it before changing the model.

Metrics:

```text
macro precision
macro recall
macro F1
per-class precision
per-class recall
confusion matrix
false positives/hour
detection latency
```

This becomes:

```text
BASELINE A
```

Everything later must be compared against it.

---

# 23. Step 11 — YAMNet Embeddings

Extract YAMNet's 1024-dimensional embeddings.

Existing files:

```text
ml/src/yamnet_embeddings.py
ml/scripts/extract_embeddings.py
```

The existing project specifically planned YAMNet embeddings as the next transfer-learning stage.

Pipeline:

```text
Audio
 ↓
YAMNet
 ↓
1024-D embedding
 ↓
ARANYA classifier
```

---

# 24. Step 12 — Logistic Regression

Train:

```text
YAMNet embeddings
        ↓
Logistic Regression
```

Use:

```text
ml/scripts/train_logistic.py
```

This becomes:

```text
MODEL B
```

Logistic Regression should be the first custom classifier because it is:

```text
simple
fast
easy to inspect
good baseline
```

If it performs strongly, a much more complex classifier may not be necessary.

---

# 25. Step 13 — Evaluate Logistic Regression

Compare:

```text
Model A
YAMNet + manual mapping

vs

Model B
YAMNet embedding + Logistic Regression
```

Use exactly the same dataset split and metrics.

Do not change the test set between models.

---

# 26. Step 14 — Small MLP

Train:

```text
YAMNet embedding
        ↓
small MLP
```

using:

```text
ml/scripts/train_mlp.py
```

This becomes:

```text
MODEL C
```

Do not assume the MLP wins just because it is more complex.

---

# 27. Step 15 — Model Comparison

Compare:

```text
MODEL A
YAMNet mapping

MODEL B
YAMNet + Logistic Regression

MODEL C
YAMNet + MLP
```

Metrics:

```text
Macro F1
Per-class recall
Per-class precision
False positives/hour
Detection latency
Inference latency
P50 latency
P95 latency
Model size
```

These metrics are already part of the project's evaluation plan.

---

# 28. Step 16 — Event-Level Evaluation

Frame accuracy alone is not enough.

Example:

```text
40-second chainsaw recording
```

The important result is:

```text
Did ARANYA detect it?
How quickly?
How many alerts were generated?
Was it one event or 20 duplicate events?
```

Evaluate:

```text
event recall
event precision
detection delay
duplicate alerts
event duration error
false event rate
```

The existing application already has temporal processing through:

```text
timelineSegmenter.ts
temporalAggregator.ts
streakLogic.ts
```



Therefore ML evaluation should eventually include the complete detector pipeline, not only frame predictions.

---

# 29. Step 17 — Error Analysis

For every important failure record:

```text
audio file
ground truth
prediction
score
model version
source
environment
device
distance
failure reason
```

Categorize failures:

```text
wind false positive
vehicle/chainsaw confusion
fire/rain confusion
metal/machinery confusion
gunfire/impact confusion
low-SNR miss
distance-related miss
microphone clipping
annotation problem
```

Then decide whether the solution is:

```text
more data
better labels
hard negatives
threshold change
temporal rule change
model change
hardware change
```

---

# 30. Step 18 — Hard-Negative Mining

If chainsaw is confused with motorcycles:

Collect:

```text
motorcycles
generators
small engines
tractors
brush cutters
```

If Gunfire is confused with impacts:

Collect:

```text
metal impacts
wood impacts
firecrackers
doors
construction
thunder
```

If Fire is confused with rain:

Collect:

```text
light rain
heavy rain
dry leaves
plastic crackle
paper crackle
static-like noise
```

Training should become an iterative loop:

```text
TRAIN
 ↓
EVALUATE
 ↓
FIND FAILURES
 ↓
COLLECT HARD CASES
 ↓
RETRAIN
```

---

# 31. Step 19 — Select ARANYA ML v1

After comparison and error analysis, choose the best domain classifier.

Example documentation format:

```text
ARANYA-ML-v1

Feature extractor:
YAMNet

Classifier:
Logistic Regression

Target classes:
Gunfire
Chainsaw
Metal Tool Activity
Fire
Vehicle

Evaluation:
Macro F1 = ...
Gunfire recall = ...
Chainsaw recall = ...
False alerts/hour = ...
Latency = ...
```

Only at this stage should the project claim:

> ARANYA has a trained domain-specific classifier.

---

# 32. Step 20 — Edge Model

Do not attempt to put the existing browser TensorFlow.js YAMNet model directly onto ESP32-S3.

The intended future path should be:

```text
Raw audio
 ↓
Compact acoustic features
 ↓
Small edge model
 ↓
Threat scores
```

Possible architecture:

```text
log-mel spectrogram
        ↓
small CNN / DS-CNN
```

But the architecture should be selected based on:

```text
accuracy
false positives/hour
RAM
flash
latency
power
```

rather than assuming one network architecture is automatically best.

---

# 33. Step 21 — Sampling Rate

Current YAMNet requires 16 kHz, and the current browser pipeline uses 16 kHz audio.

For the future custom edge model, do not automatically assume 16 kHz is optimal.

Compare if resources allow:

```text
16 kHz
24 kHz
32 kHz
```

Then choose the lowest sampling rate that maintains acceptable performance.

---

# 34. Step 22 — Quantization

After selecting the edge model:

```text
Float model
 ↓
INT8 quantization
```

Evaluate again:

```text
precision
recall
F1
false positives/hour
model size
RAM
latency
```

If INT8 causes unacceptable degradation, investigate quantization-aware training.

---

# 35. Step 23 — Hardware Handoff

The AI/ML person must provide the hardware person with more than a model file.

Required handoff:

```text
model file
model version
input sample rate
input format
window length
hop length
feature extraction
normalization
output class order
class thresholds
temporal assumptions
expected latency
expected RAM
test vectors
expected output for each test vector
```

Example:

```text
Input:
16 kHz mono PCM

Window:
1.0 second

Outputs:
[gunfire,
 chainsaw,
 metal_tool_activity,
 fire,
 vehicle]

Thresholds:
gunfire = ...
chainsaw = ...
...
```

---

# 36. Interface With Person 2 — Hardware

AI/ML owns:

```text
model
features
thresholds
evaluation
```

Hardware owns:

```text
microphone
audio capture
ESP32
firmware
TFLite runtime
RAM
power
```

Both must jointly verify:

```text
Python preprocessing
≈
ESP32 preprocessing
```

A model trained with one preprocessing pipeline and deployed with a different one may fail badly.

---

# 37. Interface With Person 3 — Backend

AI/ML should define the detector output contract.

Example:

```text
event_type
raw_score
model_version
event_start
event_end
```

Backend owns:

```text
transmission
storage
deduplication
API
LoRaWAN
```

The ML person should not define networking implementation.

---

# 38. Interface With Person 4 — Frontend

Frontend should display ML information accurately.

Allowed:

```text
Detection score
Model version
Detection class
Human verification
```

Avoid wording like:

```text
97% accurate
```

unless accuracy actually comes from measured evaluation.

The current handoff explicitly distinguishes confidence from accuracy.

---

# 39. Files AI/ML Person Should Mainly Work In

Primary ownership:

```text
ml/
```

Important existing files:

```text
ml/data/manifest.csv
ml/data/manifest.schema.json

ml/src/audio_windows.py
ml/src/baseline_mapping.py
ml/src/classifiers.py
ml/src/evaluation.py
ml/src/manifest.py
ml/src/metrics.py
ml/src/yamnet_embeddings.py

ml/scripts/validate_manifest.py
ml/scripts/create_grouped_splits.py
ml/scripts/extract_embeddings.py
ml/scripts/train_logistic.py
ml/scripts/train_mlp.py
ml/scripts/evaluate_models.py
ml/scripts/benchmark_latency.py
```

These components already exist as part of the ML scaffolding.

---

# 40. Files That Should Not Be Changed Casually

Do not modify the current Round 1 browser application merely to support experiments.

The existing handoff specifically states that the working Round 1 dashboard and demo should not be unnecessarily modified while ML development occurs.

Especially avoid casually changing:

```text
src/services/audioClassifier.ts
src/services/models/audiosetMapping.ts
src/services/eventPipeline.ts
src/types/event.ts
```

unless you are intentionally modifying the production baseline and recording that change.

The baseline must remain reproducible.

---

# 41. Dataset Files That Should NOT Be Committed

Do not commit:

```text
raw audio
downloaded datasets
embeddings
training checkpoints
large generated artifacts
virtual environments
```

The current repository policy already separates manifests/provenance/code from raw datasets and generated ML artifacts.

Commit:

```text
manifest
schemas
class definitions
dataset provenance metadata
configs
training code
evaluation code
metrics
small reports
```

---

# 42. First Immediate Tasks

The AI/ML person should now do exactly this:

## Task 1

Create:

```text
ml/data/class_definitions.md
```

with:

```text
Gunfire
Chainsaw
Metal Tool Activity
Fire
Vehicle
Background
```

definitions and hard negatives.

---

## Task 2

Inventory every existing recording.

Output:

```text
ml/data/manifest.csv
```

---

## Task 3

Run:

```text
python -B ml/scripts/validate_manifest.py --manifest ml/data/manifest.csv
```

---

## Task 4

Create a dataset audit report:

```text
count per class
count per session
duration per class
source distribution
device distribution
missing metadata
```

---

## Task 5

Identify what data must still be collected.

Do not train before this point.

---

# 43. First Real Experiment

Once dataset quality is acceptable:

```text
MODEL A
Current YAMNet mapping
```

vs:

```text
MODEL B
YAMNet embeddings
+
Logistic Regression
```

This is the first meaningful ARANYA ML experiment.

Only after comparing those should the team train the MLP.

---

# 44. Definition of AI/ML Success

The AI/ML workstream is not successful because:

```text
the model produces high confidence
```

It is successful when the team can show:

```text
independent labelled test data
        ↓
measured performance
        ↓
low false-alert rate
        ↓
good target recall
        ↓
acceptable latency
        ↓
reproducible experiment
```

Required metrics:

```text
Macro precision
Macro recall
Macro F1
Per-class precision
Per-class recall
Confusion matrix
False positives/hour
Detection latency
Inference latency
Model size
```

The project's existing evaluation design already identifies these measurements.

---

# 45. Final AI/ML Story

The correct technical story is:

```text
Round 1
Pretrained YAMNet
+
manual AudioSet mapping
+
temporal processing
        ↓

Measured baseline
        ↓

Domain dataset
        ↓

YAMNet embeddings
+
ARANYA classifier
        ↓

Objective model comparison
        ↓

Error analysis
        ↓

Improved domain classifier
        ↓

Compact edge architecture
        ↓

INT8
        ↓

ESP32-S3 deployment
```

This follows the central progression already defined in the project handoff:

> working prototype → measured baseline → ARANYA-specific classifier → demonstrated improvement → edge deployment.

---

# 46. Current Status

### Completed

```text
Browser YAMNet prototype             ✅
Audio preprocessing                  ✅
YAMNet inference                     ✅
Current ARANYA mapping               ✅
Temporal processing                  ✅
ML workspace/scaffolding             ✅
Manifest infrastructure              ✅
Grouped-split infrastructure         ✅
Evaluation infrastructure            ✅
Initial unit tests                   ✅
Target class definitions             ✅
```

### Next

```text
Existing audio inventory             ⏭
Manifest population                  ⏭
Dataset audit                        ⏭
Additional data collection           ⏭
Grouped split                        ⏭
YAMNet baseline measurement          ⏭
```

### Not done yet

```text
Domain classifier trained            ❌
Logistic Regression evaluated        ❌
MLP evaluated                        ❌
Final ARANYA ML model selected       ❌
Tiny edge model                      ❌
INT8 model                           ❌
ESP32 deployment                     ❌
Field validation                     ❌
```

---

# 47. One-Line Handoff

**The AI/ML owner's job is to take ARANYA from a pretrained YAMNet + heuristic mapping prototype to a reproducibly evaluated, domain-trained five-target acoustic detector for Gunfire, Chainsaw, Metal Tool Activity, Fire and Vehicle, with strong background/hard-negative handling, event-level evaluation, and finally an edge-ready model for ESP32-S3.**