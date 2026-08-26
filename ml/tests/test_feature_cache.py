from pathlib import Path

import numpy as np

from aranya_ml.features.cache import load_feature_cache, save_feature_cache


def test_cache_rejects_changed_fingerprint(tmp_path: Path) -> None:
    path = tmp_path / "features.npz"
    save_feature_cache(
        path,
        "old",
        {"kind": "logmel"},
        np.ones((1, 3)),
        np.ones((1, 5), dtype=int),
        ["r1"],
    )

    assert load_feature_cache(path, "new", {"kind": "logmel"}) is None


def test_cache_round_trip_requires_matching_config(tmp_path: Path) -> None:
    path = tmp_path / "features.npz"
    features = np.array([[1.0, 2.0]], dtype=np.float32)
    targets = np.array([[1, 0, 0, 0, 0]], dtype=np.int8)
    save_feature_cache(path, "same", {"kind": "logmel"}, features, targets, ["r1"])

    assert load_feature_cache(path, "same", {"kind": "yamnet"}) is None
    loaded = load_feature_cache(path, "same", {"kind": "logmel"})
    assert loaded is not None
    loaded_features, loaded_targets, recording_ids = loaded
    assert np.array_equal(loaded_features, features)
    assert np.array_equal(loaded_targets, targets)
    assert recording_ids == ["r1"]
