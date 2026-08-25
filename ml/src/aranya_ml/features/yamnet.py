"""Optional Python-side YAMNet embedding helpers; imports are deferred until used."""
from __future__ import annotations
from typing import Any

YAMNET_SAMPLE_RATE = 16000; YAMNET_WINDOW_SECONDS = 0.96; YAMNET_HOP_SECONDS = 0.48; YAMNET_EMBEDDING_DIM = 1024; YAMNET_CLASS_COUNT = 521

def validate_yamnet_assumptions(sample_rate_hz: int, window_seconds: float, hop_seconds: float) -> None:
    if sample_rate_hz != YAMNET_SAMPLE_RATE or abs(window_seconds - YAMNET_WINDOW_SECONDS) > 1e-9 or abs(hop_seconds - YAMNET_HOP_SECONDS) > 1e-9: raise ValueError("settings do not mirror current YAMNet assumptions")

def load_local_saved_model(model_dir: str) -> Any:
    try: import tensorflow as tf
    except ImportError as exc: raise RuntimeError("TensorFlow is required; install only after approval") from exc
    return tf.saved_model.load(model_dir)

def resolve_embedding_output(outputs: Any) -> Any:
    candidates = list(outputs.values()) if isinstance(outputs, dict) else list(outputs) if isinstance(outputs, (tuple, list)) else [outputs]
    for candidate in candidates:
        shape = getattr(candidate, "shape", None)
        if shape is not None and len(shape) and shape[-1] == YAMNET_EMBEDDING_DIM: return candidate
    raise ValueError("no 1024-dimensional YAMNet embedding output found")

def embedding_array(output: Any) -> Any:
    try: import numpy as np
    except ImportError as exc: raise RuntimeError("NumPy is required to materialize embeddings") from exc
    array = output.numpy() if hasattr(output, "numpy") else np.asarray(output)
    if array.shape[-1] != YAMNET_EMBEDDING_DIM: raise ValueError(f"unexpected embedding shape {array.shape}")
    return array.astype("float32") if array.ndim == 1 else array.reshape(-1, YAMNET_EMBEDDING_DIM).mean(axis=0).astype("float32")
