"""Exact Python mirror of the current TypeScript AudioSet mapping."""
from __future__ import annotations

AUDIOSET_NUM_CLASSES = 521
CURRENT_ARANYA_CLASSES = ("chainsaw", "vehicle", "wildlife", "background", "gunshot", "tree_fall", "fire_anomaly", "metal_clank")
AUDIOSET_TO_ARANYA = {
    "chainsaw": [341, 415], "vehicle": [294, 300, 301, 302, 304, 305, 308, 309, 310, 312, 314, 316, 317, 319, 320, 321, 323, 324, 325, 326, 327, 330, 331, 337, 338, 342, 343, 344, 345],
    "wildlife": [67, 68, 81, 103, 106, 107, 116, 121, 127], "background": [277, 278, 279, 280, 281, 283, 284, 285, 286, 481, 494, 507, 508, 514, 515],
    "gunshot": [421, 422, 423, 424, 427], "tree_fall": [431, 432, 433, 434, 454, 463, 464], "fire_anomaly": [292, 293], "metal_clank": [478, 483],
}
FIRE_ALARM_CORROBORATION_INDICES = [393, 394]; FIRE_ALARM_CORROBORATION_WEIGHT = 0.35

def pool_audioset_scores(raw_scores: list[float]) -> dict[str, float]:
    if len(raw_scores) != AUDIOSET_NUM_CLASSES: raise ValueError(f"expected {AUDIOSET_NUM_CLASSES} scores")
    pooled = {label: sum(float(raw_scores[i]) for i in indices) for label, indices in AUDIOSET_TO_ARANYA.items()}
    pooled["fire_anomaly"] += FIRE_ALARM_CORROBORATION_WEIGHT * sum(float(raw_scores[i]) for i in FIRE_ALARM_CORROBORATION_INDICES)
    total = sum(pooled.values()); return {label: (pooled[label] / total if total else 0.0) for label in CURRENT_ARANYA_CLASSES}

def current_to_experiment_label(current_label: str) -> str: return {"gunshot": "gunshot", "chainsaw": "chainsaw_logging", "metal_clank": "metal_tool_activity"}.get(current_label, "background")

def predict_baseline(raw_scores: list[float]) -> dict[str, object]:
    pooled = pool_audioset_scores(raw_scores); current = max(pooled, key=pooled.get)
    return {"label": current_to_experiment_label(current), "confidence": pooled[current], "current_label": current}
