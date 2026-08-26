# ML Training Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a reproducible five-target multi-label training pipeline that fixes label competition, weak feature pooling, imbalance, unsafe caches, and misleading evaluation.

**Architecture:** A pilot-manifest adapter produces validated rows and five-value targets. Feature backends produce fixed vectors, independent binary classifiers produce target scores, and validation-selected thresholds feed one shared evaluator. The CLI coordinates audits and experiments while generated artifacts stay under `ml/work/`.

**Tech Stack:** Python 3.11 or 3.12, NumPy, Librosa, scikit-learn, joblib, Pytest, Ruff, Pyright, optional TensorFlow 2.19.

**Spec:** `docs/superpowers/specs/2026-08-26-ml-training-repair-design.md`

## Global Constraints

- Target order is exactly `gunfire`, `chainsaw`, `metal_tool_activity`, `fire`, `vehicle`.
- Background is an all-zero target vector and never a model output.
- Threshold and model selection use validation data only.
- Test rows never enter training or threshold selection.
- Generated features, models, and reports stay under ignored `ml/work/` paths.
- Provisional data requires an explicit exploratory flag and makes the run release-ineligible.
- No network access occurs inside the training command.
- Use the frozen dependency versions in `ml/uv.lock`.

---

### Task 1: Pilot manifest labels and audit

**Files:**
- Create: `ml/src/aranya_ml/data/pilot_manifest.py`
- Create: `ml/tests/test_pilot_manifest.py`

**Interfaces:**
- Produces: `TARGET_ORDER: tuple[str, ...]`
- Produces: `PilotRow` dataclass with manifest metadata and `targets: tuple[int, ...]`
- Produces: `load_pilot_manifest(path: Path, allow_provisional: bool) -> list[PilotRow]`
- Produces: `validate_split_groups(rows: Sequence[PilotRow]) -> list[str]`
- Produces: `audit_pilot_rows(rows: Sequence[PilotRow]) -> dict[str, object]`
- Produces: `pilot_fingerprint(rows: Sequence[PilotRow]) -> str`

- [ ] **Step 1: Write failing label mapping tests**

```python
def test_fsd_labels_preserve_multiple_targets(tmp_path: Path) -> None:
    path = write_manifest(
        tmp_path,
        class_id="gunfire",
        source_id="fsd50k",
        source_labels="Gunshot_and_gunfire,Vehicle",
        training_eligible="True",
    )
    row = load_pilot_manifest(path, allow_provisional=False)[0]
    assert row.targets == (1, 0, 0, 0, 1)


def test_background_has_no_positive_target(tmp_path: Path) -> None:
    path = write_manifest(tmp_path, class_id="background", source_labels="Rain")
    row = load_pilot_manifest(path, allow_provisional=False)[0]
    assert row.targets == (0, 0, 0, 0, 0)


def test_repo_relative_audio_path_resolves_from_nested_manifest(tmp_path: Path) -> None:
    audio = write_audio(tmp_path / "ml" / "work" / "audio.wav")
    manifest = write_manifest_at(
        tmp_path / "ml" / "work" / "derived" / "pilot.csv",
        path="ml/work/audio.wav",
    )
    assert load_pilot_manifest(manifest, allow_provisional=False)[0].path == audio
```

- [ ] **Step 2: Run label tests and verify import failure**

Run: `cd ml; uv run pytest tests/test_pilot_manifest.py -v`

Expected: FAIL because `aranya_ml.data.pilot_manifest` does not exist.

- [ ] **Step 3: Implement row parsing and multi-label mapping**

Implement `PilotRow` as a frozen dataclass. Parse FSD50K `source_labels` against explicit sets for all five targets. Use `class_id` for sources without multi-label metadata. Map `background` to all zeroes. Resolve relative audio paths against the current directory and each manifest ancestor, which supports the existing `ml/work/...` entries. Reject unknown class IDs and missing files.

- [ ] **Step 4: Run label tests and verify they pass**

Run: `cd ml; uv run pytest tests/test_pilot_manifest.py -v`

Expected: PASS for label mapping tests.

- [ ] **Step 5: Write failing split and audit tests**

```python
def test_group_cannot_cross_splits(tmp_path: Path) -> None:
    rows = [make_row("a", "group-1", "train"), make_row("b", "group-1", "test")]
    assert validate_split_groups(rows) == [
        "recording group group-1 crosses splits: test, train"
    ]


def test_audit_counts_positive_groups_and_release_gate() -> None:
    audit = audit_pilot_rows([make_row("a", "group-1", "test", targets=(1, 0, 0, 0, 0))])
    assert audit["positive_groups"]["test"]["gunfire"] == 1
    assert audit["release_eligible"] is False
```

