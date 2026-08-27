# ARANYA ML Workspace

This package owns dataset validation, baseline evaluation, feature extraction helpers, classifiers, and model contract checks. It does not contain raw audio or a trained ARANYA model.

## Setup

From this directory:

```powershell
uv sync --locked --group dev
uv run aranya-ml validate-catalog --catalog datasets/v1
```

The project supports Python 3.11 and 3.12. The lockfile is the dependency source of truth.

## Catalog

`datasets/v1/` separates source licenses, recordings, target intervals, and frozen group splits. One recording may contain several target annotations. Unreviewed time is not a negative example.

The migrated catalog has 13 historical recordings and 10 target intervals. Every group is frozen in `legacy-v0` test. All recordings have `training_eligible=false` because they influenced prototype testing.

## Baselines

- A0 exactly mirrors the current browser mapping and normalizes across its eight current classes.
- A1 pools the five candidate targets independently. Background and context scores cannot suppress targets.
- B is planned one-vs-rest logistic regression on YAMNet embeddings.
- C is a planned small multi-output MLP on the same embeddings.

Training stops until the catalog contains approved training data. It must not invent results from the historical material.

## Pilot experiments

The pilot commands accept external manifests and keep generated artifacts under `work/`. They use five independent target outputs. Background rows become all-negative examples.

Audit a manifest before training:

```powershell
uv run aranya-ml audit-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --allow-provisional
```

Run the repaired windowed log-mel baselines:

```powershell
uv run aranya-ml train-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --output work/runs/repaired-logmel-logistic-v1 `
  --features logmel `
  --model logistic `
  --allow-provisional

uv run aranya-ml train-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --output work/runs/repaired-logmel-mlp-v1 `
  --features logmel `
  --model mlp `
  --allow-provisional
```

YAMNet embedding experiments require a local Python SavedModel:

```powershell
uv run aranya-ml train-pilot `
  --manifest work/derived/v2/pilot_manifest_fsd_domain.csv `
  --output work/runs/repaired-yamnet-logistic-v1 `
  --features yamnet `
  --yamnet-model work/models/yamnet-savedmodel `
  --model logistic `
  --allow-provisional
```

`--allow-provisional` marks the result as exploratory and release-ineligible. A pilot score is not field accuracy. Thresholds use validation data, and the test split remains untouched until final reporting.

Use `--threshold-metric f1` when the report target is macro F1. The default `f2` setting gives recall more weight and remains available for alert-oriented experiments:

```powershell
uv run aranya-ml train-pilot `
  --manifest work/derived/v2/fast_manifest.csv `
  --output work/runs/fast-yamnet-mlp-f1-v1 `
  --features yamnet `
  --yamnet-model work/models/yamnet-savedmodel `
  --model mlp `
  --threshold-metric f1
```

Thresholds are selected on validation rows only. They do not change the model weights.

## Checks

```powershell
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest
```

See [dataset policy](../docs/ml/dataset-policy.md), [taxonomy](../docs/ml/taxonomy.md), and [evaluation protocol](../docs/ml/evaluation-protocol.md).

For the full current data, training, edge export, and deployment guide, see [ARANYA ML system](../docs/ml/README.md). Completed experiment metrics are tracked in [results history](../docs/ml/results-history.md).
