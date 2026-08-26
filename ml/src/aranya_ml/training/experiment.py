"""Reproducible pilot training and evaluation."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

import joblib
import librosa
import numpy as np

from aranya_ml.data.pilot_manifest import (
    TARGET_ORDER,
    PilotRow,
    audit_pilot_rows,
    load_pilot_manifest,
    pilot_fingerprint,
    validate_split_groups,
)
from aranya_ml.evaluation.multilabel import evaluate_multilabel, select_f2_thresholds
from aranya_ml.features.cache import load_feature_cache, save_feature_cache
from aranya_ml.features.logmel import DEFAULT_LOGMEL_CONFIG, extract_logmel_summary
from aranya_ml.features.yamnet import (
    YAMNET_HOP_SECONDS,
    YAMNET_SAMPLE_RATE,
    YAMNET_WINDOW_SECONDS,
    load_local_saved_model,
    pool_embedding_frames,
    resolve_embedding_output,
)
from aranya_ml.models.classifiers import (
    fit_independent_logistic,
    fit_independent_mlp,
    predict_target_scores,
)


@dataclass(frozen=True)
class ExperimentConfig:
    manifest: Path
    output: Path
    feature_kind: Literal["logmel", "yamnet"]
    model_kind: Literal["logistic", "mlp"]
    allow_provisional: bool = False
    yamnet_model: Path | None = None
    seed: int = 20260826
    workers: int = 8


def select_experiment_rows(rows: list[PilotRow], allow_provisional: bool) -> list[PilotRow]:
    holdout_groups = {row.recording_group_id for row in rows if row.split in {"validation", "test"}}
    selected = []
    for row in rows:
        include_provisional_train = (
            allow_provisional and row.recording_group_id not in holdout_groups
        )
        if row.split != "train" or row.training_eligible or include_provisional_train:
            selected.append(row)
    errors = validate_split_groups(selected)
    if errors:
        raise ValueError("; ".join(errors))
    return selected


def _feature_config(config: ExperimentConfig) -> dict[str, object]:
    if config.feature_kind == "logmel":
        return {"kind": "logmel", **asdict(DEFAULT_LOGMEL_CONFIG)}
    if config.yamnet_model is None:
        raise ValueError("yamnet_model is required for YAMNet features")
    return {
        "kind": "yamnet",
        "model_path": str(config.yamnet_model.resolve()),
        "sample_rate_hz": YAMNET_SAMPLE_RATE,
        "window_seconds": YAMNET_WINDOW_SECONDS,
        "hop_seconds": YAMNET_HOP_SECONDS,
        "pooling": "mean_and_max",
    }


def _extract_yamnet_summary(row: PilotRow, model: Any) -> np.ndarray:
    audio, _ = librosa.load(row.path, sr=YAMNET_SAMPLE_RATE, mono=True)
    outputs = model(np.asarray(audio, dtype=np.float32))
    return pool_embedding_frames(resolve_embedding_output(outputs))


def _extract_features(
    rows: list[PilotRow], config: ExperimentConfig, feature_config: dict[str, object]
) -> np.ndarray:
    if feature_config["kind"] == "logmel":
        with ThreadPoolExecutor(max_workers=config.workers) as pool:
            values = list(pool.map(lambda row: extract_logmel_summary(row.path), rows))
    else:
        if config.yamnet_model is None:
            raise ValueError("yamnet_model is required for YAMNet features")
        model = load_local_saved_model(str(config.yamnet_model))
        values = [_extract_yamnet_summary(row, model) for row in rows]
    return np.stack(values).astype(np.float32)


def _read_existing_report(output: Path) -> dict[str, object] | None:
    path = output / "metrics.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def run_experiment(config: ExperimentConfig) -> dict[str, Any]:
    all_rows = load_pilot_manifest(config.manifest, allow_provisional=config.allow_provisional)
    rows = select_experiment_rows(all_rows, config.allow_provisional)
    if not rows:
        raise ValueError("manifest has no selected rows")
    fingerprint = pilot_fingerprint(rows)
    feature_config = _feature_config(config)
    existing = _read_existing_report(config.output)
    if existing is not None and existing.get("data_fingerprint") != fingerprint:
        raise ValueError("output fingerprint does not match selected data")
    if existing is not None and existing.get("feature_config") != feature_config:
        raise ValueError("output feature configuration does not match requested run")
    if existing is not None and existing.get("model_kind") != config.model_kind:
        raise ValueError("output model kind does not match requested run")

    config.output.mkdir(parents=True, exist_ok=True)
    cache_path = config.output / "features.npz"
    cached = load_feature_cache(cache_path, fingerprint, feature_config)
    recording_ids = [row.recording_id for row in rows]
    targets = np.asarray([row.targets for row in rows], dtype=np.int8)
    if cached is not None and cached[2] == recording_ids:
        features, cached_targets, _ = cached
        if not np.array_equal(cached_targets, targets):
            raise ValueError("cached targets do not match selected data")
    else:
        features = _extract_features(rows, config, feature_config)
        save_feature_cache(
            cache_path, fingerprint, feature_config, features, targets, recording_ids
        )

    splits = np.asarray([row.split for row in rows])
    train_mask = splits == "train"
    validation_mask = splits == "validation"
    test_mask = splits == "test"
    if not np.any(train_mask) or not np.any(validation_mask) or not np.any(test_mask):
        raise ValueError("selected data needs train, validation, and test rows")

    trainer = fit_independent_logistic if config.model_kind == "logistic" else fit_independent_mlp
    model = trainer(features[train_mask], targets[train_mask], seed=config.seed)
    validation_scores = predict_target_scores(model, features[validation_mask])
    thresholds = select_f2_thresholds(targets[validation_mask], validation_scores)
    audit = audit_pilot_rows(rows)
    audit["release_eligible"] = bool(audit["release_eligible"] and not config.allow_provisional)
    report: dict[str, object] = {
        "data_fingerprint": fingerprint,
        "feature_config": feature_config,
        "model_kind": config.model_kind,
        "seed": config.seed,
        "target_order": list(TARGET_ORDER),
        "threshold_source": "validation",
        "thresholds": thresholds.tolist(),
        "data": audit,
    }
    for split_name, mask in (
        ("train", train_mask),
        ("validation", validation_mask),
        ("test", test_mask),
    ):
        scores = predict_target_scores(model, features[mask])
        report[split_name] = evaluate_multilabel(targets[mask], scores, thresholds)

    joblib.dump(
        {
            "model": model,
            "target_order": TARGET_ORDER,
            "thresholds": thresholds,
            "feature_config": feature_config,
            "data_fingerprint": fingerprint,
        },
        config.output / "model.joblib",
    )
    (config.output / "metrics.json").write_text(
        json.dumps(report, indent=2, sort_keys=True), encoding="utf-8"
    )
    return report
