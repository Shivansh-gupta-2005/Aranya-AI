"""Small classifiers for 1024-D embeddings; no training is invoked by scaffolding."""
from __future__ import annotations
from typing import Any

def fit_logistic_regression(X: Any, y: Any, seed: int = 20260823) -> Any:
    try:
        from sklearn.linear_model import LogisticRegression; from sklearn.pipeline import make_pipeline; from sklearn.preprocessing import StandardScaler
    except ImportError as exc: raise RuntimeError("scikit-learn is required") from exc
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, random_state=seed)).fit(X, y)

def fit_small_mlp(X: Any, y: Any, seed: int = 20260823) -> Any:
    try:
        from sklearn.neural_network import MLPClassifier; from sklearn.pipeline import make_pipeline; from sklearn.preprocessing import StandardScaler
    except ImportError as exc: raise RuntimeError("scikit-learn is required") from exc
    return make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=300, early_stopping=True, random_state=seed)).fit(X, y)

def predict_labels(model: Any, X: Any) -> list[str]: return [str(value) for value in model.predict(X)]

def save_model(model: Any, path: str) -> None:
    try: import joblib
    except ImportError as exc: raise RuntimeError("joblib is required") from exc
    joblib.dump(model, path)
