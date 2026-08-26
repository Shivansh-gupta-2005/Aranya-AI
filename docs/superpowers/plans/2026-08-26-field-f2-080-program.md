# Field Macro F2 0.80 Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact browser model that reaches at least 0.80 macro F2 on a frozen field test set.

**Architecture:** Four execution plans build the measurement and data foundation, improve offline teachers through hard-negative mining, distill a browser student, and run a guarded promotion evaluation. Each plan has its own green exit gate.

**Tech Stack:** Python 3.11 or 3.12, uv, NumPy, scikit-learn, TensorFlow 2.19, TensorFlow.js, TypeScript, Vitest, JSON Schema

**Spec:** `docs/superpowers/specs/2026-08-26-field-f2-080-design.md`

## Global Constraints

- Target order is exactly `gunfire`, `chainsaw`, `metal_tool_activity`, `fire`, `vehicle`.
- Background is an all-zero target vector and never a model output.
- Browser inference stays local and consumes mono 16 kHz PCM.
- Threshold and model selection use validation data only.
- Test groups never enter training, calibration, or model selection.
- Raw audio, models, embeddings, and generated reports stay under ignored `ml/work/`.
- Gunfire and fire collection uses authorized controlled sources or licensed recordings.
- Existing event storage and simulated sensor behavior remain unchanged.

---

## Execution order

1. [Measurement and Field Data](2026-08-26-field-f2-080-foundation.md)
2. [Teacher Benchmark and Hard Negatives](2026-08-26-field-f2-080-teachers.md)
3. [Browser Student and Parity](2026-08-26-field-f2-080-browser-student.md)
4. [Frozen Test and Promotion](2026-08-26-field-f2-080-promotion.md)

## Program checkpoints

- [ ] Foundation exits with valid event reports for A1 and repaired log-mel models.
- [ ] Field data exits with reviewed intervals, verified background hours, and at least 100 positive test groups per target.
- [ ] Teacher work exits at 0.82 validation macro F2, at least 0.72 per target, and an approved false-alert budget.
- [ ] Student work exits after retaining at least 98 percent of teacher macro F2 and passing browser parity.
- [ ] Promotion exits only at test macro F2 of at least 0.80 and per-target F2 of at least 0.70.

## External inputs

Code cannot create the field evidence by itself. The project owner must provide authorized recordings, reviewer decisions, sensitive-location policy, representative browser devices, and per-target false-alert budgets. Every plan has a machine-readable gate that remains blocked until its required input exists.

