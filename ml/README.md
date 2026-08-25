# Aranya AI ML Experiment Workspace

Python-side scaffolding for comparing the current browser YAMNet baseline with Aranya-specific classifiers. This workspace is separate from the React demonstration application.

## Experiment v0

Labels: `gunshot`, `chainsaw_logging`, `metal_tool_activity`, and `background`.
Background retains a required subtype: `forest_ambience`, `birds_animals`, `wind`, `rain`, `vehicles`, `machinery`, `human_movement`, `generic_impacts`, or `other_environmental_noise`.

The planned comparison uses the same recording-level grouped split for:

1. Current YAMNet predictions projected through the existing manual AudioSet mapping.
2. Logistic Regression on 1024-dimensional YAMNet embeddings.
3. A small MLP on 1024-dimensional YAMNet embeddings.

The approximately 60 independent recording groups per class is a target/reference, not a blocking requirement. Reports must state the actual group count, duration, class distribution, and limitations. No metrics or comparison claims exist until labelled data and real inference have been run.

## Baseline assumptions mirrored from the application

- Local YAMNet asset: `/models/yamnet/model.json` in the browser; Python extraction will require an equivalent local SavedModel or compatible export later.
- 16,000 Hz mono audio.
- 0.96 second YAMNet patch window and 0.48 second patch hop.
- 521 AudioSet scores and 1024-dimensional embeddings.
- `src/baseline_mapping.py` mirrors the current TypeScript mapping for evaluation only; it is not an Aranya-trained model.

The split occurs at recording-group level before fixed windows are generated, so windows from one source/session cannot cross train, validation, and test.

## Commands

```powershell
python -B ml/scripts/validate_manifest.py --manifest ml/data/manifest.csv --check-paths
python -B ml/scripts/create_grouped_splits.py --manifest ml/data/manifest.csv --output ml/data/manifest.split.csv
python -B -m unittest discover -s ml/tests
```

The extraction, training, evaluation, and latency scripts are explicit scaffolding entry points. They do not download, train, or fabricate results.
