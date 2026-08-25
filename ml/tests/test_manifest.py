from aranya_ml.data.manifest import ManifestRecord, validate_records

def record(**changes: object) -> ManifestRecord:
    values = {
        "file_id": "f1",
        "path": "audio/f1.wav",
        "label": "background",
        "background_subtype": "forest_ambience",
        "source_name": "team",
        "source_url": "",
        "license": "team-owned",
        "license_verified": True,
        "attribution_required": False,
        "recording_group_id": "group-1",
        "session_id": "session-1",
        "source_identity": "operator-1",
        "location_description": "forest",
        "environment_description": "quiet",
        "microphone": "INMP441",
        "sample_rate_hz": 16000,
        "channels": 1,
        "duration_seconds": 10.0,
        "format": "wav",
        "size_bytes": 320_000,
        "sha256": "a" * 64,
        "event_start_seconds": None,
        "event_end_seconds": None,
        "annotation_confidence": 1.0,
        "annotator": "annotator",
        "split": "",
        "training_eligible": True,
        "previous_test_use": False,
        "notes": "",
    }
    values.update(changes)
    return ManifestRecord(**values)

def test_valid_background() -> None:
    assert validate_records([record()]) == []


def test_duplicate_ids() -> None:
    errors = validate_records([record(), record(recording_group_id="group-2")])
    assert any("duplicate file_id" in error for error in errors)


def test_background_subtype_required() -> None:
    assert any("background requires" in error for error in validate_records([record(background_subtype="")]))


def test_threat_interval_required() -> None:
    errors = validate_records([record(label="gunshot", background_subtype="")])
    assert any("annotated event interval" in error for error in errors)


def test_invalid_interval() -> None:
    errors = validate_records([record(event_start_seconds=8.0, event_end_seconds=12.0)])
    assert any("event interval" in error for error in errors)
