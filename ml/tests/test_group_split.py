from aranya_ml.data.manifest import ManifestRecord, grouped_split_records

def make_record(index: int, group: str, label: str) -> ManifestRecord:
    background = label == "background"
    return ManifestRecord(
        file_id=f"f{index}",
        path=f"f{index}.wav",
        label=label,
        background_subtype="forest_ambience" if background else "",
        source_name="team",
        source_url="",
        license="team-owned",
        license_verified=True,
        attribution_required=False,
        recording_group_id=group,
        session_id=group,
        source_identity=group,
        location_description="forest",
        environment_description="test",
        microphone="test",
        sample_rate_hz=16000,
        channels=1,
        duration_seconds=5.0,
        format="wav",
        size_bytes=160_000,
        sha256=f"{index:064x}",
        event_start_seconds=None if background else 1.0,
        event_end_seconds=None if background else 2.0,
        annotation_confidence=1.0,
        annotator="test",
        split="",
        training_eligible=True,
        previous_test_use=False,
        notes="",
    )

def test_group_never_crosses_splits() -> None:
    records = [make_record(i, f"group-{i // 2}", "background" if i % 2 else "gunshot") for i in range(12)]
    result = grouped_split_records(records, seed=7)
    groups: dict[str, set[str]] = {}
    for item in result:
        groups.setdefault(item.recording_group_id, set()).add(item.split)
    assert all(len(splits) == 1 for splits in groups.values())
    assert {record.split for record in result} == {"train", "validation", "test"}


def test_deterministic() -> None:
    records = [make_record(i, f"group-{i}", "background") for i in range(10)]
    first = grouped_split_records(records, seed=123)
    second = grouped_split_records(records, seed=123)
    assert [record.split for record in first] == [record.split for record in second]


def test_all_assigned() -> None:
    records = [make_record(i, f"g{i}", "background") for i in range(5)]
    assert all(record.split in {"train", "validation", "test"} for record in grouped_split_records(records))
