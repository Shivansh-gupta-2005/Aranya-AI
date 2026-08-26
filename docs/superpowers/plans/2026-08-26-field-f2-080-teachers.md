# Teacher Benchmark and Hard Negatives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select an offline teacher that exceeds 0.82 validation macro F2 within the approved false-alert budget.

**Architecture:** Model adapters emit the same five score columns. A registry compares frozen embeddings, temporal heads, and approved fine-tuning runs on one dataset fingerprint. Reviewed false detections become versioned hard negatives.

**Tech Stack:** Python, TensorFlow 2.19, NumPy, scikit-learn, joblib, pytest

**Spec:** `docs/superpowers/specs/2026-08-26-field-f2-080-design.md`

## Global Constraints

- Model files are local inputs and are never fetched during training.
- All teachers use the same frozen splits and preprocessing fingerprint.
- Validation chooses models. Test data remains sealed.

---

### Task 1: Teacher adapter and registry

**Files:**
- Create: `ml/src/aranya_ml/models/teachers.py`
- Create: `ml/src/aranya_ml/training/registry.py`
- Create: `ml/tests/test_teachers.py`
- Create: `ml/tests/test_registry.py`

**Interfaces:**
- Produces: `TeacherAdapter.embed(audio: np.ndarray, sample_rate_hz: int) -> np.ndarray`
- Produces adapters: `YamnetSavedModelAdapter`, `PannsTorchscriptAdapter`, `AstLocalAdapter`, and `BeatsTorchscriptAdapter`
- Produces: `ExperimentRecord(run_id: str, commit: str, dataset_fingerprint: str, config_fingerprint: str, seed: int, metrics_path: str, artifact_sha256: str)`
- Produces: `append_record(path: Path, record: ExperimentRecord) -> None`

- [ ] **Step 1: Write a failing fake-adapter test that requires frame embeddings shaped `[frames, dimensions]`.**
- [ ] **Step 2: Write a failing registry test that rejects the same run ID with changed fingerprints.**
- [ ] **Step 3: Run both tests and verify import failures.**
- [ ] **Step 4: Implement the protocol and four local-only adapters. Keep TensorFlow and PyTorch imports deferred. Each adapter validates sample rate, output rank, finite values, and model-file fingerprints. Implement atomic JSONL registry writes and duplicate protection.**
- [ ] **Step 5: Run tests and commit with `git commit -m "feat: register reproducible teacher runs"`.**

### Task 2: Temporal teacher benchmark

**Files:**
- Create: `ml/src/aranya_ml/models/temporal.py`
- Create: `ml/src/aranya_ml/training/teacher_benchmark.py`
- Create: `ml/tests/test_temporal_models.py`
- Create: `ml/tests/test_teacher_benchmark.py`
- Modify: `ml/src/aranya_ml/cli/main.py`

**Interfaces:**
- Produces: `pool_context(frames: np.ndarray, context_frames: int) -> np.ndarray`
- Produces CLI: `aranya-ml benchmark-teachers --catalog PATH --models models.yaml --output ml/work/benchmarks/NAME`

- [ ] **Step 1: Write failing tests for ordered context pooling, five independent scores, and validation-only ranking.**
- [ ] **Step 2: Run the tests and verify the benchmark modules are missing.**
- [ ] **Step 3: Implement mean and maximum temporal pooling, balanced logistic and MLP heads, deterministic seeds, and per-target thresholds.**
- [ ] **Step 4: Add a YAML model matrix with local paths, adapter names, context sizes, and head types. Reject unknown adapters and missing local files.**
- [ ] **Step 5: Run the synthetic benchmark test, then the full ML suite. Commit with `git commit -m "feat: benchmark temporal audio teachers"`.**

### Task 3: Deterministic field augmentation

**Files:**
- Create: `ml/src/aranya_ml/training/augmentation.py`
- Create: `ml/tests/test_augmentation.py`
- Modify: `ml/src/aranya_ml/training/teacher_benchmark.py`

**Interfaces:**
- Produces: `AugmentationConfig(seed: int, gain_db: tuple[float, float], shift_seconds: float, background_snr_db: tuple[float, float])`
- Produces: `augment_window(audio: np.ndarray, targets: np.ndarray, background: np.ndarray | None, config: AugmentationConfig, example_id: str) -> tuple[np.ndarray, np.ndarray]`

- [ ] **Step 1: Write failing tests that require identical output for the same seed and ID, different output for a different ID, unchanged validation audio, and combined labels for mixed targets.**
- [ ] **Step 2: Run `cd ml; uv run pytest tests/test_augmentation.py -v` and verify the module is missing.**
- [ ] **Step 3: Implement gain, time shift, reviewed-background mixing, mild filtering, and deterministic random state derived from the run seed and example ID. Apply it to training windows only.**
- [ ] **Step 4: Run the tests and commit with `git commit -m "feat: augment reviewed field audio"`.**

### Task 4: Hard-negative review rounds

**Files:**
- Create: `ml/src/aranya_ml/training/hard_negatives.py`
- Create: `ml/tests/test_hard_negatives.py`
- Modify: `ml/src/aranya_ml/cli/main.py`
- Create: `ml/datasets/field-v1/hard-negative-decisions.csv`

**Interfaces:**
- Produces: `MiningCandidate(recording_id: str, target: str, start_seconds: float, end_seconds: float, score: float, model_id: str)`
- Produces CLI: `aranya-ml mine-hard-negatives --catalog PATH --model PATH --output ml/work/review/ROUND.csv --limit-per-target 500`
- Produces CLI: `aranya-ml apply-hard-negatives --catalog PATH --decisions PATH --new-version field-v2`

- [ ] **Step 1: Write a failing test that ranks candidates per target and excludes any interval overlapping an accepted target event.**
- [ ] **Step 2: Write a failing ingestion test that accepts only `false_positive`, `true_positive`, or `uncertain` review decisions.**
- [ ] **Step 3: Implement deterministic scanning, review CSV output, decision validation, and a new catalog version. Never modify a frozen catalog in place.**
- [ ] **Step 4: Run tests and commit with `git commit -m "feat: mine reviewed hard negatives"`.**
- [ ] **Step 5: Repeat benchmark and mining rounds until validation macro F2 is at least 0.82, each target is at least 0.72, and false alerts pass. Record every round in the registry.**
