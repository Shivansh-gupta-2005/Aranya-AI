"""Composition helpers for future held-out evaluation reports."""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from statistics import mean, median

from .metrics import classification_metrics


def evaluate_predictions(
    y_true: Sequence[str], y_pred: Sequence[str], labels: Sequence[str]
) -> dict[str, object]:
    return classification_metrics(y_true, y_pred, labels)


def summarize_latency_ms(values: Sequence[float]) -> dict[str, float | int]:
    if not values:
        return {
            "count": 0,
            "mean_ms": 0.0,
            "median_ms": 0.0,
            "p95_ms": 0.0,
            "min_ms": 0.0,
            "max_ms": 0.0,
        }
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(0.95 * (len(ordered) - 1)))
    return {
        "count": len(values),
        "mean_ms": mean(values),
        "median_ms": median(values),
        "p95_ms": ordered[index],
        "min_ms": min(values),
        "max_ms": max(values),
    }


def model_size_bytes(path: str | Path) -> int:
    return Path(path).stat().st_size


def write_json(path: str | Path, payload: dict[str, object]) -> None:
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