- [ ] **Step 6: Run audit tests and verify expected failures**

Run: `cd ml; uv run pytest tests/test_pilot_manifest.py -v`

Expected: FAIL because split validation and audit output are incomplete.

- [ ] **Step 7: Implement split validation, audit, and fingerprint**

Build deterministic JSON from sorted row IDs, groups, splits, targets, review fields, path, size, and modification time. Hash it with SHA-256. Audit row and group counts by source, class, and split. Require 100 independent positive test groups per promoted class for release eligibility.

- [ ] **Step 8: Run Task 1 tests**

Run: `cd ml; uv run pytest tests/test_pilot_manifest.py -v`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```powershell
git add ml/src/aranya_ml/data/pilot_manifest.py ml/tests/test_pilot_manifest.py
git commit -m "feat: validate pilot multi-label data"
```

### Task 2: Multi-label thresholds and metrics

**Files:**
- Create: `ml/src/aranya_ml/evaluation/multilabel.py`
- Create: `ml/tests/test_multilabel_metrics.py`

**Interfaces:**
- Consumes: `TARGET_ORDER`
- Produces: `select_f2_thresholds(y_true: np.ndarray, scores: np.ndarray, grid: Sequence[float] | None = None) -> np.ndarray`
- Produces: `evaluate_multilabel(y_true: np.ndarray, scores: np.ndarray, thresholds: np.ndarray, target_names: Sequence[str] = TARGET_ORDER) -> dict[str, object]`

- [ ] **Step 1: Write failing threshold tests**

```python
def test_threshold_selection_uses_each_target_independently() -> None:
    truth = np.array([[1, 0], [1, 0], [0, 1], [0, 1]])
    scores = np.array([[0.8, 0.1], [0.6, 0.2], [0.4, 0.9], [0.3, 0.7]])
    thresholds = select_f2_thresholds(truth, scores, grid=(0.5, 0.75))
    assert thresholds.tolist() == [0.5, 0.5]


def test_threshold_selection_rejects_class_without_positives() -> None:
    with pytest.raises(ValueError, match="target 1 has no positive validation examples"):
        select_f2_thresholds(np.array([[1, 0], [0, 0]]), np.array([[0.8, 0.2], [0.1, 0.3]]))
```

- [ ] **Step 2: Run threshold tests and verify import failure**

Run: `cd ml; uv run pytest tests/test_multilabel_metrics.py -v`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement validation-only threshold search**

Search 0.05 through 0.95 in 0.05 steps by default. Rank candidates by F2, precision, then threshold. Return one threshold per score column.

- [ ] **Step 4: Run threshold tests and verify they pass**

Run: `cd ml; uv run pytest tests/test_multilabel_metrics.py -v`

Expected: PASS for threshold tests.

- [ ] **Step 5: Write failing metric tests**

```python
def test_multilabel_report_contains_per_target_and_macro_metrics() -> None:
    truth = np.array([[1, 0], [0, 1], [1, 1]])
    scores = np.array([[0.9, 0.1], [0.2, 0.8], [0.7, 0.6]])
    result = evaluate_multilabel(truth, scores, np.array([0.5, 0.5]), target_names=("a", "b"))
    assert result["macro_f1"] == 1.0
    assert result["per_class"]["a"]["pr_auc"] == 1.0
    assert result["per_class"]["b"]["confusion_matrix"] == [[1, 0], [0, 2]]
```

- [ ] **Step 6: Run metric tests and verify expected failure**

Run: `cd ml; uv run pytest tests/test_multilabel_metrics.py -v`

Expected: FAIL because the report fields are incomplete.

- [ ] **Step 7: Implement multi-label evaluation**

Use scikit-learn metric primitives. Report precision, recall, F1, F2, average precision as PR-AUC, support, threshold, and binary confusion matrix per target. Report macro and micro summaries plus subset accuracy.

- [ ] **Step 8: Run Task 2 tests**

Run: `cd ml; uv run pytest tests/test_multilabel_metrics.py -v`

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```powershell
git add ml/src/aranya_ml/evaluation/multilabel.py ml/tests/test_multilabel_metrics.py
git commit -m "feat: evaluate independent target scores"
```

### Task 3: Windowed features and safe caches

