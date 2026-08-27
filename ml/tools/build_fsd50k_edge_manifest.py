"""Build a group-safe six-class edge manifest from FSD50K."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import soundfile as sf

from aranya_ml.edge.fsd50k import (
    choose_group_splits,
    classify_fsd_labels,
    is_allowed_license,
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


def _read_ground_truth(path: Path, default_split: str) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["split"] = row.get("split") or default_split
        if row["split"] == "val":
            row["split"] = "validation"
    return rows


def _load_metadata(path: Path) -> dict[str, dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def _audio_path(audio_root: Path, subset: str, clip_id: str) -> Path:
    directory = "FSD50K.dev_audio" if subset == "dev" else "FSD50K.eval_audio"
    return (audio_root / subset / directory / f"{clip_id}.wav").resolve()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata-root", type=Path, required=True)
    parser.add_argument("--audio-root", type=Path, required=True)
    parser.add_argument("--base-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    ground_truth_root = args.metadata_root / "FSD50K.ground_truth"
    metadata_root = args.metadata_root / "FSD50K.metadata"
    source_rows: list[tuple[str, dict[str, str], dict[str, Any]]] = []
    for subset, default_split in (("dev", "train"), ("eval", "test")):
        ground_truth = _read_ground_truth(ground_truth_root / f"{subset}.csv", default_split)
        metadata = _load_metadata(metadata_root / f"{subset}_clips_info_FSD50K.json")
        for row in ground_truth:
            source_rows.append((subset, row, metadata[row["fname"]]))

    candidates: list[tuple[str, dict[str, str], dict[str, Any], str, str]] = []
    exclusions: list[dict[str, str]] = []
    for subset, row, clip_metadata in source_rows:
        labels = tuple(item.strip() for item in row["labels"].split(",") if item.strip())
        target = classify_fsd_labels(labels)
        license_url = str(clip_metadata.get("license", ""))
        uploader = str(clip_metadata.get("uploader", "")).strip() or f"unknown:{row['fname']}"
        reason = ""
        if target is None:
            reason = "unmapped_or_ambiguous_labels"
        elif not is_allowed_license(license_url):
            reason = "license_not_allowed"
        if reason:
            exclusions.append({"fname": row["fname"], "reason": reason})
            continue
        candidates.append((subset, row, clip_metadata, target, uploader))

    group_splits = choose_group_splits(
        (uploader, row["split"]) for _, row, _, _, uploader in candidates
    )
    output_rows: list[dict[str, object]] = []
    for subset, row, _, target, uploader in candidates:
        audio_path = _audio_path(args.audio_root, subset, row["fname"])
        if not audio_path.is_file():
            raise FileNotFoundError(audio_path)
        output_rows.append(
            {
                "recording_id": f"fsd50k:{row['fname']}",
                "source_id": "fsd50k",
                "path": str(audio_path),
                "recording_group_id": f"fsd50k:uploader:{uploader}",
                "session_id": f"fsd50k:uploader:{uploader}",
                "class_id": target,
                "split": group_splits[uploader],
                "duration_seconds": round(float(sf.info(audio_path).duration), 6),
                "annotation_coverage": "complete",
                "review_status": "reviewed",
                "training_eligible": True,
                "source_labels": row["labels"],
            }
        )

    with args.base_manifest.open("r", encoding="utf-8", newline="") as handle:
        base_rows = list(csv.DictReader(handle))
    base_rows = [row for row in base_rows if row["source_id"] != "fsd50k"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows([*base_rows, *output_rows])
    exclusion_path = args.output.with_name("fsd50k_excluded.csv")
    with exclusion_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=("fname", "reason"))
        writer.writeheader()
        writer.writerows(exclusions)
    print(
        json.dumps(
            {
                "base_rows": len(base_rows),
                "fsd50k_rows": len(output_rows),
                "excluded": len(exclusions),
                "output": str(args.output),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
