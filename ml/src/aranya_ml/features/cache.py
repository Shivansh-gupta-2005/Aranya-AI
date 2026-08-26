"""Fingerprint-aware feature cache storage."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path

import numpy as np


def _canonical_config(config: Mapping[str, object]) -> str:
    return json.dumps(config, sort_keys=True, separators=(",", ":"))


def save_feature_cache(
    path: str | Path,
    fingerprint: str,
    config: Mapping[str, object],
    features: np.ndarray,
    targets: np.ndarray,
    recording_ids: Sequence[str],
) -> None:
    cache_path = Path(path)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        cache_path,
        fingerprint=np.asarray(fingerprint),
        config=np.asarray(_canonical_config(config)),
        features=np.asarray(features),
        targets=np.asarray(targets),
        recording_ids=np.asarray(recording_ids, dtype=str),
    )


def load_feature_cache(
    path: str | Path,
    fingerprint: str,
    config: Mapping[str, object],
) -> tuple[np.ndarray, np.ndarray, list[str]] | None:
    cache_path = Path(path)
    if not cache_path.is_file():
        return None
    with np.load(cache_path, allow_pickle=False) as cached:
        if str(cached["fingerprint"].item()) != fingerprint:
            return None
        if str(cached["config"].item()) != _canonical_config(config):
            return None
        return (
            np.asarray(cached["features"]),
            np.asarray(cached["targets"]),
            cached["recording_ids"].astype(str).tolist(),
        )
