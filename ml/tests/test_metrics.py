from aranya_ml.evaluation.metrics import (
    DetectionEpisode,
    classification_metrics,
    count_false_positive_episodes,
    false_positive_episodes_per_background_hour,
)

def test_classification_metrics() -> None:
    result = classification_metrics(["a", "a", "b", "b"], ["a", "b", "b", "b"], ["a", "b"])
    assert result["confusion_matrix"] == [[1, 1], [0, 2]]
    assert result["macro_recall"] == 0.75


def test_false_positive_episode_merging() -> None:
    episodes = [
        DetectionEpisode(0, 0.4, True),
        DetectionEpisode(0.8, 1.2, True),
        DetectionEpisode(5, 5.4, True),
        DetectionEpisode(8, 8.4, False),
    ]
    assert count_false_positive_episodes(episodes) == 2
    assert false_positive_episodes_per_background_hour(episodes, 3600) == 2.0
