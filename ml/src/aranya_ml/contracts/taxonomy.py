"""Canonical detector taxonomy loaded from the shared repository contract."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Final


CONTRACT_PATH: Final = Path(__file__).resolve().parents[4] / "contracts" / "taxonomy.v1.json"


def _load_taxonomy() -> dict[str, object]:
    payload = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != "1":
        raise ValueError("unsupported taxonomy schema version")
    return payload


_TAXONOMY = _load_taxonomy()
TARGET_CLASSES: Final = tuple(target["id"] for target in _TAXONOMY["targets"])
CONTEXT_CLASSES: Final = tuple(_TAXONOMY["contextClasses"])
LEGACY_MAPPINGS: Final = dict(_TAXONOMY["legacyMappings"])


def migrate_legacy_class(class_id: str) -> str:
    """Return the canonical class ID for current and legacy browser values."""

    return str(LEGACY_MAPPINGS.get(class_id, class_id))
