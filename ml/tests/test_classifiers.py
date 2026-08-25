import numpy as np

from aranya_ml.models.classifiers import (
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
