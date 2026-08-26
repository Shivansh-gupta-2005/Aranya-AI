"""Pilot manifest loading, multi-label mapping, and data audits."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any


TARGET_ORDER = ("gunfire", "chainsaw", "metal_tool_activity", "fire", "vehicle")
KNOWN_CLASSES = (*TARGET_ORDER, "background")
VALID_SPLITS = ("train", "validation", "test")
MIN_TEST_GROUPS_PER_TARGET = 100

FSD_TARGET_LABELS = {
    "gunfire": {"Gunshot_and_gunfire"},
    "chainsaw": {"Chainsaw"},
    "metal_tool_activity": {"Drill", "Sawing", "Power_tool", "Hammer", "Tools"},
    "fire": {"Fire", "Crackle"},
    "vehicle": {
        "Motor_vehicle_(road)",
        "Vehicle",
        "Car_passing_by",
        "Accelerating_and_revving_and_vroom",
        "Engine_starting",
        "Engine",
        "Motorcycle",
        "Truck",
        "Car",
    },
}

REQUIRED_FIELDS = {
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
}


@dataclass(frozen=True)
class PilotRow:
    recording_id: str
    source_id: str
    path: Path
    recording_group_id: str
    session_id: str
    class_id: str
    split: str
    duration_seconds: float
    annotation_coverage: str
    review_status: str
    training_eligible: bool
    source_labels: tuple[str, ...]
    targets: tuple[int, ...]


def _parse_bool(value: str, field: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f"{field} must be True or False")
    return normalized == "true"


def _resolve_audio_path(raw_path: str, manifest_path: Path) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute() and candidate.is_file():
        return candidate.resolve()
    search_roots = (Path.cwd(), manifest_path.parent, *manifest_path.parents)
    for root in search_roots:
        resolved = (root / candidate).resolve()
        if resolved.is_file():
            return resolved
    raise ValueError(f"audio file does not exist: {raw_path}")


def _targets_for(source_id: str, class_id: str, source_labels: tuple[str, ...]) -> tuple[int, ...]:
    if class_id == "background":
        return (0,) * len(TARGET_ORDER)
    matched: set[str] = set()
    if source_id == "fsd50k":
        labels = set(source_labels)
        matched = {
            target for target, candidates in FSD_TARGET_LABELS.items() if labels & candidates
        }
    if not matched:
        matched.add(class_id)
    return tuple(int(target in matched) for target in TARGET_ORDER)


def load_pilot_manifest(path: str | Path, allow_provisional: bool) -> list[PilotRow]:
    manifest_path = Path(path).resolve()
    with manifest_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_FIELDS - set(reader.fieldnames or ())
        if missing:
            raise ValueError(f"manifest missing fields: {', '.join(sorted(missing))}")
        raw_rows = list(reader)

    rows: list[PilotRow] = []
    seen_ids: set[str] = set()
    for line_number, raw in enumerate(raw_rows, start=2):
        recording_id = raw["recording_id"].strip()
        if not recording_id:
            raise ValueError(f"line {line_number}: recording_id is required")
        if recording_id in seen_ids:
            raise ValueError(f"line {line_number}: duplicate recording_id {recording_id}")
        seen_ids.add(recording_id)
        class_id = raw["class_id"].strip()
        if class_id not in KNOWN_CLASSES:
            raise ValueError(f"line {line_number}: unknown class_id {class_id}")
        split = raw["split"].strip()
        if split not in VALID_SPLITS:
            raise ValueError(f"line {line_number}: unknown split {split}")
        review_status = raw["review_status"].strip()
        if review_status != "reviewed" and not allow_provisional:
            continue
        coverage = raw["annotation_coverage"].strip()
        if coverage != "complete" and not allow_provisional:
            continue
        source_labels = tuple(
            label.strip() for label in raw["source_labels"].split(",") if label.strip()
        )
        rows.append(
            PilotRow(
                recording_id=recording_id,
                source_id=raw["source_id"].strip(),
                path=_resolve_audio_path(raw["path"], manifest_path),
                recording_group_id=raw["recording_group_id"].strip(),
                session_id=raw["session_id"].strip(),
                class_id=class_id,
                split=split,
                duration_seconds=float(raw["duration_seconds"]),
                annotation_coverage=coverage,
                review_status=review_status,
                training_eligible=_parse_bool(raw["training_eligible"], "training_eligible"),
                source_labels=source_labels,
                targets=_targets_for(raw["source_id"].strip(), class_id, source_labels),
            )
        )
    return rows


def validate_split_groups(rows: Sequence[PilotRow]) -> list[str]:
    group_splits: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        group_splits[row.recording_group_id].add(row.split)
    return [
        f"recording group {group} crosses splits: {', '.join(sorted(splits))}"
        for group, splits in sorted(group_splits.items())
        if len(splits) > 1
    ]


def audit_pilot_rows(rows: Sequence[PilotRow]) -> dict[str, object]:
    positive_groups = {
        split: {target: set() for target in TARGET_ORDER} for split in VALID_SPLITS
    }
    row_counts = {split: 0 for split in VALID_SPLITS}
    source_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    provisional_rows = 0
    for row in rows:
        row_counts[row.split] += 1
        source_counts[row.split][row.source_id] += 1
        provisional_rows += int(
            row.review_status != "reviewed" or row.annotation_coverage != "complete"
        )
        for index, target in enumerate(TARGET_ORDER):
            if row.targets[index]:
                positive_groups[row.split][target].add(row.recording_group_id)

    positive_group_counts = {
        split: {target: len(groups) for target, groups in targets.items()}
        for split, targets in positive_groups.items()
    }
    split_errors = validate_split_groups(rows)
    support_ready = all(
        positive_group_counts["test"][target] >= MIN_TEST_GROUPS_PER_TARGET
        for target in TARGET_ORDER
    )
    return {
        "rows": len(rows),
        "row_counts": row_counts,
        "source_counts": {
            split: dict(sorted(counts.items())) for split, counts in source_counts.items()
        },
        "positive_groups": positive_group_counts,
        "split_errors": split_errors,
        "provisional_rows": provisional_rows,
        "release_eligible": not split_errors and not provisional_rows and support_ready,
    }


def pilot_fingerprint(rows: Sequence[PilotRow]) -> str:
    serialized: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda item: item.recording_id):
        stat = row.path.stat() if row.path.is_file() else None
        serialized.append(
            {
                "recording_id": row.recording_id,
                "source_id": row.source_id,
                "path": str(row.path),
                "size": stat.st_size if stat else None,
                "mtime_ns": stat.st_mtime_ns if stat else None,
                "recording_group_id": row.recording_group_id,
                "split": row.split,
                "targets": row.targets,
                "review_status": row.review_status,
                "annotation_coverage": row.annotation_coverage,
                "training_eligible": row.training_eligible,
            }
        )
    payload = json.dumps(serialized, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()
