"""Multi-label classifiers for YAMNet embeddings."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight


@dataclass
class IndependentTargetClassifier:
    estimators: tuple[Any, ...]

    def predict_proba(self, features: Any) -> np.ndarray:
        columns = [
            np.asarray(estimator.predict_proba(features), dtype=float)[:, 1]
            for estimator in self.estimators
        ]
        return np.column_stack(columns)


def _validated_training_data(features: Any, targets: Any) -> tuple[np.ndarray, np.ndarray]:
    feature_matrix = np.asarray(features, dtype=float)
    target_matrix = np.asarray(targets, dtype=int)
    if feature_matrix.ndim != 2 or target_matrix.ndim != 2:
        raise ValueError("features and targets must be 2-D matrices")
    if feature_matrix.shape[0] != target_matrix.shape[0]:
        raise ValueError("feature and target row counts differ")
    for index in range(target_matrix.shape[1]):
        if np.unique(target_matrix[:, index]).tolist() != [0, 1]:
            raise ValueError(f"target {index} needs positive and negative training examples")
    return feature_matrix, target_matrix


def fit_independent_logistic(
    features: Any, targets: Any, seed: int = 20260826
) -> IndependentTargetClassifier:
    feature_matrix, target_matrix = _validated_training_data(features, targets)
    estimators = []
    for index in range(target_matrix.shape[1]):
        estimator = make_pipeline(
            StandardScaler(),
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=seed,
            ),
        )
        estimator.fit(feature_matrix, target_matrix[:, index])
        estimators.append(estimator)
    return IndependentTargetClassifier(tuple(estimators))


def fit_independent_mlp(
    features: Any, targets: Any, seed: int = 20260826
) -> IndependentTargetClassifier:
    feature_matrix, target_matrix = _validated_training_data(features, targets)
    estimators = []
    for index in range(target_matrix.shape[1]):
        target = target_matrix[:, index]
        estimator = make_pipeline(
            StandardScaler(),
            MLPClassifier(
                hidden_layer_sizes=(128, 64),
                max_iter=300,
                early_stopping=True,
                random_state=seed + index,
            ),
        )
        weights = compute_sample_weight(class_weight="balanced", y=target)
        estimator.fit(feature_matrix, target, mlpclassifier__sample_weight=weights)
        estimators.append(estimator)
    return IndependentTargetClassifier(tuple(estimators))


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
