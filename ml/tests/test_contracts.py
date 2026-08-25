import json
from pathlib import Path

import jsonschema

from aranya_ml.contracts.taxonomy import CONTEXT_CLASSES, TARGET_CLASSES, migrate_legacy_class


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_target_order_matches_shared_taxonomy() -> None:
    taxonomy = json.loads((REPOSITORY_ROOT / "contracts" / "taxonomy.v1.json").read_text())
    assert TARGET_CLASSES == tuple(target["id"] for target in taxonomy["targets"])
    assert CONTEXT_CLASSES == tuple(taxonomy["contextClasses"])


def test_legacy_class_migration() -> None:
    assert migrate_legacy_class("gunshot") == "gunfire"
    assert migrate_legacy_class("fire_anomaly") == "fire"
    assert migrate_legacy_class("chainsaw") == "chainsaw"


def test_detector_output_schema_accepts_independent_scores() -> None:
    schema = json.loads((REPOSITORY_ROOT / "contracts" / "detector-output.v1.schema.json").read_text())
    output = {
        "schemaVersion": "1",
        "inferenceId": "inference-1",
        "modelId": "model-a",
        "modelVersion": "1.0.0",
        "preprocessingId": "yamnet-16khz-v1",
        "startSeconds": 0.0,
        "endSeconds": 0.96,
        "timingPrecision": "exact",
        "scores": {
            "gunfire": 0.8,
            "chainsaw": 0.7,
            "metal_tool_activity": 0.1,
            "fire": 0.2,
            "vehicle": 0.6,
        },
        "detections": [
            {"classId": "gunfire", "score": 0.8, "threshold": 0.75},
            {"classId": "chainsaw", "score": 0.7, "threshold": 0.6},
        ],
    }
    jsonschema.validate(output, schema)
