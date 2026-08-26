# Browser Student and Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distill the selected teacher into a compact local browser model with score and event parity.

**Architecture:** A five-output TensorFlow student learns from reviewed targets and teacher probabilities. An export tool creates local TensorFlow.js assets and a versioned bundle. The browser loads it through the current plugin boundary.

**Tech Stack:** TensorFlow 2.19, TensorFlow.js 4, TypeScript, Vitest, JSON Schema

**Spec:** `docs/superpowers/specs/2026-08-26-field-f2-080-design.md`

## Global Constraints

- Browser input is mono 16 kHz PCM.
- Class order and thresholds come from the model bundle.
- Inference stays off the audio rendering thread.
- A1 remains the fallback until promotion passes.

---

### Task 1: Student training and distillation

**Files:**
- Create: `ml/src/aranya_ml/models/student.py`
- Create: `ml/src/aranya_ml/training/distill.py`
- Create: `ml/tests/test_student.py`
- Create: `ml/tests/test_distill.py`

**Interfaces:**
- Produces: `build_student(input_frames: int, feature_bins: int = 64, targets: int = 5) -> keras.Model`
- Produces: `distillation_loss(labels, student_scores, teacher_scores, alpha: float, temperature: float)`

- [ ] **Step 1: Write failing tests for five sigmoid outputs, deterministic construction, and finite mixed loss.**
- [ ] **Step 2: Run with `uv run --extra tensorflow pytest tests/test_student.py tests/test_distill.py -v` and verify import failures.**
- [ ] **Step 3: Implement a compact depthwise convolutional student and combine balanced binary cross-entropy with teacher soft targets.**
- [ ] **Step 4: Add early stopping on validation macro F2 and save the best validation checkpoint only.**
- [ ] **Step 5: Run tests and commit with `git commit -m "feat: distill compact browser detector"`.**

### Task 2: Export and model bundle

**Files:**
- Create: `ml/src/aranya_ml/export/browser_bundle.py`
- Create: `ml/src/aranya_ml/export/__init__.py`
- Create: `ml/tests/test_browser_bundle.py`
- Modify: `contracts/model-bundle.v1.schema.json`
- Modify: `ml/src/aranya_ml/cli/main.py`

**Interfaces:**
- Produces CLI: `aranya-ml export-browser --model PATH --metrics PATH --dataset-version VALUE --split-version VALUE --output ml/work/exports/NAME`
- Produces: TensorFlow.js graph files, `bundle.json`, SHA-256 hashes, and PCM parity fixtures.

- [ ] **Step 1: Write a failing schema test that requires runtime `tensorflowjs`, preprocessing ID, thresholds, class status, and test vectors.**
- [ ] **Step 2: Write a failing export test that rejects any class order other than the contract order.**
- [ ] **Step 3: Implement local conversion invocation, hash every output, validate the bundle schema, and refuse files outside the requested output directory.**
- [ ] **Step 4: Run ML contract tests and commit with `git commit -m "feat: export versioned browser model bundle"`.**

### Task 3: Browser plugin and parity

**Files:**
- Create: `src/services/models/aranyaPlugin.ts`
- Create: `src/services/models/aranyaPlugin.test.ts`
- Modify: `src/services/audioClassifier.ts`
- Create: `src/services/models/modelBundle.ts`
- Create: `src/services/models/modelBundle.test.ts`

**Interfaces:**
- Produces: `AranyaModelPlugin implements AudioModelPlugin`
- Produces: `loadModelBundle(url: string) -> Promise<ModelBundleV1>`

- [ ] **Step 1: Write failing tests for bundle hash failure, wrong output shape, exact class order, threshold boundaries, and A1 fallback.**
- [ ] **Step 2: Run `npm test -- src/services/models/aranyaPlugin.test.ts src/services/models/modelBundle.test.ts` and verify module failures.**
- [ ] **Step 3: Implement bundle loading, local graph loading, 16 kHz preprocessing, frame scores, independent thresholds, and explicit failure fallback.**
- [ ] **Step 4: Add Python-generated parity vectors. Assert score tolerance at `1e-4` and exact event decisions.**
- [ ] **Step 5: Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Commit with `git commit -m "feat: run ARANYA student in browser"`.**

### Task 4: Student acceptance gate

**Files:**
- Create: `ml/src/aranya_ml/evaluation/student_gate.py`
- Create: `ml/tests/test_student_gate.py`

**Interfaces:**
- Produces: `student_gate(teacher_metrics: dict, student_metrics: dict, browser_metrics: dict) -> list[str]`

- [ ] **Step 1: Write a failing test that rejects less than 98 percent teacher macro F2, parity failure, or missing browser latency and size measurements.**
- [ ] **Step 2: Implement the gate with explicit errors per failed condition.**
- [ ] **Step 3: Run all Python and web checks. Commit with `git commit -m "feat: gate browser student quality"`.**

