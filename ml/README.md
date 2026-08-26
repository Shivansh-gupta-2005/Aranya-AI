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

## Checks

```powershell
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest
```

See [dataset policy](../docs/ml/dataset-policy.md), [taxonomy](../docs/ml/taxonomy.md), and [evaluation protocol](../docs/ml/evaluation-protocol.md).