**Files:**
- Create: `ml/src/aranya_ml/features/logmel.py`
- Modify: `ml/src/aranya_ml/features/yamnet.py`
- Create: `ml/src/aranya_ml/features/cache.py`
- Create: `ml/tests/test_logmel_features.py`
- Create: `ml/tests/test_yamnet_features.py`
- Create: `ml/tests/test_feature_cache.py`

**Interfaces:**
- Produces: `LogMelConfig` frozen dataclass
- Produces: `extract_logmel_summary(path: Path, config: LogMelConfig = LogMelConfig()) -> np.ndarray`
- Produces: `pool_embedding_frames(frames: Any) -> np.ndarray`
- Produces: `load_feature_cache(path: Path, fingerprint: str, config: Mapping[str, object]) -> tuple[np.ndarray, np.ndarray, list[str]] | None`
- Produces: `save_feature_cache(...) -> None`

- [ ] **Step 1: Write failing log-mel pooling tests**

```python
def test_logmel_summary_has_mean_standard_deviation_and_maximum(tmp_path: Path) -> None:
    path = write_tone_with_short_burst(tmp_path)
    result = extract_logmel_summary(path)
    assert result.shape == (192,)
    mean, deviation, maximum = np.split(result, 3)
    assert np.all(maximum >= mean)
    assert np.any(maximum > mean + deviation)
```

- [ ] **Step 2: Run log-mel test and verify import failure**

Run: `cd ml; uv run pytest tests/test_logmel_features.py -v`

Expected: FAIL because `features.logmel` does not exist.

- [ ] **Step 3: Implement windowed log-mel summary**

Load mono 16 kHz audio. Compute a 64-bin log-mel spectrogram with 512-point FFT and 256-sample hop. Aggregate each mel bin with mean, standard deviation, and maximum. Return float32.

- [ ] **Step 4: Run log-mel test and verify it passes**

Run: `cd ml; uv run pytest tests/test_logmel_features.py -v`

Expected: PASS.

- [ ] **Step 5: Write failing YAMNet pooling and cache tests**

```python
def test_embedding_pool_preserves_frame_maximum() -> None:
    frames = np.vstack([np.zeros((1, 1024)), np.ones((1, 1024))])
    pooled = pool_embedding_frames(frames)
    assert pooled.shape == (2048,)
    assert np.allclose(pooled[:1024], 0.5)
    assert np.allclose(pooled[1024:], 1.0)


def test_cache_rejects_changed_fingerprint(tmp_path: Path) -> None:
    path = tmp_path / "features.npz"
    save_feature_cache(path, "old", {"kind": "logmel"}, np.ones((1, 3)), np.ones((1, 5)), ["r1"])
    assert load_feature_cache(path, "new", {"kind": "logmel"}) is None
```

- [ ] **Step 6: Run pooling and cache tests and verify expected failures**

Run: `cd ml; uv run pytest tests/test_yamnet_features.py tests/test_feature_cache.py -v`

Expected: FAIL because maximum pooling and cache metadata are missing.

- [ ] **Step 7: Implement YAMNet pooling and fingerprinted NPZ cache**

Keep TensorFlow imports deferred. Validate frame width 1024. Concatenate frame mean and maximum. Store fingerprint and canonical JSON config in each NPZ cache. Return `None` for metadata mismatch.

- [ ] **Step 8: Run Task 3 tests**

Run: `cd ml; uv run pytest tests/test_logmel_features.py tests/test_yamnet_features.py tests/test_feature_cache.py -v`

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add ml/src/aranya_ml/features ml/tests/test_logmel_features.py ml/tests/test_yamnet_features.py ml/tests/test_feature_cache.py
git commit -m "feat: add windowed feature backends"
```

### Task 4: Balanced independent classifiers

**Files:**
- Modify: `ml/src/aranya_ml/models/classifiers.py`
- Modify: `ml/tests/test_classifiers.py`

**Interfaces:**
- Produces: `fit_independent_logistic(features: Any, targets: Any, seed: int = 20260826) -> IndependentTargetClassifier`
- Produces: `fit_independent_mlp(features: Any, targets: Any, seed: int = 20260826) -> IndependentTargetClassifier`
- `IndependentTargetClassifier.predict_proba(features: Any) -> np.ndarray`

- [ ] **Step 1: Write failing independent-classifier tests**

```python
@pytest.mark.parametrize("trainer", [fit_independent_logistic, fit_independent_mlp])
def test_independent_classifier_returns_five_scores(trainer) -> None:
    features, targets = separable_five_target_data()
    model = trainer(features, targets)
    scores = model.predict_proba(features[:3])
    assert scores.shape == (3, 5)
    assert np.all((scores >= 0.0) & (scores <= 1.0))


