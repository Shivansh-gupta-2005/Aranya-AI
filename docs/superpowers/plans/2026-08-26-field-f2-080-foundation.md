# Measurement and Field Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build event-level measurement and a leakage-safe field dataset release gate.

**Architecture:** Extend the catalog with review facts and field slices. Convert reviewed intervals into deterministic windows, then evaluate event decisions against verified background time.

**Tech Stack:** Python, dataclasses, CSV, NumPy, scikit-learn, pytest

**Spec:** `docs/superpowers/specs/2026-08-26-field-f2-080-design.md`

## Global Constraints

- Preserve the existing five-target contract and frozen group splits.
- Unreviewed time is never negative.
- Dataset builds are deterministic and fingerprinted.
- Raw and derived audio stay under `ml/work/`.

---

### Task 1: Review and field metadata

**Files:**
- Modify: `ml/src/aranya_ml/data/catalog.py`
- Modify: `ml/tests/test_catalog.py`
- Create: `ml/datasets/field-v1/README.md`
- Create: `ml/datasets/field-v1/reviews.csv`
- Create: `ml/datasets/field-v1/field_metadata.csv`

**Interfaces:**
- Produces: `Review(annotation_id: str, reviewer: str, decision: str, reviewed_at: str)`
- Produces: `FieldMetadata(recording_id: str, device_id: str, location_id: str, date_block: str, weather: str, distance_band: str, snr_band: str)`
- Produces: `Catalog.reviews: tuple[Review, ...]`
- Produces: `Catalog.field_metadata: tuple[FieldMetadata, ...]`
- Produces: `validate_catalog(catalog: Catalog) -> list[str]` checks adjudication and verified negatives.

- [ ] **Step 1: Write failing catalog tests**

```python
def test_complete_negative_requires_reviewed_recording_and_no_intervals() -> None:
    catalog = catalog_with_complete_negative(review_status="provisional")
    assert "verified negative needs completed review: r1" in validate_catalog(catalog)

def test_test_annotation_needs_a_review_decision() -> None:
    catalog = catalog_with_test_annotation(review_rows=[])
    assert "test annotation needs review: a1" in validate_catalog(catalog)
```

- [ ] **Step 2: Run `cd ml; uv run pytest tests/test_catalog.py -v` and verify both tests fail.**
- [ ] **Step 3: Add `Review` and `FieldMetadata`. Treat absent new CSV files as empty for the historical `datasets/v1` catalog. Enforce `accepted`, `rejected`, or `uncertain` decisions. Require accepted reviews and structured field metadata for validation and test rows in field datasets.**
- [ ] **Step 4: Run the catalog tests and verify they pass.**
- [ ] **Step 5: Commit with `git commit -m "feat: validate field annotation reviews"`.**

### Task 2: Interval windows and event metrics

**Files:**
- Create: `ml/src/aranya_ml/data/windowing.py`
- Create: `ml/src/aranya_ml/evaluation/events.py`
- Create: `ml/tests/test_windowing.py`
- Create: `ml/tests/test_event_metrics.py`

**Interfaces:**
- Produces: `WindowLabel(recording_id: str, start_seconds: float, end_seconds: float, targets: tuple[int, ...])`
- Produces: `build_windows(catalog: Catalog, window_seconds: float = 0.96, hop_seconds: float = 0.48) -> list[WindowLabel]`
- Produces: `evaluate_events(truth: Sequence[Event], predictions: Sequence[Event], background_seconds: float, match_iou: float = 0.1) -> dict[str, object]`
- Produces: `EventRule(threshold: float, persistence_frames: int, cooldown_seconds: float)`
- Produces: `select_event_rules(validation_sequences, budgets) -> dict[str, EventRule]`

- [ ] **Step 1: Write failing tests for multi-label overlap and unreviewed gaps.**

```python
def test_window_can_hold_two_targets() -> None:
    windows = build_windows(catalog_with_overlapping_events())
    assert windows[0].targets == (1, 1, 0, 0, 0)

def test_unreviewed_gap_does_not_create_negative_window() -> None:
    assert build_windows(partially_reviewed_catalog()) == []
```

- [ ] **Step 2: Write a failing event test that matches each truth event once and counts duplicate predictions separately.**
- [ ] **Step 3: Run `cd ml; uv run pytest tests/test_windowing.py tests/test_event_metrics.py -v` and verify import failures.**
- [ ] **Step 4: Implement deterministic windows, per-target event matching, F2, delay, duplicate count, false positives per background hour, and validation-only persistence and cooldown selection.**
- [ ] **Step 5: Run both test files and commit with `git commit -m "feat: measure reviewed acoustic events"`.**

### Task 3: Support, leakage, and release audit

**Files:**
- Create: `ml/src/aranya_ml/data/field_audit.py`
- Create: `ml/src/aranya_ml/data/audio_fingerprint.py`
- Create: `ml/tests/test_field_audit.py`
- Create: `ml/tests/test_audio_fingerprint.py`
- Modify: `ml/src/aranya_ml/cli/main.py`
- Modify: `ml/tests/test_cli.py`

**Interfaces:**
- Produces: `audit_field_catalog(catalog: Catalog) -> dict[str, object]`
- Produces: `acoustic_fingerprint(path: Path) -> np.ndarray`
- Produces: `near_duplicate_pairs(items: Sequence[tuple[str, np.ndarray]], maximum_distance: float) -> list[tuple[str, str]]`
- Produces CLI: `aranya-ml audit-field --catalog datasets/field-v1`

- [ ] **Step 1: Write a failing test with one group crossing devices and splits. Assert the audit reports the group and returns `release_eligible: false`.**
- [ ] **Step 2: Write a failing acoustic fingerprint test using one recording and a gain-shifted copy. Assert they form one near-duplicate pair.**
- [ ] **Step 3: Add support assertions for 100 positive test groups per target, reviewed validation and test labels, verified background hours, structured slice metadata, unique SHA-256 values, and no near duplicates across splits.**
- [ ] **Step 4: Run `cd ml; uv run pytest tests/test_field_audit.py tests/test_audio_fingerprint.py tests/test_cli.py -v` and verify failures.**
- [ ] **Step 5: Implement a normalized log-mel fingerprint, cosine-distance duplicate search, audit, and JSON CLI output. Exit 1 for invalid data and 0 for a valid but release-ineligible catalog.**
- [ ] **Step 6: Run all ML checks and commit with `git commit -m "feat: gate field dataset releases"`.**

### Task 4: Foundation baseline report

**Files:**
- Create: `ml/src/aranya_ml/training/field_experiment.py`
- Create: `ml/tests/test_field_experiment.py`
- Modify: `ml/src/aranya_ml/cli/main.py`

**Interfaces:**
- Produces CLI: `aranya-ml evaluate-field --catalog PATH --predictions PATH --output ml/work/runs/NAME`
- Produces: `metrics.json` with clip, event, calibration, support, fingerprint, and slice metrics.

- [ ] **Step 1: Write a synthetic end-to-end test that rejects test-selected thresholds and writes event metrics from validation-selected thresholds.**
- [ ] **Step 2: Run the test and verify the command is missing.**
- [ ] **Step 3: Implement the evaluator with expected calibration error and recording-group bootstrap intervals. Refuse output reuse when dataset, predictions, thresholds, or event settings differ.**
- [ ] **Step 4: Evaluate A1 and the repaired log-mel MLP on field-v1 when the release audit passes.**
- [ ] **Step 5: Run `uv run ruff check src tests`, `uv run pyright`, and `uv run pytest -q`. Commit with `git commit -m "feat: report field detector baselines"`.**
