# ML Training Repair Design

## Goal

Build an auditable multi-label training and evaluation path for the five ARANYA targets. Use the available pilot data for exploratory runs. Keep human review, field data collection, and release approval as explicit gates.

## Scope

This change will:

- replace the experimental six-class trainer with five independent target outputs;
- treat background recordings as all-negative examples;
- preserve multi-label source annotations where they map to several ARANYA targets;
- extract time-localized features instead of one raw log-mel summary per complete recording;
- train one-vs-rest logistic and small MLP baselines;
- choose one threshold per class on validation data;
- report per-class and macro metrics on the untouched test split;
- audit split overlap, class support, source composition, and review status;
- save generated features, models, and reports only under ignored `ml/work/` paths;
- run exploratory training with current provisional data when explicitly allowed.

This change cannot complete human audio review or create new independent field recordings. Reports produced from provisional data must remain marked exploratory and release-ineligible.

## Target formulation

The target vector has this fixed order:

```text
gunfire
chainsaw
metal_tool_activity
fire
vehicle
```

Each recording or feature window receives a five-value binary target vector. More than one value may be positive. A verified background row has five zeroes. `background` is never a model output.

FSD50K source labels map to all matching ARANYA targets. The importer no longer selects the first matching class. Labels outside the five targets remain context metadata. Rows with uncertain or incomplete coverage are excluded by default.

## Data gates and splits

The manifest loader accepts the current pilot CSV schema. It validates required fields, paths, split names, and target labels. It also checks that each `recording_group_id` belongs to exactly one split in the selected rows.

Training uses only rows with `training_eligible=true`. Exploratory runs may add provisional rows through an explicit CLI flag. Validation and test rows are never added to training, even when a flag is present.

The audit reports row and independent-group support by class, split, and source. A release-eligible run requires at least 100 positive independent test groups per promoted class. Exploratory runs continue with warnings so the current data can still measure engineering progress.

The existing test split stays untouched. Thresholds and model choices use validation data only.

## Features

The primary feature path uses YAMNet 1024-dimensional embeddings at its fixed 16 kHz input rate and 0.96-second frame window. The extractor accepts a local TensorFlow SavedModel path. It does not fetch code or models during training.

For each recording, the extractor preserves frame embeddings. Clip-level training aggregates frame embeddings with mean and maximum pooling. This produces a fixed 2048-dimensional vector while retaining short high-energy events better than mean-only pooling.

The fallback feature path uses 64-bin log-mel frames with the same 0.96-second window and 0.48-second hop. It aggregates frame statistics with mean, standard deviation, and maximum. This produces a reproducible baseline when a Python YAMNet SavedModel is unavailable.

Feature caches include a fingerprint of the manifest rows, feature configuration, and source file metadata. A changed manifest or configuration cannot silently reuse stale features.

## Models

Model B is one-vs-rest logistic regression with one classifier per target. Each classifier uses balanced class weights. Features are standardized inside the saved pipeline.

Model C is a small multi-output MLP. Training uses per-output sample weights through independent binary MLP estimators when the installed scikit-learn interface cannot apply a matrix of class weights to one estimator. Each output therefore receives balanced positive and negative weights.

Both models expose a score matrix shaped `[examples, 5]`. Model files store the target order and feature configuration beside the estimator.

## Threshold selection

Each class receives an independent threshold. The selector searches validation scores from 0.05 through 0.95. It chooses the threshold with the highest F2. Ties choose the higher precision, then the higher threshold.

When validation contains no positive examples for a class, training fails for that class. The test split never influences threshold selection.

## Evaluation

The report includes:

- row and independent-group counts by split, source, and class;
- per-class precision, recall, F1, F2, PR-AUC, support, and threshold;
- macro precision, recall, F1, and F2;
- micro F1 and subset accuracy;
- a binary confusion matrix for each target;
- train, validation, and test results;
- feature configuration, model configuration, seed, and data fingerprint;
- review-status warnings and release eligibility.

The exploratory comparison uses the same selected rows and frozen test split for every model. It compares the existing log-mel result, repaired log-mel logistic model, repaired log-mel MLP, and YAMNet models when a local SavedModel is available.

Event-level false alerts per hour remain blocked until interval annotations or verified target-free background durations exist. The report states this instead of deriving an invalid event metric from clip-level labels.

## CLI and files

The package gains these responsibilities:

- `aranya_ml.data.pilot_manifest`: load, map, validate, audit, and fingerprint pilot rows;
- `aranya_ml.features.logmel`: extract windowed log-mel aggregate features;
- `aranya_ml.features.yamnet`: extract and pool frame embeddings from a local SavedModel;
- `aranya_ml.models.classifiers`: fit balanced independent classifiers and return five scores;
- `aranya_ml.evaluation.multilabel`: select thresholds and calculate multi-label metrics;
- `aranya_ml.training.experiment`: coordinate data selection, caching, training, evaluation, and artifact writing;
- `aranya_ml.cli.main`: expose `audit-pilot` and `train-pilot` commands.

The CLI shape is:

```text
aranya-ml audit-pilot --manifest PATH
aranya-ml train-pilot --manifest PATH --output PATH --features logmel --model logistic --allow-provisional
aranya-ml train-pilot --manifest PATH --output PATH --features yamnet --yamnet-model PATH --model mlp --allow-provisional
```

The experiment command refuses to overwrite an output directory containing a different data fingerprint. A matching run may reuse its feature cache.

## Testing

Tests cover:

- multi-label mapping and all-negative background targets;
- rejection of group overlap and invalid rows;
- support and review-status audit output;
- deterministic manifest fingerprints;
- log-mel feature shape and short-event maximum pooling;
- YAMNet output shape validation and pooling without loading TensorFlow in unit tests;
- balanced independent classifier score shape;
- validation-only threshold selection and tie-breaking;
- per-class and macro multi-label metrics;
- stale-cache rejection;
- CLI success and failure paths;
- an end-to-end synthetic experiment with no network or large model dependency.

The final verification runs Ruff, Ruff formatting, Pyright, Pytest, the pilot audit, and each feasible exploratory training comparison. Web checks run as a regression guard because shared contracts must remain unchanged.

## Success criteria

The engineering work is complete when:

- the tracked package owns the repaired pipeline;
- all automated checks pass;
- train, validation, and test groups do not overlap;
- the test split remains untouched by threshold and model selection;
- exploratory results are reproducible from one command;
- reports cannot present provisional data as release-ready;
- every model comparison uses the same selected rows;
- the best available model and remaining data blockers are reported with evidence.

No macro-F1 target is guaranteed. A high score counts only when every class has adequate independent test support and the field false-alert budget is met.
