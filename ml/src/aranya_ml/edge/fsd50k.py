"""FSD50K label and license rules for the six-class edge benchmark."""

from __future__ import annotations

from collections.abc import Iterable

TARGET_LABELS = {
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

BACKGROUND_LABELS = {
    "Bird_vocalization_and_bird_call_and_bird_song",
    "Bird",
    "Insect",
    "Rain",
    "Wind",
    "Water",
    "Wild_animals",
    "Animal",
}


def classify_fsd_labels(labels: tuple[str, ...]) -> str | None:
    """Map one FSD50K label set to an unambiguous edge class."""
    values = set(labels)
    # Chainsaw is a specific target. FSD50K often adds its generic Tools parent.
    if "Chainsaw" in values:
        values.discard("Tools")
    matched = [target for target, candidates in TARGET_LABELS.items() if values & candidates]
    if len(matched) > 1:
        return None
    if matched:
        return matched[0]
    if values & BACKGROUND_LABELS:
        return "background"
    return None


def is_allowed_license(license_url: str) -> bool:
    """Allow redistribution-compatible CC0 and CC-BY clip licenses."""
    normalized = license_url.strip().lower()
    if "publicdomain/zero" in normalized or "creativecommons.org/publicdomain/zero" in normalized:
        return True
    return "creativecommons.org/licenses/by/" in normalized


def choose_group_splits(rows: Iterable[tuple[str, str]]) -> dict[str, str]:
    """Assign each uploader to one split, preferring test and validation."""
    priority = {"train": 0, "validation": 1, "test": 2}
    selected: dict[str, str] = {}
    for group, split in rows:
        if split not in priority:
            raise ValueError(f"unknown split: {split}")
        current = selected.get(group)
        if current is None or priority[split] > priority[current]:
            selected[group] = split
    return selected
