"""Pure-Python metric primitives; no results are generated without supplied data."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass


def classification_metrics(
    y_true: Sequence[str], y_pred: Sequence[str], labels: Sequence[str]
) -> dict[str, object]:
    if len(y_true) != len(y_pred):
        raise ValueError("prediction lengths differ")
    names = list(labels)
    index = {label: i for i, label in enumerate(names)}
    matrix = [[0 for _ in names] for _ in names]
    for truth, prediction in zip(y_true, y_pred, strict=True):
        if truth not in index or prediction not in index:
            raise ValueError("unknown label")
        matrix[index[truth]][index[prediction]] += 1
    per_class = {}
    precisions = []
    recalls = []
    f1s = []
    for i, label in enumerate(names):
        tp = matrix[i][i]
        fp = sum(row[i] for row in matrix) - tp
        fn = sum(matrix[i]) - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": sum(matrix[i]),
        }
        precisions.append(precision)
        recalls.append(recall)
        f1s.append(f1)
    total = len(y_true)
    return {
        "sample_count": total,
        "accuracy": sum(matrix[i][i] for i in range(len(names))) / total if total else 0.0,
        "macro_precision": sum(precisions) / len(names) if names else 0.0,
        "macro_recall": sum(recalls) / len(names) if names else 0.0,
        "macro_f1": sum(f1s) / len(names) if names else 0.0,
        "per_class": per_class,
        "labels": names,
        "confusion_matrix": matrix,
    }


@dataclass(frozen=True)
class DetectionEpisode:
    start_seconds: float
    end_seconds: float
    is_false_positive: bool


def count_false_positive_episodes(
    episodes: Iterable[DetectionEpisode], merge_gap_seconds: float = 0.96
) -> int:
    selected = sorted((e for e in episodes if e.is_false_positive), key=lambda e: e.start_seconds)
    count = 0
    current_end = None
    for episode in selected:
        if current_end is None or episode.start_seconds > current_end + merge_gap_seconds:
            count += 1
            current_end = episode.end_seconds
        else:
            current_end = max(current_end, episode.end_seconds)
    return count


def false_positive_episodes_per_background_hour(
    episodes: Iterable[DetectionEpisode], background_seconds: float, merge_gap_seconds: float = 0.96
) -> float:
    if background_seconds <= 0:
        raise ValueError("background_seconds must be positive")
    return count_false_positive_episodes(episodes, merge_gap_seconds) / (
        background_seconds / 3600.0
    )
