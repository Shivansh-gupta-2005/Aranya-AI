import csv
from pathlib import Path

from pytest import CaptureFixture

from aranya_ml.cli.main import main


def test_validate_catalog_command(capsys: CaptureFixture[str]) -> None:
    exit_code = main(["validate-catalog", "--catalog", "datasets/v1"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Valid recordings: 13" in captured.out
    assert "Training eligible: 0" in captured.out


def test_gated_command_explains_missing_input(capsys: CaptureFixture[str]) -> None:
    exit_code = main(["train", "--catalog", "datasets/v1"])

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "No training-eligible recordings" in captured.err


def write_pilot_manifest(root: Path) -> Path:
    audio = root / "audio.wav"
    audio.write_bytes(b"audio")
    manifest = root / "pilot.csv"
    row = {
        "recording_id": "r1",
        "source_id": "team",
        "path": str(audio),
        "recording_group_id": "g1",
        "session_id": "s1",
        "class_id": "gunfire",
        "split": "test",
        "duration_seconds": "1.0",
        "annotation_coverage": "complete",
        "review_status": "needs_review",
        "training_eligible": "False",
        "source_labels": "gunfire",
    }
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=row)
        writer.writeheader()
        writer.writerow(row)
    return manifest


def test_audit_pilot_prints_release_gate(tmp_path: Path, capsys: CaptureFixture[str]) -> None:
    manifest = write_pilot_manifest(tmp_path)

    exit_code = main(["audit-pilot", "--manifest", str(manifest), "--allow-provisional"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert '"release_eligible": false' in captured.out
    assert '"gunfire": 1' in captured.out


def test_train_pilot_requires_yamnet_model_path(
    tmp_path: Path, capsys: CaptureFixture[str]
) -> None:
    manifest = write_pilot_manifest(tmp_path)

    exit_code = main(
        [
            "train-pilot",
            "--manifest",
            str(manifest),
            "--output",
            str(tmp_path / "run"),
            "--features",
            "yamnet",
            "--model",
            "logistic",
        ]
    )

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "--yamnet-model is required" in captured.err
