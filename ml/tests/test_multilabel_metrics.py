import numpy as np
import pytest

from aranya_ml.evaluation.multilabel import (
    evaluate_multilabel,
    select_f1_thresholds,
    select_f2_thresholds,
)


def test_threshold_selection_uses_each_target_independently() -> None:
    truth = np.array([[1, 0], [1, 0], [0, 1], [0, 1]])
    scores = np.array([[0.8, 0.1], [0.6, 0.2], [0.4, 0.9], [0.3, 0.7]])

    thresholds = select_f2_thresholds(truth, scores, grid=(0.5, 0.75))

    assert thresholds.tolist() == [0.5, 0.5]


def test_f1_threshold_selection_is_available_for_f1_reporting() -> None:
    truth = np.array([[1], [1], [0], [0]])
    scores = np.array([[0.9], [0.4], [0.3], [0.2]])

    thresholds = select_f1_thresholds(truth, scores, grid=(0.3, 0.5, 0.8))

    assert thresholds.tolist() == [0.3]


def test_threshold_selection_rejects_target_without_positives() -> None:
    truth = np.array([[1, 0], [0, 0]])
    scores = np.array([[0.8, 0.2], [0.1, 0.3]])

    with pytest.raises(ValueError, match="target 1 has no positive validation examples"):
        select_f2_thresholds(truth, scores)


def test_multilabel_report_contains_per_target_and_macro_metrics() -> None:
    truth = np.array([[1, 0], [0, 1], [1, 1]])
    scores = np.array([[0.9, 0.1], [0.2, 0.8], [0.7, 0.6]])

    result = evaluate_multilabel(
        truth,
        scores,
        np.array([0.5, 0.5]),
        target_names=("a", "b"),
    )

    assert result["macro_f1"] == 1.0
    assert result["micro_f1"] == 1.0
    assert result["subset_accuracy"] == 1.0
    assert result["per_class"]["a"]["pr_auc"] == 1.0
    assert result["per_class"]["b"]["confusion_matrix"] == [[1, 0], [0, 2]]


def test_multilabel_report_rejects_wrong_threshold_count() -> None:
    truth = np.array([[1, 0], [0, 1]])
    scores = np.array([[0.8, 0.2], [0.1, 0.9]])

    with pytest.raises(ValueError, match="threshold count does not match target count"):
        evaluate_multilabel(truth, scores, np.array([0.5]), target_names=("a", "b"))
