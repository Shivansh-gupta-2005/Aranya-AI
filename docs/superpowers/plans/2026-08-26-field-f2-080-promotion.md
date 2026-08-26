# Frozen Test and Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate one selected browser student on a sealed field test set and publish defensible per-target promotion decisions.

**Architecture:** A hashed selection record binds the candidate before test access. The evaluator opens the frozen test once, creates a permanent result record, and applies contract promotion gates without tuning.

**Tech Stack:** Python, JSON Schema, pytest, Vitest, browser performance APIs

**Spec:** `docs/superpowers/specs/2026-08-26-field-f2-080-design.md`

## Global Constraints

- Test results never tune the same dataset version.
- Promotion is per target.
- Macro F2 must reach 0.80 and each promoted target must reach 0.70 F2.
- Event recall must not fall below A1 and false alerts must not increase.

---

### Task 1: Candidate selection lock

**Files:**
- Create: `ml/src/aranya_ml/evaluation/selection.py`
- Create: `ml/tests/test_selection.py`
- Modify: `ml/src/aranya_ml/cli/main.py`

**Interfaces:**
- Produces CLI: `aranya-ml lock-candidate --bundle PATH --validation-metrics PATH --output ml/work/releases/NAME/selection.json`
- Produces an immutable record of bundle hash, dataset version, split version, thresholds, code commit, and validation metrics hash.

- [ ] **Step 1: Write a failing test that rejects changed thresholds or bundle files after selection.**
- [ ] **Step 2: Implement canonical JSON hashing and exclusive creation of the selection record.**
- [ ] **Step 3: Run tests and commit with `git commit -m "feat: lock field test candidate"`.**

### Task 2: One-time frozen test evaluator

**Files:**
- Create: `ml/src/aranya_ml/evaluation/frozen_test.py`
- Create: `ml/tests/test_frozen_test.py`
- Modify: `ml/src/aranya_ml/cli/main.py`
- Create: `ml/datasets/field-v1/test-use.json`

**Interfaces:**
- Produces CLI: `aranya-ml evaluate-frozen-test --selection PATH --catalog PATH --output ml/work/releases/NAME/test-result.json`

- [ ] **Step 1: Write failing tests that reject a reused test fingerprint, changed selection hash, non-test rows, and fewer than 100 positive groups per target.**
- [ ] **Step 2: Implement exclusive result creation and calculate clip, event, background-hour, delay, duplicate, calibration, confidence interval, and field-slice metrics. Write the used test fingerprint and selection hash to tracked dataset metadata.**
- [ ] **Step 3: Run tests and commit with `git commit -m "feat: evaluate sealed field test"`.**

### Task 3: Browser performance evidence

**Files:**
- Create: `src/services/models/modelBenchmark.ts`
- Create: `src/services/models/modelBenchmark.test.ts`
- Create: `scripts/run-model-benchmark.mjs`

**Interfaces:**
- Produces JSON with browser name, hardware description, model size, peak memory when available, warmup count, sample count, P50 latency, and P95 latency.

- [ ] **Step 1: Write a failing percentile test using fixed latency samples.**
- [ ] **Step 2: Implement warmup, timed inference, percentile calculation, and JSON output without sending audio or results over the network.**
- [ ] **Step 3: Run web checks and commit with `git commit -m "feat: measure browser model performance"`.**

### Task 4: Promotion decision and model card

**Files:**
- Create: `ml/src/aranya_ml/evaluation/promotion.py`
- Create: `ml/tests/test_promotion.py`
- Create: `docs/ml/model-card-template.md`
- Modify: `ml/src/aranya_ml/cli/main.py`

**Interfaces:**
- Produces CLI: `aranya-ml promote --selection PATH --test-result PATH --browser-metrics PATH --a1-result PATH --false-alert-budget PATH --output ml/work/releases/NAME`
- Produces per-target `candidate` or `promoted` status, validated `bundle.json`, and a model card source file.

- [ ] **Step 1: Write failing tests for macro F2 below 0.80, target F2 below 0.70, reduced A1 recall, excess false alerts, missing support, and failed browser parity.**
- [ ] **Step 2: Implement explicit gate messages and per-target promotion. Never round a metric before applying a gate.**
- [ ] **Step 3: Generate the model card from recorded facts: training data, evaluation data, intended use, limits, slices, latency, model size, licenses, and known failures.**
- [ ] **Step 4: Run all ML and web checks. Validate the final bundle against `contracts/model-bundle.v1.schema.json`.**
- [ ] **Step 5: Commit code and the reusable template with `git commit -m "feat: gate acoustic model promotion"`. Generated release results remain ignored.**
