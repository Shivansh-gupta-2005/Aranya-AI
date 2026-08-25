"""Manifest records, validation, and deterministic recording-group splitting."""
from __future__ import annotations

import csv
import random
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Iterable, Optional, Sequence

EXPERIMENT_LABELS = ("gunshot", "chainsaw_logging", "metal_tool_activity", "background")
INVENTORY_LABELS = EXPERIMENT_LABELS + ("fire", "mixed_event", "unknown_mixed")
THREAT_LABELS = ("gunshot", "chainsaw_logging", "metal_tool_activity")
BACKGROUND_SUBTYPES = ("forest_ambience", "birds_animals", "wind", "rain", "vehicles", "machinery", "human_movement", "generic_impacts", "other_environmental_noise")
SPLITS = ("", "train", "validation", "test")
REQUIRED_COLUMNS = ("file_id", "path", "label", "background_subtype", "source_name", "source_url", "license", "license_verified", "attribution_required", "recording_group_id", "session_id", "source_identity", "location_description", "environment_description", "microphone", "sample_rate_hz", "channels", "duration_seconds", "format", "size_bytes", "sha256", "event_start_seconds", "event_end_seconds", "annotation_confidence", "annotator", "split", "training_eligible", "previous_test_use", "notes")


@dataclass(frozen=True)
class ManifestRecord:
    file_id: str; path: str; label: str; background_subtype: str
    source_name: str; source_url: str; license: str; license_verified: bool
    attribution_required: bool; recording_group_id: str; session_id: str
    source_identity: str; location_description: str; environment_description: str
    microphone: str; sample_rate_hz: int; channels: int; duration_seconds: float
    event_start_seconds: Optional[float]; event_end_seconds: Optional[float]
    annotation_confidence: float; annotator: str; split: str = ""; format: str = ""; size_bytes: int = 0; sha256: str = ""; training_eligible: bool = False; previous_test_use: bool = True; notes: str = ""

    @classmethod
    def from_row(cls, row: dict[str, str]) -> "ManifestRecord":
        def optional_float(value: str) -> Optional[float]:
            return None if not value or not value.strip() else float(value)
        def boolean(value: str) -> bool:
            value = value.strip().lower()
            if value in {"true", "1", "yes"}: return True
            if value in {"false", "0", "no"}: return False
            raise ValueError(f"invalid boolean value: {value!r}")
        return cls(
            file_id=row.get("file_id", "").strip(), path=row.get("path", "").strip(), label=row.get("label", "").strip(), background_subtype=row.get("background_subtype", "").strip(),
            source_name=row.get("source_name", "").strip() or "Aranya team recorded", source_url=row.get("source_url", "").strip(), license=row.get("license", "").strip(), license_verified=boolean(row.get("license_verified", "")), attribution_required=boolean(row.get("attribution_required", "")),
            recording_group_id=row.get("recording_group_id", "").strip(), session_id=row.get("session_id", "").strip(), source_identity=row.get("source_identity", "").strip(), location_description=row.get("location_description", "").strip(), environment_description=row.get("environment_description", "").strip(), microphone=row.get("microphone", "").strip(),
            sample_rate_hz=int(row.get("sample_rate_hz", "0")), channels=int(row.get("channels", "0")), duration_seconds=float(row.get("duration_seconds", "0")), event_start_seconds=optional_float(row.get("event_start_seconds", "")), event_end_seconds=optional_float(row.get("event_end_seconds", "")), annotation_confidence=float(row.get("annotation_confidence", "-1")), annotator=row.get("annotator", "").strip(), split=row.get("split", "").strip(), format=row.get("format", "").strip(), size_bytes=int(row.get("size_bytes", "0")), sha256=row.get("sha256", "").strip(), training_eligible=boolean(row.get("training_eligible", "false")), previous_test_use=boolean(row.get("previous_test_use", "true")), notes=row.get("notes", "").strip(),
        )

    def to_row(self) -> dict[str, object]:
        row = asdict(self)
        row["event_start_seconds"] = "" if self.event_start_seconds is None else self.event_start_seconds
        row["event_end_seconds"] = "" if self.event_end_seconds is None else self.event_end_seconds
        row["license_verified"] = str(self.license_verified).lower()
        row["attribution_required"] = str(self.attribution_required).lower()
        return row


