"""Threshold selection and metrics for independent target scores."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    fbeta_score,
    precision_score,
    recall_score,
)

from aranya_ml.data.pilot_manifest import TARGET_ORDER

ZERO_DIVISION: Any = 0


def _validate_matrices(y_true: np.ndarray, scores: np.ndarray) -> None:
    if y_true.ndim != 2 or scores.ndim != 2:
        raise ValueError("truth and scores must be 2-D matrices")
    if y_true.shape != scores.shape:
        raise ValueError("truth and score shapes differ")
    if np.any((scores < 0.0) | (scores > 1.0)):
        raise ValueError("scores must stay between 0 and 1")


def select_f2_thresholds(
    y_true: np.ndarray,
    scores: np.ndarray,
    grid: Sequence[float] | None = None,
) -> np.ndarray:
    truth = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(scores, dtype=float)
    _validate_matrices(truth, probabilities)
    candidates = tuple(grid) if grid is not None else tuple(np.arange(0.05, 1.0, 0.05))
    if not candidates:
        raise ValueError("threshold grid cannot be empty")
    thresholds: list[float] = []
    for index in range(truth.shape[1]):
        target_truth = truth[:, index]
        if not np.any(target_truth == 1):
            raise ValueError(f"target {index} has no positive validation examples")
        if not np.any(target_truth == 0):
            raise ValueError(f"target {index} has no negative validation examples")
        ranked: list[tuple[float, float, float]] = []
        for threshold in candidates:
            prediction = probabilities[:, index] >= threshold
            ranked.append(
                (
                    float(
                        fbeta_score(target_truth, prediction, beta=2, zero_division=ZERO_DIVISION)
                    ),
                    float(precision_score(target_truth, prediction, zero_division=ZERO_DIVISION)),
                    float(threshold),
                )
            )
        thresholds.append(max(ranked)[2])
    return np.asarray(thresholds, dtype=float)


def evaluate_multilabel(
    y_true: np.ndarray,
    scores: np.ndarray,
    thresholds: np.ndarray,
    target_names: Sequence[str] = TARGET_ORDER,
) -> dict[str, Any]:
    truth = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(scores, dtype=float)
    selected_thresholds = np.asarray(thresholds, dtype=float)
    _validate_matrices(truth, probabilities)
    if selected_thresholds.shape != (truth.shape[1],):
        raise ValueError("threshold count does not match target count")
    if len(target_names) != truth.shape[1]:
        raise ValueError("target name count does not match target count")

    predictions = probabilities >= selected_thresholds
    per_class: dict[str, dict[str, Any]] = {}
    for index, target in enumerate(target_names):
        target_truth = truth[:, index]
        target_prediction = predictions[:, index]
        support = int(target_truth.sum())
        per_class[target] = {
            "precision": float(
                precision_score(target_truth, target_prediction, zero_division=ZERO_DIVISION)
            ),
            "recall": float(
                recall_score(target_truth, target_prediction, zero_division=ZERO_DIVISION)
            ),
            "f1": float(f1_score(target_truth, target_prediction, zero_division=ZERO_DIVISION)),
            "f2": float(
                fbeta_score(target_truth, target_prediction, beta=2, zero_division=ZERO_DIVISION)
            ),
            "pr_auc": (
                float(average_precision_score(target_truth, probabilities[:, index]))
                if support
                else 0.0
            ),
            "support": support,
            "threshold": float(selected_thresholds[index]),
            "confusion_matrix": confusion_matrix(
                target_truth, target_prediction, labels=[0, 1]
            ).tolist(),
        }

    return {
        "sample_count": int(truth.shape[0]),
        "macro_precision": float(
            precision_score(truth, predictions, average="macro", zero_division=ZERO_DIVISION)
        ),
        "macro_recall": float(
            recall_score(truth, predictions, average="macro", zero_division=ZERO_DIVISION)
        ),
        "macro_f1": float(
            f1_score(truth, predictions, average="macro", zero_division=ZERO_DIVISION)
        ),
        "macro_f2": float(
            fbeta_score(
                truth,
                predictions,
                beta=2,
                average="macro",
                zero_division=ZERO_DIVISION,
            )
        ),
        "micro_f1": float(
            f1_score(truth, predictions, average="micro", zero_division=ZERO_DIVISION)
        ),
        "subset_accuracy": float(accuracy_score(truth, predictions)),
        "per_class": per_class,
    }