def test_independent_classifier_rejects_constant_target() -> None:
    features = np.arange(20, dtype=float).reshape(10, 2)
    targets = np.zeros((10, 5), dtype=int)
    with pytest.raises(ValueError, match="target 0 needs positive and negative training examples"):
        fit_independent_logistic(features, targets)
```

- [ ] **Step 2: Run classifier tests and verify expected failures**

Run: `cd ml; uv run pytest tests/test_classifiers.py -v`

Expected: FAIL because the new trainers and wrapper do not exist.

- [ ] **Step 3: Implement independent balanced logistic models**

Fit one standardized `LogisticRegression(class_weight="balanced", max_iter=1000)` pipeline per target. Preserve target column order. Stack each positive-class probability.

- [ ] **Step 4: Implement independent balanced MLP models**

Fit one scaler and one `MLPClassifier(hidden_layer_sizes=(128, 64), early_stopping=True, max_iter=300)` per target. Compute balanced sample weights for each binary target column and pass them to that target's estimator. Keep each target estimator independent.

- [ ] **Step 5: Run Task 4 tests**

Run: `cd ml; uv run pytest tests/test_classifiers.py -v`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add ml/src/aranya_ml/models/classifiers.py ml/tests/test_classifiers.py
git commit -m "feat: balance independent target models"
```

### Task 5: Experiment orchestration and artifacts

**Files:**
- Create: `ml/src/aranya_ml/training/__init__.py`
- Create: `ml/src/aranya_ml/training/experiment.py`
- Create: `ml/tests/test_experiment.py`

**Interfaces:**
- Consumes: manifest, feature, classifier, threshold, metric, and cache interfaces from Tasks 1 through 4
- Produces: `ExperimentConfig` frozen dataclass
- Produces: `run_experiment(config: ExperimentConfig) -> dict[str, object]`

- [ ] **Step 1: Write failing synthetic experiment test**

```python
def test_experiment_uses_validation_thresholds_and_writes_artifacts(tmp_path: Path) -> None:
    manifest = write_synthetic_audio_manifest(tmp_path)
    output = tmp_path / "run"
    report = run_experiment(
        ExperimentConfig(
            manifest=manifest,
            output=output,
            feature_kind="logmel",
            model_kind="logistic",
            allow_provisional=True,
            seed=7,
        )
    )
    assert report["data"]["release_eligible"] is False
    assert report["threshold_source"] == "validation"
    assert (output / "metrics.json").exists()
    assert (output / "model.joblib").exists()
    assert (output / "features.npz").exists()
```

- [ ] **Step 2: Run experiment test and verify import failure**

Run: `cd ml; uv run pytest tests/test_experiment.py -v`

Expected: FAIL because the training package does not exist.

- [ ] **Step 3: Implement deterministic row selection and extraction**

Select validated rows. Keep every validation and test row. Include training rows only when eligible or explicitly provisional. Build masks from row splits. Extract or load features using the manifest fingerprint and feature config.

- [ ] **Step 4: Implement model fitting, threshold selection, and reports**

Fit only on the training mask. Select thresholds only on validation scores. Evaluate train, validation, and test. Save model, metrics, audit, config, target order, and fingerprint. Refuse output reuse when existing metadata has a different fingerprint.

- [ ] **Step 5: Run experiment test and verify it passes**

Run: `cd ml; uv run pytest tests/test_experiment.py -v`

Expected: PASS.

- [ ] **Step 6: Run all ML tests**

Run: `cd ml; uv run pytest -q`

Expected: PASS with no failures.

- [ ] **Step 7: Commit Task 5**

```powershell
git add ml/src/aranya_ml/training ml/tests/test_experiment.py
git commit -m "feat: run reproducible ML experiments"
```

### Task 6: CLI, audits, and exploratory comparison

**Files:**
- Modify: `ml/src/aranya_ml/cli/main.py`
- Modify: `ml/tests/test_cli.py`
- Modify: `ml/README.md`

**Interfaces:**
- Produces: `aranya-ml audit-pilot --manifest PATH [--allow-provisional]`
- Produces: `aranya-ml train-pilot --manifest PATH --output PATH --features {logmel,yamnet} --model {logistic,mlp} [--yamnet-model PATH] [--allow-provisional]`

- [ ] **Step 1: Write failing CLI tests**

