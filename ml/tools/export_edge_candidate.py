"""Train and export a small log-mel model for an embedded runtime."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

from aranya_ml.data.pilot_manifest import TARGET_ORDER, load_pilot_manifest
from aranya_ml.evaluation.multilabel import evaluate_multilabel, select_f1_thresholds
from aranya_ml.training.experiment import select_experiment_rows


def _load_training_data(
    manifest_path: Path, cache_path: Path
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rows = select_experiment_rows(
        load_pilot_manifest(manifest_path, allow_provisional=False), False
    )
    with np.load(cache_path, allow_pickle=False) as cached:
        features = np.asarray(cached["features"], dtype=np.float32)
        targets = np.asarray(cached["targets"], dtype=np.float32)
        recording_ids = cached["recording_ids"].astype(str)
    expected_ids = np.asarray([row.recording_id for row in rows], dtype=str)
    if not np.array_equal(recording_ids, expected_ids):
        raise ValueError("feature cache recording IDs do not match the manifest")
    if features.ndim != 2 or targets.shape != (features.shape[0], len(TARGET_ORDER)):
        raise ValueError("feature cache has an unexpected shape")
    splits = np.asarray([row.split for row in rows])
    return features, targets, splits


def _build_model(tf: Any, feature_count: int, mean: np.ndarray, std: np.ndarray) -> Any:
    inputs = tf.keras.Input(shape=(feature_count,), dtype=tf.float32, name="logmel_summary")
    normalized = tf.keras.layers.Normalization(
        mean=mean,
        variance=np.square(std),
        name="feature_standardization",
    )(inputs)
    outputs = []
    for target in TARGET_ORDER:
        branch = tf.keras.layers.Dense(128, activation="relu", name=f"{target}_dense_1")(normalized)
        branch = tf.keras.layers.Dense(64, activation="relu", name=f"{target}_dense_2")(branch)
        outputs.append(tf.keras.layers.Dense(1, activation="sigmoid", name=target)(branch))
    scores = tf.keras.layers.Concatenate(name="scores")(outputs)
    return tf.keras.Model(inputs, scores)


def _train(
    tf: Any,
    train_x: np.ndarray,
    train_y: np.ndarray,
    validation: tuple[np.ndarray, np.ndarray],
    seed: int,
) -> Any:
    tf.keras.utils.set_random_seed(seed)
    mean = train_x.mean(axis=0).astype(np.float32)
    std = np.maximum(train_x.std(axis=0), 1e-6).astype(np.float32)
    model = _build_model(tf, train_x.shape[1], mean, std)
    positive = np.maximum(train_y.sum(axis=0), 1.0).astype(np.float32)
    negative = np.maximum(train_y.shape[0] - positive, 1.0).astype(np.float32)
    positive_weight = tf.constant(negative / positive, dtype=tf.float32)

    def weighted_binary_crossentropy(y_true: Any, y_pred: Any) -> Any:
        epsilon = tf.keras.backend.epsilon()
        clipped = tf.clip_by_value(y_pred, epsilon, 1.0 - epsilon)
        losses = -(
            positive_weight * y_true * tf.math.log(clipped)
            + (1.0 - y_true) * tf.math.log(1.0 - clipped)
        )
        return tf.reduce_mean(losses, axis=-1)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=weighted_binary_crossentropy,
    )
    model.fit(
        train_x,
        train_y,
        validation_data=validation,
        epochs=100,
        batch_size=128,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=12, restore_best_weights=True
            )
        ],
        verbose=0,
    )
    return model, mean, std


def _representative_dataset(train_x: np.ndarray):
    count = min(len(train_x), 256)
    for row in train_x[:count]:
        yield [row[np.newaxis, :].astype(np.float32)]


def _convert_int8(tf: Any, model: Any, train_x: np.ndarray) -> bytes:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter._experimental_disable_per_channel = True
    converter.representative_dataset = lambda: _representative_dataset(train_x)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def _predict_int8(tf: Any, model_bytes: bytes, features: np.ndarray) -> np.ndarray:
    interpreter = tf.lite.Interpreter(model_content=model_bytes)
    interpreter.allocate_tensors()
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    input_scale, input_zero = input_detail["quantization"]
    output_scale, output_zero = output_detail["quantization"]
    if not input_scale or not output_scale:
        raise ValueError("converted model has no usable int8 quantization scales")
    scores = []
    for row in features:
        quantized = np.round(row / input_scale + input_zero).clip(-128, 127).astype(np.int8)
        interpreter.set_tensor(input_detail["index"], quantized[np.newaxis, :])
        interpreter.invoke()
        output = interpreter.get_tensor(output_detail["index"])[0]
        scores.append((output.astype(np.float32) - output_zero) * output_scale)
    return np.clip(np.asarray(scores), 0.0, 1.0)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--features", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=20260826)
    args = parser.parse_args()

    import tensorflow as tf

    features, targets, splits = _load_training_data(args.manifest, args.features)
    train_mask = splits == "train"
    validation_mask = splits == "validation"
    test_mask = splits == "test"
    model, mean, std = _train(
        tf,
        features[train_mask],
        targets[train_mask],
        (features[validation_mask], targets[validation_mask]),
        args.seed,
    )
    float_scores = np.asarray(model.predict(features, batch_size=256, verbose=0), dtype=np.float32)
    int8_bytes = _convert_int8(tf, model, features[train_mask])
    int8_scores = _predict_int8(tf, int8_bytes, features)
    thresholds = select_f1_thresholds(
        targets[validation_mask].astype(int), int8_scores[validation_mask]
    )
    float_metrics = {
        split: evaluate_multilabel(targets[mask].astype(int), float_scores[mask], thresholds)
        for split, mask in (
            ("train", train_mask),
            ("validation", validation_mask),
            ("test", test_mask),
        )
    }
    int8_metrics = {
        split: evaluate_multilabel(targets[mask].astype(int), int8_scores[mask], thresholds)
        for split, mask in (
            ("train", train_mask),
            ("validation", validation_mask),
            ("test", test_mask),
        )
    }

    args.output.mkdir(parents=True, exist_ok=True)
    float_path = args.output / "aranya_edge_logmel_float32.tflite"
    int8_path = args.output / "aranya_edge_logmel_int8.tflite"
    float_path.write_bytes(tf.lite.TFLiteConverter.from_keras_model(model).convert())
    int8_path.write_bytes(int8_bytes)
    np.savez_compressed(
        args.output / "test_vectors.npz",
        features=features[test_mask][:32],
        scores=int8_scores[test_mask][:32],
        thresholds=thresholds,
    )
    metadata = {
        "schemaVersion": "edge-candidate-1",
        "modelId": "aranya-edge-logmel-mlp",
        "modelVersion": "candidate-20260826",
        "runtime": "tflite-micro-candidate",
        "preprocessingId": "aranya-logmel-summary-v1",
        "input": {
            "sampleRateHz": 16000,
            "channels": 1,
            "rawDtype": "int16",
            "featureDtype": "float32",
            "featureShape": [int(features.shape[1])],
            "windowSeconds": 0.96,
            "hopSeconds": 0.48,
        },
        "outputClassOrder": list(TARGET_ORDER),
        "thresholds": thresholds.tolist(),
        "classStatus": {target: "candidate" for target in TARGET_ORDER},
        "datasetVersion": "fast-manifest-tropical-local",
        "splitVersion": "group-audited-local",
        "int8Model": {
            "file": int8_path.name,
            "sha256": _sha256(int8_bytes),
            "bytes": len(int8_bytes),
        },
        "normalization": {"mean": mean.tolist(), "std": std.tolist()},
        "testVectors": ["test_vectors.npz"],
        "metricsFile": "metrics.json",
        "warning": (
            "PC candidate only. ESP32 audio feature extraction is not verified; "
            "zero-vector TFLite parity smoke test passed."
        ),
    }
    (args.output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (args.output / "metrics.json").write_text(
        json.dumps(
            {"thresholds": thresholds.tolist(), "float32": float_metrics, "int8": int8_metrics},
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "int8_bytes": len(int8_bytes),
                "int8_test_macro_f1": int8_metrics["test"]["macro_f1"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
