import csv
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from aranya_ml.training.experiment import ExperimentConfig, _feature_config, run_experiment

TARGETS = ("gunfire", "chainsaw", "metal_tool_activity", "fire", "vehicle")
FIELDS = (
    "recording_id",
    "source_id",
    "path",
    "recording_group_id",
    "session_id",
    "class_id",
    "split",
    "duration_seconds",
    "annotation_coverage",
    "review_status",
    "training_eligible",
    "source_labels",
)


def write_synthetic_audio_manifest(root: Path) -> Path:
    sample_rate = 16_000
    time = np.arange(sample_rate) / sample_rate
    rows: list[dict[str, str]] = []
    for split_index, split in enumerate(("train", "validation", "test")):
        for class_index, class_id in enumerate((*TARGETS, "background")):
            recording_id = f"{split}-{class_id}"
            path = root / f"{recording_id}.wav"
            if class_id == "background":
                audio = np.zeros(sample_rate, dtype=np.float32)
            else:
                frequency = 250 + class_index * 300
                audio = (0.5 * np.sin(2 * np.pi * frequency * time)).astype(np.float32)
            audio += np.float32(split_index * 0.00001)
            sf.write(path, audio, sample_rate)
            rows.append(
                {
                    "recording_id": recording_id,
                    "source_id": "synthetic-test",
                    "path": str(path),
                    "recording_group_id": recording_id,
                    "session_id": recording_id,
                    "class_id": class_id,
                    "split": split,
                    "duration_seconds": "1.0",
                    "annotation_coverage": "complete",
                    "review_status": "reviewed",
                    "training_eligible": str(split == "train"),
                    "source_labels": class_id,
                }
            )
    manifest = root / "pilot.csv"
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter[str](handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return manifest


@pytest.mark.filterwarnings("ignore::DeprecationWarning:audioread.rawread")
def test_experiment_uses_validation_thresholds_and_writes_artifacts(tmp_path: Path) -> None:
    manifest = write_synthetic_audio_manifest(tmp_path)
    output = tmp_path / "run"

    report = run_experiment(
        ExperimentConfig(
            manifest=manifest,
            output=output,
            feature_kind="logmel",
            model_kind="logistic",
            allow_provisional=True,
            seed=7,
        )
    )

    assert report["data"]["release_eligible"] is False
    assert report["threshold_source"] == "validation"
    assert report["test"]["sample_count"] == 6
    assert (output / "metrics.json").exists()
    assert (output / "model.joblib").exists()
    assert (output / "features.npz").exists()


@pytest.mark.filterwarnings("ignore::DeprecationWarning:audioread.rawread")
def test_experiment_records_f1_threshold_objective(tmp_path: Path) -> None:
    manifest = write_synthetic_audio_manifest(tmp_path)

    report = run_experiment(
        ExperimentConfig(
            manifest=manifest,
            output=tmp_path / "run-f1",
            feature_kind="logmel",
            model_kind="logistic",
            threshold_metric="f1",
            allow_provisional=True,
            seed=7,
        )
    )

    assert report["threshold_metric"] == "f1"


@pytest.mark.filterwarnings("ignore::DeprecationWarning:audioread.rawread")
def test_experiment_refuses_output_with_changed_data(tmp_path: Path) -> None:
    manifest = write_synthetic_audio_manifest(tmp_path)
    config = ExperimentConfig(
        manifest=manifest,
        output=tmp_path / "run",
        feature_kind="logmel",
        model_kind="logistic",
        allow_provisional=True,
        seed=7,
    )
    run_experiment(config)
    audio = tmp_path / "train-gunfire.wav"
    audio.write_bytes(audio.read_bytes() + b"changed")

    with pytest.raises(ValueError, match="output fingerprint does not match selected data"):
        run_experiment(config)


@pytest.mark.filterwarnings("ignore::DeprecationWarning:audioread.rawread")
def test_experiment_refuses_output_with_changed_seed(tmp_path: Path) -> None:
    manifest = write_synthetic_audio_manifest(tmp_path)
    output = tmp_path / "run"
    run_experiment(
        ExperimentConfig(
            manifest=manifest,
            output=output,
            feature_kind="logmel",
            model_kind="logistic",
            allow_provisional=True,
            seed=7,
        )
    )

    with pytest.raises(ValueError, match="output seed does not match requested run"):
        run_experiment(
            ExperimentConfig(
                manifest=manifest,
                output=output,
                feature_kind="logmel",
                model_kind="logistic",
                allow_provisional=True,
                seed=8,
            )
        )


def test_yamnet_feature_config_changes_with_model_content(tmp_path: Path) -> None:
    model = tmp_path / "yamnet"
    model.mkdir()
    weights = model / "saved_model.pb"
    weights.write_bytes(b"first")
    config = ExperimentConfig(
        manifest=tmp_path / "pilot.csv",
        output=tmp_path / "run",
        feature_kind="yamnet",
        model_kind="logistic",
        yamnet_model=model,
    )
    first = _feature_config(config)
    weights.write_bytes(b"second")

    assert _feature_config(config)["model_fingerprint"] != first["model_fingerprint"]
