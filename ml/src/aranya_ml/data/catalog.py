"""Normalized dataset catalog records and validation."""

from __future__ import annotations

import csv
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TypeVar

from aranya_ml.contracts.taxonomy import TARGET_CLASSES

ANNOTATION_COVERAGE = ("unreviewed", "partial", "complete")
REVIEW_STATUSES = ("needs_review", "provisional", "reviewed")
SPLITS = ("train", "validation", "test")


@dataclass(frozen=True)
class Source:
    source_id: str
    name: str
    url: str
    license: str
    license_verified: bool
    attribution_required: bool


@dataclass(frozen=True)
class Recording:
    recording_id: str
    path: str
    source_id: str
    recording_group_id: str
    session_id: str
    source_identity: str
    location_description: str
    environment_description: str
    microphone: str
    sample_rate_hz: int
    channels: int
    duration_seconds: float
    format: str
    size_bytes: int
    sha256: str
    annotation_coverage: str
    review_status: str
    previous_test_use: bool
    training_eligible: bool
    notes: str


@dataclass(frozen=True)
class Annotation:
    annotation_id: str
    recording_id: str
    class_id: str
    start_seconds: float
    end_seconds: float
    confidence: float
    annotator: str


@dataclass(frozen=True)
class SplitAssignment:
    split_version: str
    recording_group_id: str
    split: str
    frozen: bool


@dataclass(frozen=True)
class Catalog:
    sources: tuple[Source, ...]
    recordings: tuple[Recording, ...]
    annotations: tuple[Annotation, ...]
    splits: tuple[SplitAssignment, ...]


