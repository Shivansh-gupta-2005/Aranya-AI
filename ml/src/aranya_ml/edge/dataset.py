"""Dataset balancing and recording-level aggregation for edge experiments."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import f1_score, precision_score


def balanced_class_indices(labels: np.ndarray, samples_per_class: int, seed: int) -> np.ndarray:
    """Return a deterministic shuffled sample with equal rows per class."""
    values = np.asarray(labels, dtype=np.int64).reshape(-1)
    if samples_per_class <= 0:
        raise ValueError("samples_per_class must be positive")
    classes = np.unique(values)
    if not len(classes):
        raise ValueError("labels cannot be empty")
    rng = np.random.default_rng(seed)
    selected: list[np.ndarray] = []
    for class_id in classes:
        available = np.flatnonzero(values == class_id)
        replace = len(available) < samples_per_class
        selected.append(rng.choice(available, size=samples_per_class, replace=replace))
    combined = np.concatenate(selected)
    rng.shuffle(combined)
    return combined.astype(np.int64)


def aggregate_recording_probabilities(
    recording_ids: np.ndarray,
    labels: np.ndarray,
    probabilities: np.ndarray,
    top_k: int | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Average window probabilities into one prediction per recording."""
    ids = np.asarray(recording_ids).astype(str).reshape(-1)
    target_labels = np.asarray(labels, dtype=np.int64).reshape(-1)
    scores = np.asarray(probabilities, dtype=np.float32)
    if scores.ndim != 2 or len(ids) != len(target_labels) or len(ids) != len(scores):
        raise ValueError("recording IDs, labels, and probabilities must have matching rows")
    if top_k is not None and top_k <= 0:
        raise ValueError("top_k must be positive")

    order = list(dict.fromkeys(ids.tolist()))
    result_labels: list[int] = []
    result_scores: list[np.ndarray] = []
    for recording_id in order:
        mask = ids == recording_id
        unique_labels = np.unique(target_labels[mask])
        if len(unique_labels) != 1:
            raise ValueError(f"recording {recording_id} has conflicting labels")
        result_labels.append(int(unique_labels[0]))
        recording_scores = scores[mask]
        if top_k is None:
            result_scores.append(recording_scores.mean(axis=0))
        else:
            selected_count = min(top_k, len(recording_scores))
            result_scores.append(np.sort(recording_scores, axis=0)[-selected_count:].mean(axis=0))
    return (
        np.asarray(order),
        np.asarray(result_labels, dtype=np.int64),
        np.stack(result_scores).astype(np.float32),
    )


def select_target_thresholds(
    labels: np.ndarray,
    probabilities: np.ndarray,
    background_index: int,
    grid: tuple[float, ...] | None = None,
) -> np.ndarray:
    """Select one validation F1 threshold for each non-background class."""
    truth = np.asarray(labels, dtype=np.int64).reshape(-1)
    scores = np.asarray(probabilities, dtype=np.float32)
    if scores.ndim != 2 or len(scores) != len(truth):
        raise ValueError("labels and probabilities must have matching rows")
    if background_index != scores.shape[1] - 1:
        raise ValueError("background must be the final class")
    candidates = grid or tuple(float(value) for value in np.arange(0.05, 1.0, 0.05))
    thresholds: list[float] = []
    for class_index in range(background_index):
        target_truth = truth == class_index
        if not np.any(target_truth):
            raise ValueError(f"class {class_index} has no positive validation examples")
        ranked: list[tuple[float, float, float]] = []
        for threshold in candidates:
            prediction = scores[:, class_index] >= threshold
            ranked.append(
                (
                    float(
                        f1_score(
                            target_truth,
                            prediction,
                            zero_division=0,  # pyright: ignore[reportArgumentType]
                        )
                    ),
                    float(
                        precision_score(
                            target_truth,
                            prediction,
                            zero_division=0,  # pyright: ignore[reportArgumentType]
                        )
                    ),
                    float(threshold),
                )
            )
        thresholds.append(max(ranked)[2])
    return np.asarray(thresholds, dtype=np.float32)


def predict_with_background(
    probabilities: np.ndarray,
    thresholds: np.ndarray,
    background_index: int,
) -> np.ndarray:
    """Predict the strongest passing target or fall back to background."""
    scores = np.asarray(probabilities, dtype=np.float32)
    selected_thresholds = np.asarray(thresholds, dtype=np.float32).reshape(-1)
    if scores.ndim != 2 or selected_thresholds.shape != (background_index,):
        raise ValueError("probabilities or thresholds have an unexpected shape")
    target_scores = scores[:, :background_index]
    passing = target_scores >= selected_thresholds[np.newaxis, :]
    masked = np.where(passing, target_scores, -1.0)
    predictions = masked.argmax(axis=1).astype(np.int64)
    predictions[~passing.any(axis=1)] = background_index
    return predictions
