"""Train, quantize, and evaluate the compact ARANYA edge DS-CNN."""

from __future__ import annotations

import argparse
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Any

import librosa
import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score

from aranya_ml.data.pilot_manifest import (
    TARGET_ORDER,
    PilotRow,
    load_pilot_manifest,
    pilot_fingerprint,
)
from aranya_ml.edge.dataset import (
    aggregate_recording_probabilities,
    balanced_class_indices,
    predict_with_background,
    select_target_thresholds,
)
from aranya_ml.edge.features import (
    DEFAULT_EDGE_FEATURE_CONFIG,
    extract_edge_spectrogram,
    iter_fixed_windows,
)
from aranya_ml.edge.model import augment_spectrogram, build_edge_dscnn
from aranya_ml.training.experiment import select_experiment_rows

EDGE_CLASS_ORDER = (*TARGET_ORDER, "background")


def _selected_windows(audio: np.ndarray, maximum: int) -> list[np.ndarray]:
    windows = list(iter_fixed_windows(audio, DEFAULT_EDGE_FEATURE_CONFIG))
    if len(windows) <= maximum:
        return windows
    indices = np.linspace(0, len(windows) - 1, maximum).round().astype(int)
    return [windows[index] for index in indices]


def _extract_row(row: PilotRow, maximum: int) -> tuple[list[np.ndarray], list[str], list[int]]:
    audio, _ = librosa.load(
        row.path,
        sr=DEFAULT_EDGE_FEATURE_CONFIG.sample_rate_hz,
        mono=True,
    )
    class_index = EDGE_CLASS_ORDER.index(row.class_id)
    windows = _selected_windows(np.asarray(audio, dtype=np.float32), maximum)
    features = [extract_edge_spectrogram(window) for window in windows]
    return features, [row.recording_id] * len(features), [class_index] * len(features)


