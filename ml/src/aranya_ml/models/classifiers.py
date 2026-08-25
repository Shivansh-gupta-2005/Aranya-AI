"""Multi-label classifiers for YAMNet embeddings."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def fit_one_vs_rest_logistic(features: Any, targets: Any, seed: int = 20260823) -> Any:
    classifier = OneVsRestClassifier(
        LogisticRegression(max_iter=1000, random_state=seed),
        n_jobs=1,
    )
    return make_pipeline(StandardScaler(), classifier).fit(features, targets)


def fit_small_multi_output_mlp(features: Any, targets: Any, seed: int = 20260823) -> Any:
    classifier = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        max_iter=300,
        early_stopping=True,
        random_state=seed,
    )
    return make_pipeline(StandardScaler(), classifier).fit(features, targets)


def predict_target_scores(model: Any, features: Any) -> np.ndarray:
    scores = np.asarray(model.predict_proba(features), dtype=float)
    if scores.ndim != 2:
        raise ValueError(f"expected a 2-D target score matrix, got {scores.shape}")
    return scores


def save_model(model: Any, path: str | Path) -> None:
    joblib.dump(model, Path(path))
