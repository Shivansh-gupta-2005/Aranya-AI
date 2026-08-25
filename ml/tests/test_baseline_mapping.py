import pytest

from aranya_ml.models.baseline_mapping import (
    AUDIOSET_NUM_CLASSES,
    pool_audioset_scores,
    pool_independent_target_scores,
)


def scores(**values: float) -> list[float]:
    result = [0.0] * AUDIOSET_NUM_CLASSES
    for index, value in values.items():
        result[int(index)] = value
    return result


def test_a0_preserves_normalized_current_mapping() -> None:
    pooled = pool_audioset_scores(scores(**{"421": 0.4, "341": 0.2, "277": 0.4}))

    assert sum(pooled.values()) == pytest.approx(1.0)
    assert pooled["gunshot"] == pytest.approx(0.4)


def test_a1_scores_do_not_compete_with_background() -> None:
    without_background = pool_independent_target_scores(scores(**{"421": 0.4}))
    with_background = pool_independent_target_scores(scores(**{"421": 0.4, "277": 0.9}))

    assert with_background["gunfire"] == pytest.approx(without_background["gunfire"])
    assert set(with_background) == {
        "gunfire",
        "chainsaw",
        "metal_tool_activity",
        "fire",
        "vehicle",
    }


def test_a1_can_report_several_targets() -> None:
    pooled = pool_independent_target_scores(scores(**{"421": 0.7, "341": 0.6}))

    assert pooled["gunfire"] == pytest.approx(0.7)
    assert pooled["chainsaw"] == pytest.approx(0.6)
