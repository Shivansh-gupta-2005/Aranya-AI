import csv
from pathlib import Path

from aranya_ml.data.pilot_manifest import (
    PilotRow,
    audit_pilot_rows,
    load_pilot_manifest,
    pilot_fingerprint,
    validate_split_groups,
)

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


def write_manifest(
    root: Path,
    *,
    class_id: str = "gunfire",
    source_id: str = "team",
    source_labels: str = "gunfire",
    path_value: str = "audio.wav",
    review_status: str = "reviewed",
    training_eligible: str = "True",
) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    audio = root / path_value
    audio.parent.mkdir(parents=True, exist_ok=True)
    audio.write_bytes(b"audio")
    manifest = root / "pilot.csv"
    row = {
        "recording_id": "r1",
        "source_id": source_id,
        "path": path_value,
        "recording_group_id": "g1",
        "session_id": "s1",
        "class_id": class_id,
        "split": "train",
        "duration_seconds": "1.0",
        "annotation_coverage": "complete",
        "review_status": review_status,
        "training_eligible": training_eligible,
        "source_labels": source_labels,
    }
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter[str](handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerow(row)
    return manifest


def make_row(
    recording_id: str,
    group: str,
    split: str,
    *,
    targets: tuple[int, ...] = (1, 0, 0, 0, 0),
    source_id: str = "team",
) -> PilotRow:
    return PilotRow(
        recording_id=recording_id,
        source_id=source_id,
        path=Path(f"{recording_id}.wav"),
        recording_group_id=group,
        session_id=group,
        class_id="gunfire",
        split=split,
        duration_seconds=1.0,
        annotation_coverage="complete",
        review_status="reviewed",
        training_eligible=split == "train",
        source_labels=("gunfire",),
        targets=targets,
    )


def test_fsd_labels_preserve_multiple_targets(tmp_path: Path) -> None:
    manifest = write_manifest(
        tmp_path,
        class_id="gunfire",
        source_id="fsd50k",
        source_labels="Gunshot_and_gunfire,Vehicle",
    )

    row = load_pilot_manifest(manifest, allow_provisional=False)[0]

    assert row.targets == (1, 0, 0, 0, 1)


def test_background_has_no_positive_target(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path, class_id="background", source_labels="Rain")

    row = load_pilot_manifest(manifest, allow_provisional=False)[0]

    assert row.targets == (0, 0, 0, 0, 0)


def test_repo_relative_audio_path_resolves_from_nested_manifest(tmp_path: Path) -> None:
    repository_audio = tmp_path / "ml" / "work" / "audio.wav"
    repository_audio.parent.mkdir(parents=True)
    repository_audio.write_bytes(b"audio")
    manifest_dir = tmp_path / "ml" / "work" / "derived"
    manifest = write_manifest(manifest_dir, path_value="ml/work/audio.wav")
    (manifest_dir / "ml" / "work" / "audio.wav").unlink()

    row = load_pilot_manifest(manifest, allow_provisional=False)[0]

    assert row.path == repository_audio.resolve()


def test_group_cannot_cross_splits() -> None:
    rows = [make_row("a", "group-1", "train"), make_row("b", "group-1", "test")]

    assert validate_split_groups(rows) == ["recording group group-1 crosses splits: test, train"]


def test_audit_counts_positive_groups_and_release_gate() -> None:
    rows = [make_row("a", "group-1", "test")]

    audit = audit_pilot_rows(rows)

    assert audit["positive_groups"]["test"]["gunfire"] == 1
    assert audit["release_eligible"] is False


def test_fingerprint_changes_when_selected_data_changes() -> None:
    first = [make_row("a", "group-1", "train")]
    second = [make_row("b", "group-2", "train")]

    assert pilot_fingerprint(first) != pilot_fingerprint(second)
