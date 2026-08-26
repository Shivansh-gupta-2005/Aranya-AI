from aranya_ml.data.catalog import (
    Annotation,
    Catalog,
    Recording,
    Source,
    SplitAssignment,
    load_catalog,
    validate_catalog,
)


def source(**changes: object) -> Source:
    values = {
        "source_id": "team",
        "name": "Aranya team",
        "url": "",
        "license": "team-owned",
        "license_verified": True,
        "attribution_required": False,
    }
    values.update(changes)
    return Source(**values)


def recording(**changes: object) -> Recording:
    values = {
        "recording_id": "r1",
        "path": "raw/r1.wav",
        "source_id": "team",
        "recording_group_id": "g1",
        "session_id": "s1",
        "source_identity": "operator-1",
        "location_description": "forest",
        "environment_description": "quiet",
        "microphone": "INMP441",
        "sample_rate_hz": 16_000,
        "channels": 1,
        "duration_seconds": 10.0,
        "format": "wav",
        "size_bytes": 320_000,
        "sha256": "a" * 64,
        "annotation_coverage": "complete",
        "review_status": "reviewed",
        "previous_test_use": False,
        "training_eligible": True,
        "notes": "",
    }
    values.update(changes)
    return Recording(**values)


def annotation(annotation_id: str, class_id: str) -> Annotation:
    return Annotation(annotation_id, "r1", class_id, 0.0, 2.0, 1.0, "reviewer")


def test_catalog_accepts_multi_label_recordings() -> None:
    catalog = Catalog(
        sources=(source(),),
        recordings=(recording(),),
        annotations=(annotation("a1", "gunfire"), annotation("a2", "vehicle")),
        splits=(SplitAssignment("split-v1", "g1", "train", True),),
    )

    assert validate_catalog(catalog) == []


def test_unreviewed_recording_cannot_be_a_training_negative() -> None:
    catalog = Catalog(
        sources=(source(),),
        recordings=(recording(annotation_coverage="unreviewed"),),
        annotations=(),
        splits=(SplitAssignment("split-v1", "g1", "train", True),),
    )

    errors = validate_catalog(catalog)

    assert any("complete annotation coverage" in error for error in errors)


def test_previous_test_recording_cannot_be_training_eligible() -> None:
    catalog = Catalog(
        sources=(source(),),
        recordings=(recording(previous_test_use=True),),
        annotations=(annotation("a1", "gunfire"),),
        splits=(SplitAssignment("legacy-v0", "g1", "test", True),),
    )

    errors = validate_catalog(catalog)

    assert any("previous test use" in error for error in errors)


def test_target_annotations_reject_context_classes() -> None:
    catalog = Catalog(
        sources=(source(),),
        recordings=(recording(),),
        annotations=(annotation("a1", "background"),),
        splits=(SplitAssignment("split-v1", "g1", "train", True),),
    )

    errors = validate_catalog(catalog)

    assert any("unsupported target class" in error for error in errors)


def test_split_assignment_must_reference_a_recording_group() -> None:
    catalog = Catalog(
        sources=(source(),),
        recordings=(recording(),),
        annotations=(annotation("a1", "gunfire"),),
        splits=(SplitAssignment("split-v1", "missing-group", "train", True),),
    )

    errors = validate_catalog(catalog)

    assert any("unknown recording group" in error for error in errors)


def test_tracked_v1_catalog_is_valid() -> None:
    catalog = load_catalog("datasets/v1")

    assert len(catalog.recordings) == 13
    assert validate_catalog(catalog) == []
    assert all(not recording.training_eligible for recording in catalog.recordings)
