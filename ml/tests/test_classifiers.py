import numpy as np
import pytest

from aranya_ml.models.classifiers import (
    fit_independent_logistic,
    fit_independent_mlp,
    fit_one_vs_rest_logistic,
    predict_target_scores,
)


def test_logistic_classifier_returns_independent_target_scores() -> None:
    features = np.array(
        [
            [0.0, 0.0],
            [0.0, 1.0],
            [1.0, 0.0],
            [1.0, 1.0],
            [0.1, 0.2],
            [0.2, 0.9],
            [0.9, 0.2],
            [0.8, 0.8],
        ]
    )
    targets = (features >= 0.5).astype(int)

    model = fit_one_vs_rest_logistic(features, targets, seed=7)
    scores = predict_target_scores(model, np.array([[0.9, 0.9], [0.1, 0.1]]))

    assert scores.shape == (2, 2)
    assert np.all((scores >= 0) & (scores <= 1))
    assert scores[0, 0] > scores[1, 0]
    assert scores[0, 1] > scores[1, 1]


def five_target_data() -> tuple[np.ndarray, np.ndarray]:
    random = np.random.default_rng(7)
    features = random.normal(size=(80, 5))
    targets = (features > 0).astype(int)
    return features, targets


@pytest.mark.parametrize("trainer", [fit_independent_logistic, fit_independent_mlp])
def test_independent_classifier_returns_five_scores(trainer) -> None:
    features, targets = five_target_data()

    model = trainer(features, targets, seed=7)
    scores = model.predict_proba(features[:3])

    assert scores.shape == (3, 5)
    assert np.all((scores >= 0.0) & (scores <= 1.0))


def test_independent_classifier_rejects_constant_target() -> None:
    features, targets = five_target_data()
    targets[:, 0] = 0

    with pytest.raises(ValueError, match="target 0 needs positive and negative training examples"):
        fit_independent_logistic(features, targets)
