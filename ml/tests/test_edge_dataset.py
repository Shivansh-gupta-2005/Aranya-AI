import numpy as np

from aranya_ml.edge.dataset import (
    aggregate_recording_probabilities,
    balanced_class_indices,
    predict_with_background,
    select_target_thresholds,
)


def test_balanced_indices_oversample_each_class_to_same_count() -> None:
    labels = np.array([0, 0, 0, 1, 2, 2])

    indices = balanced_class_indices(labels, samples_per_class=4, seed=7)

    selected = labels[indices]
    assert len(indices) == 12
    assert np.bincount(selected, minlength=3).tolist() == [4, 4, 4]


def test_balanced_indices_are_deterministic_for_seed() -> None:
    labels = np.array([0, 0, 1, 1])

    first = balanced_class_indices(labels, samples_per_class=3, seed=42)
    second = balanced_class_indices(labels, samples_per_class=3, seed=42)

    assert first.tolist() == second.tolist()


def test_recording_probabilities_average_windows_and_keep_labels() -> None:
    recording_ids = np.array(["a", "a", "b"])
    labels = np.array([1, 1, 0])
    probabilities = np.array([[0.2, 0.8], [0.4, 0.6], [0.9, 0.1]])

    ids, recording_labels, recording_probabilities = aggregate_recording_probabilities(
        recording_ids, labels, probabilities
    )

    assert ids.tolist() == ["a", "b"]
    assert recording_labels.tolist() == [1, 0]
    assert np.allclose(recording_probabilities, [[0.3, 0.7], [0.9, 0.1]])


def test_recording_probabilities_average_top_windows_per_class() -> None:
    recording_ids = np.array(["a", "a", "a"])
    labels = np.array([1, 1, 1])
    probabilities = np.array([[0.9, 0.1], [0.7, 0.3], [0.1, 0.9]])

    _, _, recording_probabilities = aggregate_recording_probabilities(
        recording_ids,
        labels,
        probabilities,
        top_k=2,
    )

    assert np.allclose(recording_probabilities, [[0.8, 0.6]])


def test_recording_aggregation_rejects_conflicting_window_labels() -> None:
    recording_ids = np.array(["a", "a"])
    labels = np.array([0, 1])
    probabilities = np.array([[0.8, 0.2], [0.2, 0.8]])

    try:
        aggregate_recording_probabilities(recording_ids, labels, probabilities)
    except ValueError as error:
        assert "conflicting labels" in str(error)
    else:
        raise AssertionError("expected conflicting labels to fail")


def test_threshold_prediction_falls_back_to_background() -> None:
    probabilities = np.array(
        [
            [0.55, 0.20, 0.25],
            [0.65, 0.75, 0.05],
        ]
    )

    predicted = predict_with_background(
        probabilities,
        thresholds=np.array([0.60, 0.70]),
        background_index=2,
    )

    assert predicted.tolist() == [2, 1]


def test_target_thresholds_are_selected_from_validation_labels() -> None:
    truth = np.array([0, 0, 1, 2, 2])
    probabilities = np.array(
        [
            [0.90, 0.05, 0.05],
            [0.55, 0.10, 0.35],
            [0.10, 0.80, 0.10],
            [0.40, 0.10, 0.50],
            [0.20, 0.10, 0.70],
        ]
    )

    thresholds = select_target_thresholds(
        truth,
        probabilities,
        background_index=2,
        grid=(0.30, 0.50, 0.70),
    )

    assert np.allclose(thresholds, [0.5, 0.7])