def load_manifest(path: str | Path) -> list[ManifestRecord]:
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError("manifest has no header")
        missing = [field for field in REQUIRED_COLUMNS if field not in reader.fieldnames]
        if missing: raise ValueError(f"manifest missing columns: {', '.join(missing)}")
        records = []
        for line, row in enumerate(reader, start=2):
            try: records.append(ManifestRecord.from_row(row))
            except (TypeError, ValueError) as exc: raise ValueError(f"invalid manifest row {line}: {exc}") from exc
        return records


def validate_records(records: Iterable[ManifestRecord], check_paths: bool = False, require_splits: bool = False, manifest_dir: str | Path | None = None) -> list[str]:
    errors: list[str] = []; seen: set[str] = set(); root = Path(manifest_dir) if manifest_dir else None
    for number, record in enumerate(records, start=1):
        prefix = f"row {number}"
        if not record.file_id: errors.append(f"{prefix}: file_id is required")
        if record.file_id in seen: errors.append(f"{prefix}: duplicate file_id {record.file_id!r}")
        seen.add(record.file_id)
        if not record.path: errors.append(f"{prefix}: path is required")
        elif check_paths and root is not None:
            path = Path(record.path) if Path(record.path).is_absolute() else root / record.path
            if not path.is_file(): errors.append(f"{prefix}: audio path does not exist: {record.path}")
        if record.label not in INVENTORY_LABELS: errors.append(f"{prefix}: unsupported label {record.label!r}")
        if record.label == "background" and record.background_subtype not in BACKGROUND_SUBTYPES: errors.append(f"{prefix}: background requires a valid background_subtype")
        if record.label != "background" and record.background_subtype: errors.append(f"{prefix}: threat records must leave background_subtype empty")
        for field in ("source_name", "license", "recording_group_id", "session_id", "source_identity", "microphone", "annotator"):
            if not getattr(record, field): errors.append(f"{prefix}: {field} is required")
        if not record.license_verified: errors.append(f"{prefix}: license must be verified before use")
        if record.sample_rate_hz <= 0 or record.channels <= 0 or record.duration_seconds <= 0: errors.append(f"{prefix}: audio metadata must be positive")
        if not record.format or record.size_bytes <= 0 or len(record.sha256) != 64: errors.append(f"{prefix}: technical file metadata is required")
        if record.training_eligible and record.previous_test_use: errors.append(f"{prefix}: previous-test recordings cannot be training eligible")
        if not 0 <= record.annotation_confidence <= 1: errors.append(f"{prefix}: annotation_confidence must be between 0 and 1")
        if record.split not in SPLITS or (require_splits and not record.split): errors.append(f"{prefix}: invalid or missing split")
        start, end = record.event_start_seconds, record.event_end_seconds
        if (start is None) != (end is None): errors.append(f"{prefix}: event start/end must be provided together")
        if start is not None and end is not None and (start < 0 or end <= start or end > record.duration_seconds): errors.append(f"{prefix}: event interval must satisfy 0 <= start < end <= duration")
        if record.label in THREAT_LABELS and (start is None or end is None): errors.append(f"{prefix}: threat records require an annotated event interval")
    return errors


def write_manifest(path: str | Path, records: Sequence[ManifestRecord]) -> None:
    with Path(path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REQUIRED_COLUMNS); writer.writeheader(); writer.writerows(record.to_row() for record in records)


def grouped_split_records(records: Sequence[ManifestRecord], ratios: tuple[float, float, float] = (0.70, 0.15, 0.15), seed: int = 20260823) -> list[ManifestRecord]:
    """Assign each complete recording group to exactly one split; small data is not rejected."""
    if len(ratios) != 3 or any(value <= 0 for value in ratios) or abs(sum(ratios) - 1) > 1e-6: raise ValueError("ratios must be three positive values summing to 1")
    groups: dict[str, list[ManifestRecord]] = {}
    for record in records: groups.setdefault(record.recording_group_id, []).append(record)
    rng = random.Random(seed); items = list(groups.items()); rng.shuffle(items); items.sort(key=lambda item: -len(item[1]))
    names = ("train", "validation", "test"); targets = {name: max(ratio * len(items), 1e-9) for name, ratio in zip(names, ratios)}; counts = {name: 0 for name in names}; assignments = {}
    for group_id, group in items:
        def score(name: str) -> float: return counts[name] / targets[name]
        chosen = min(names, key=lambda name: (score(name), names.index(name))); assignments[group_id] = chosen; counts[chosen] += 1
    return [replace(record, split=assignments[record.recording_group_id]) for record in records]