```python
def test_audit_pilot_prints_release_gate(tmp_path: Path, capsys) -> None:
    manifest = write_cli_manifest(tmp_path)
    code = main(["audit-pilot", "--manifest", str(manifest), "--allow-provisional"])
    assert code == 0
    assert '"release_eligible": false' in capsys.readouterr().out


def test_train_pilot_requires_yamnet_model_path(tmp_path: Path, capsys) -> None:
    manifest = write_cli_manifest(tmp_path)
    code = main([
        "train-pilot", "--manifest", str(manifest), "--output", str(tmp_path / "run"),
        "--features", "yamnet", "--model", "logistic",
    ])
    assert code == 2
    assert "--yamnet-model is required" in capsys.readouterr().err
```

- [ ] **Step 2: Run CLI tests and verify parser failures**

Run: `cd ml; uv run pytest tests/test_cli.py -v`

Expected: FAIL because the subcommands do not exist.

- [ ] **Step 3: Implement CLI handlers and JSON output**

Return 0 on successful audit or experiment. Return 1 for invalid data and 2 for invalid command combinations. Serialize audit and concise result summaries as JSON.

- [ ] **Step 4: Document exact exploratory commands and caveats**

Add commands for audit, repaired log-mel logistic, repaired log-mel MLP, and optional local YAMNet SavedModel runs. State that provisional pilot results are not field accuracy.

- [ ] **Step 5: Run CLI tests and ML quality gates**

```powershell
cd ml
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest -q
```

Expected: every command exits 0.

- [ ] **Step 6: Run pilot audit**

```powershell
cd ml
uv run aranya-ml audit-pilot --manifest work/derived/v2/pilot_manifest_fsd_domain.csv --allow-provisional
```

Expected: valid JSON, no selected group overlap, release eligibility false, and low chainsaw test support reported.

- [ ] **Step 7: Run repaired log-mel comparisons**

```powershell
cd ml
uv run aranya-ml train-pilot --manifest work/derived/v2/pilot_manifest_fsd_domain.csv --output work/runs/repaired-logmel-logistic-v1 --features logmel --model logistic --allow-provisional
uv run aranya-ml train-pilot --manifest work/derived/v2/pilot_manifest_fsd_domain.csv --output work/runs/repaired-logmel-mlp-v1 --features logmel --model mlp --allow-provisional
```

Expected: each command writes a fingerprinted model, feature cache, and metrics report.

- [ ] **Step 8: Run YAMNet comparisons when a local SavedModel is available**

```powershell
cd ml
uv run aranya-ml train-pilot --manifest work/derived/v2/pilot_manifest_fsd_domain.csv --output work/runs/repaired-yamnet-logistic-v1 --features yamnet --yamnet-model work/models/yamnet-savedmodel --model logistic --allow-provisional
uv run aranya-ml train-pilot --manifest work/derived/v2/pilot_manifest_fsd_domain.csv --output work/runs/repaired-yamnet-mlp-v1 --features yamnet --yamnet-model work/models/yamnet-savedmodel --model mlp --allow-provisional
```

Expected: run only if `work/models/yamnet-savedmodel` exists. Otherwise report the missing local model as a remaining blocker.

- [ ] **Step 9: Run web regression gates**

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0.

- [ ] **Step 10: Compare reports without tuning on test**

Read each `metrics.json`. Rank models by validation macro-F2. Report that chosen model's test metrics once. Include per-class test support and the release-ineligible warning.

- [ ] **Step 11: Commit Task 6**

```powershell
git add ml/src/aranya_ml/cli/main.py ml/tests/test_cli.py ml/README.md
git commit -m "feat: expose repaired ML experiments"
```

### Task 7: Final verification and handoff

**Files:**
- Verify only. Generated reports remain ignored.

**Interfaces:**
- Consumes: every task deliverable
- Produces: final evidence with tests, model comparison, blockers, and exact artifact paths

- [ ] **Step 1: Run full verification from repository root**

```powershell
cd ml
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest -q
cd ..
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

Expected: all quality commands exit 0. Git status contains only intentional changes and the user's pre-existing untracked handoff file.

- [ ] **Step 2: Verify result provenance**

Confirm each reported run contains `metrics.json`, `model.joblib`, and `features.npz`. Confirm report fingerprints match the current manifest and feature configuration.

- [ ] **Step 3: Report measured outcome and blockers**

State validation and test metrics separately. List per-class support. State that human QC, field recordings, and false-alert-per-hour measurement remain required. Do not present exploratory scores as deployment accuracy.