def _extract_dataset(
    rows: list[PilotRow], maximum: int, workers: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    with ThreadPoolExecutor(max_workers=workers) as pool:
        extracted = list(pool.map(lambda row: _extract_row(row, maximum), rows))
    features: list[np.ndarray] = []
    recording_ids: list[str] = []
    labels: list[int] = []
    splits: list[str] = []
    for row, (row_features, row_ids, row_labels) in zip(rows, extracted, strict=True):
        features.extend(row_features)
        recording_ids.extend(row_ids)
        labels.extend(row_labels)
        splits.extend([row.split] * len(row_features))
    return (
        np.stack(features).astype(np.float32),
        np.asarray(labels, dtype=np.int64),
        np.asarray(recording_ids),
        np.asarray(splits),
    )


def _load_or_extract(
    rows: list[PilotRow], cache: Path, maximum: int, workers: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    fingerprint = pilot_fingerprint(rows)
    config_json = json.dumps(asdict(DEFAULT_EDGE_FEATURE_CONFIG), sort_keys=True)
    if cache.is_file():
        with np.load(cache, allow_pickle=False) as data:
            cached_fingerprint = str(data["fingerprint"].item())
            cached_config = str(data["feature_config"].item())
            cached_maximum = int(data["max_windows_per_recording"].item())
            if (
                cached_fingerprint == fingerprint
                and cached_config == config_json
                and cached_maximum == maximum
            ):
                return (
                    np.asarray(data["features"], dtype=np.float32),
                    np.asarray(data["labels"], dtype=np.int64),
                    data["recording_ids"].astype(str),
                    data["splits"].astype(str),
                )
    values = _extract_dataset(rows, maximum, workers)
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        cache,
        fingerprint=np.asarray(fingerprint),
        feature_config=np.asarray(config_json),
        max_windows_per_recording=np.asarray(maximum),
        features=values[0],
        labels=values[1],
        recording_ids=values[2],
        splits=values[3],
    )
    return values


def _fit_model(
    tf: Any,
    features: np.ndarray,
    labels: np.ndarray,
    splits: np.ndarray,
    samples_per_class: int,
    epochs: int,
    seed: int,
    width_multiplier: float,
) -> tuple[Any, np.ndarray]:
    train_available = np.flatnonzero(splits == "train")
    validation_available = np.flatnonzero(splits == "validation")
    train_local = balanced_class_indices(
        labels[train_available], samples_per_class=samples_per_class, seed=seed
    )
    validation_count = min(200, max(32, samples_per_class // 4))
    validation_local = balanced_class_indices(
        labels[validation_available], samples_per_class=validation_count, seed=seed + 1
    )
    train_indices = train_available[train_local]
    validation_indices = validation_available[validation_local]
    train_x = features[train_indices][..., np.newaxis]
    train_y = labels[train_indices]
    validation_x = features[validation_indices][..., np.newaxis]
    validation_y = labels[validation_indices]
    feature_mean = float(train_x.mean())
    feature_std = float(max(train_x.std(), 1e-6))

    tf.keras.utils.set_random_seed(seed)
    model = build_edge_dscnn(
        tf,
        config=DEFAULT_EDGE_FEATURE_CONFIG,
        class_count=len(EDGE_CLASS_ORDER),
        feature_mean=feature_mean,
        feature_std=feature_std,
        width_multiplier=width_multiplier,
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    train_dataset = (
        tf.data.Dataset.from_tensor_slices((train_x, train_y))
        .shuffle(len(train_x), seed=seed, reshuffle_each_iteration=True)
        .map(
            lambda batch_features, batch_label: augment_spectrogram(
                tf, batch_features, batch_label
            ),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
        .batch(128)
        .prefetch(tf.data.AUTOTUNE)
    )
    model.fit(
        train_dataset,
        validation_data=(validation_x, validation_y),
        epochs=epochs,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=10, restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5
            ),
        ],
        verbose=2,
    )
    return model, train_indices


def _representative_dataset(features: np.ndarray, indices: np.ndarray):
    for index in indices[:512]:
        yield [features[index][np.newaxis, ..., np.newaxis].astype(np.float32)]


def _convert_int8(tf: Any, model: Any, features: np.ndarray, indices: np.ndarray) -> bytes:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter._experimental_disable_per_channel = True
    converter.representative_dataset = lambda: _representative_dataset(features, indices)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def _predict_int8(tf: Any, model_bytes: bytes, features: np.ndarray) -> np.ndarray:
    interpreter = tf.lite.Interpreter(model_content=model_bytes)
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    input_scale, input_zero = input_detail["quantization"]
    output_scale, output_zero = output_detail["quantization"]
    if not input_scale or not output_scale:
        raise ValueError("converted model has no usable INT8 quantization scales")
    results: list[np.ndarray] = []
    for start in range(0, len(features), 256):
        batch = features[start : start + 256][..., np.newaxis]
        quantized = np.round(batch / input_scale + input_zero).clip(-128, 127).astype(np.int8)
        interpreter.resize_tensor_input(input_detail["index"], quantized.shape, strict=False)
        interpreter.allocate_tensors()
        interpreter.set_tensor(input_detail["index"], quantized)
        interpreter.invoke()
        output = interpreter.get_tensor(output_detail["index"])
        results.append((output.astype(np.float32) - output_zero) * output_scale)
    return np.clip(np.concatenate(results), 0.0, 1.0)


def _evaluate(
    labels: np.ndarray,
    recording_ids: np.ndarray,
    splits: np.ndarray,
    probabilities: np.ndarray,
    thresholds: np.ndarray,
    aggregation_top_k: int | None,
) -> dict[str, Any]:
    report: dict[str, Any] = {}
    for split in ("train", "validation", "test"):
        mask = splits == split
        ids, truth, scores = aggregate_recording_probabilities(
            recording_ids[mask],
            labels[mask],
            probabilities[mask],
            top_k=aggregation_top_k,
        )
        predicted = predict_with_background(
            scores,
            thresholds=thresholds,
            background_index=len(EDGE_CLASS_ORDER) - 1,
        )
        report[split] = {
            "recordings": int(len(ids)),
            "macro_f1": float(f1_score(truth, predicted, average="macro", zero_division=0)),
            "macro_precision": float(
                precision_score(truth, predicted, average="macro", zero_division=0)
            ),
            "macro_recall": float(recall_score(truth, predicted, average="macro", zero_division=0)),
            "support": {
                name: int(np.sum(truth == index)) for index, name in enumerate(EDGE_CLASS_ORDER)
            },
            "per_class_f1": {
                name: float(
                    f1_score(
                        truth == index,
                        predicted == index,
                        zero_division=0,
                    )
                )
                for index, name in enumerate(EDGE_CLASS_ORDER)
            },
            "confusion_matrix": confusion_matrix(
                truth, predicted, labels=np.arange(len(EDGE_CLASS_ORDER))
            ).tolist(),
        }
    return report


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--samples-per-class", type=int, default=1200)
    parser.add_argument("--max-windows-per-recording", type=int, default=5)
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seed", type=int, default=20260827)
    parser.add_argument("--width-multiplier", type=float, default=1.0)
    parser.add_argument("--aggregation-top-k", type=int, default=0)
    args = parser.parse_args()

    import tensorflow as tf

    rows = select_experiment_rows(load_pilot_manifest(args.manifest, False), False)
    cache = args.cache or args.output / "edge_spectrograms.npz"
    features, labels, recording_ids, splits = _load_or_extract(
        rows,
        cache,
        args.max_windows_per_recording,
        args.workers,
    )
    model, representative_indices = _fit_model(
        tf,
        features,
        labels,
        splits,
        args.samples_per_class,
        args.epochs,
        args.seed,
        args.width_multiplier,
    )
    float_probabilities = np.asarray(
        model.predict(features[..., np.newaxis], batch_size=256, verbose=0),
        dtype=np.float32,
    )
    int8_bytes = _convert_int8(tf, model, features, representative_indices)
    int8_probabilities = _predict_int8(tf, int8_bytes, features)
    validation_mask = splits == "validation"
    aggregation_top_k = args.aggregation_top_k or None
    _, validation_labels, float_validation_scores = aggregate_recording_probabilities(
        recording_ids[validation_mask],
        labels[validation_mask],
        float_probabilities[validation_mask],
        top_k=aggregation_top_k,
    )
    _, _, int8_validation_scores = aggregate_recording_probabilities(
        recording_ids[validation_mask],
        labels[validation_mask],
        int8_probabilities[validation_mask],
        top_k=aggregation_top_k,
    )
    float_thresholds = select_target_thresholds(
        validation_labels,
        float_validation_scores,
        background_index=len(EDGE_CLASS_ORDER) - 1,
    )
    int8_thresholds = select_target_thresholds(
        validation_labels,
        int8_validation_scores,
        background_index=len(EDGE_CLASS_ORDER) - 1,
    )
    float_metrics = _evaluate(
        labels,
        recording_ids,
        splits,
        float_probabilities,
        float_thresholds,
        aggregation_top_k,
    )
    int8_metrics = _evaluate(
        labels,
        recording_ids,
        splits,
        int8_probabilities,
        int8_thresholds,
        aggregation_top_k,
    )

    args.output.mkdir(parents=True, exist_ok=True)
    int8_path = args.output / "aranya_edge_dscnn_int8.tflite"
    float_path = args.output / "aranya_edge_dscnn_float32.tflite"
    int8_path.write_bytes(int8_bytes)
    float_bytes = tf.lite.TFLiteConverter.from_keras_model(model).convert()
    float_path.write_bytes(float_bytes)
    metrics = {
        "float32": {"thresholds": float_thresholds.tolist(), **float_metrics},
        "int8": {"thresholds": int8_thresholds.tolist(), **int8_metrics},
    }
    (args.output / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8"
    )
    np.savez_compressed(
        args.output / "test_vectors.npz",
        features=features[splits == "test"][:16],
        labels=labels[splits == "test"][:16],
        probabilities=int8_probabilities[splits == "test"][:16],
    )
    metadata = {
        "schemaVersion": "edge-candidate-2",
        "modelId": "aranya-edge-dscnn",
        "modelVersion": "candidate-20260827",
        "runtime": "tflite-micro",
        "classOrder": list(EDGE_CLASS_ORDER),
        "targetThresholds": int8_thresholds.tolist(),
        "featureConfig": asdict(DEFAULT_EDGE_FEATURE_CONFIG),
        "widthMultiplier": args.width_multiplier,
        "aggregationTopK": aggregation_top_k,
        "int8Model": {
            "file": int8_path.name,
            "bytes": len(int8_bytes),
            "sha256": _sha256(int8_bytes),
        },
        "datasetManifest": str(args.manifest.resolve()),
        "metricsFile": "metrics.json",
        "warning": (
            "Candidate benchmark model. Field accuracy and microphone parity are not verified."
        ),
    }
    (args.output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "int8_bytes": len(int8_bytes),
                "int8_test_macro_f1": int8_metrics["test"]["macro_f1"],
                "output": str(args.output),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