def _boolean(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise ValueError(f"invalid boolean value: {value!r}")


T = TypeVar("T")


def _read_rows(path: Path, record_type: Callable[..., T]) -> tuple[T, ...]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return tuple(record_type(**row) for row in csv.DictReader(handle))


def load_catalog(directory: str | Path) -> Catalog:
    root = Path(directory)
    sources = _read_rows(root / "sources.csv", _source_from_row)
    recordings = _read_rows(root / "recordings.csv", _recording_from_row)
    annotations = _read_rows(root / "annotations.csv", _annotation_from_row)
    splits = _read_rows(root / "splits.csv", _split_from_row)
    return Catalog(sources, recordings, annotations, splits)


def _source_from_row(**row: str) -> Source:
    return Source(
        source_id=row["source_id"],
        name=row["name"],
        url=row["url"],
        license=row["license"],
        license_verified=_boolean(row["license_verified"]),
        attribution_required=_boolean(row["attribution_required"]),
    )


def _recording_from_row(**row: str) -> Recording:
    return Recording(
        recording_id=row["recording_id"],
        path=row["path"],
        source_id=row["source_id"],
        recording_group_id=row["recording_group_id"],
        session_id=row["session_id"],
        source_identity=row["source_identity"],
        location_description=row["location_description"],
        environment_description=row["environment_description"],
        microphone=row["microphone"],
        sample_rate_hz=int(row["sample_rate_hz"]),
        channels=int(row["channels"]),
        duration_seconds=float(row["duration_seconds"]),
        format=row["format"],
        size_bytes=int(row["size_bytes"]),
        sha256=row["sha256"],
        annotation_coverage=row["annotation_coverage"],
        review_status=row["review_status"],
        previous_test_use=_boolean(row["previous_test_use"]),
        training_eligible=_boolean(row["training_eligible"]),
        notes=row["notes"],
    )


def _annotation_from_row(**row: str) -> Annotation:
    return Annotation(
        annotation_id=row["annotation_id"],
        recording_id=row["recording_id"],
        class_id=row["class_id"],
        start_seconds=float(row["start_seconds"]),
        end_seconds=float(row["end_seconds"]),
        confidence=float(row["confidence"]),
        annotator=row["annotator"],
    )


def _split_from_row(**row: str) -> SplitAssignment:
    return SplitAssignment(
        split_version=row["split_version"],
        recording_group_id=row["recording_group_id"],
        split=row["split"],
        frozen=_boolean(row["frozen"]),
    )


def validate_catalog(catalog: Catalog) -> list[str]:
    errors: list[str] = []
    sources = {source.source_id: source for source in catalog.sources}
    recordings = {recording.recording_id: recording for recording in catalog.recordings}
    recording_groups = {recording.recording_group_id for recording in catalog.recordings}
    split_by_group: dict[str, SplitAssignment] = {}

    if len(sources) != len(catalog.sources):
        errors.append("source_id values must be unique")
    if len(recordings) != len(catalog.recordings):
        errors.append("recording_id values must be unique")

    for assignment in catalog.splits:
        key = f"{assignment.split_version}:{assignment.recording_group_id}"
        if key in split_by_group:
            errors.append(f"duplicate split assignment: {key}")
        split_by_group[key] = assignment
        if assignment.split not in SPLITS:
            errors.append(f"invalid split for group {assignment.recording_group_id}")
        if assignment.recording_group_id not in recording_groups:
            errors.append(f"unknown recording group in split: {assignment.recording_group_id}")
        if not assignment.frozen:
            errors.append(f"split assignment must be frozen: {key}")

    annotations_by_recording: dict[str, list[Annotation]] = {}
    seen_annotations: set[str] = set()
    for annotation in catalog.annotations:
        if annotation.annotation_id in seen_annotations:
            errors.append(f"duplicate annotation_id: {annotation.annotation_id}")
        seen_annotations.add(annotation.annotation_id)
        recording = recordings.get(annotation.recording_id)
        if recording is None:
            errors.append(f"annotation references unknown recording: {annotation.recording_id}")
            continue
        annotations_by_recording.setdefault(annotation.recording_id, []).append(annotation)
        if annotation.class_id not in TARGET_CLASSES:
            errors.append(f"unsupported target class: {annotation.class_id}")
        if not 0 <= annotation.confidence <= 1:
            errors.append(f"annotation confidence is outside 0..1: {annotation.annotation_id}")
        if not 0 <= annotation.start_seconds < annotation.end_seconds <= recording.duration_seconds:
            errors.append(
                f"annotation interval is outside the recording: {annotation.annotation_id}"
            )

    for recording in catalog.recordings:
        source = sources.get(recording.source_id)
        if source is None:
            errors.append(f"recording references unknown source: {recording.recording_id}")
        if recording.annotation_coverage not in ANNOTATION_COVERAGE:
            errors.append(f"invalid annotation coverage: {recording.recording_id}")
        if recording.review_status not in REVIEW_STATUSES:
            errors.append(f"invalid review status: {recording.recording_id}")
        if recording.sample_rate_hz <= 0 or recording.channels <= 0:
            errors.append(f"invalid audio shape: {recording.recording_id}")
        if recording.duration_seconds <= 0 or recording.size_bytes <= 0:
            errors.append(f"invalid file metadata: {recording.recording_id}")
        if len(recording.sha256) != 64:
            errors.append(f"invalid sha256: {recording.recording_id}")
        if not recording.training_eligible:
            continue
        if recording.previous_test_use:
            errors.append(f"training recording has previous test use: {recording.recording_id}")
        if recording.annotation_coverage != "complete":
            errors.append(
                f"training recording needs complete annotation coverage: {recording.recording_id}"
            )
        if recording.review_status != "reviewed":
            errors.append(f"training recording needs completed review: {recording.recording_id}")
        if source is not None and (not source.license_verified or not source.license):
            errors.append(f"training recording needs a verified license: {recording.recording_id}")
        assignments = [
            item
            for item in catalog.splits
            if item.recording_group_id == recording.recording_group_id
        ]
        if len(assignments) != 1:
            errors.append(
                f"training recording needs exactly one frozen split: {recording.recording_id}"
            )

    return errors
