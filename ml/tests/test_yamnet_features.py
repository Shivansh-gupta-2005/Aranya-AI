import numpy as np
import pytest

from aranya_ml.features.yamnet import pool_embedding_frames


def test_embedding_pool_preserves_frame_maximum() -> None:
    frames = np.vstack([np.zeros((1, 1024)), np.ones((1, 1024))])

    pooled = pool_embedding_frames(frames)

    assert pooled.shape == (2048,)
    assert np.allclose(pooled[:1024], 0.5)
    assert np.allclose(pooled[1024:], 1.0)


def test_embedding_pool_rejects_wrong_width() -> None:
    with pytest.raises(ValueError, match="unexpected embedding shape"):
        pool_embedding_frames(np.zeros((2, 10)))
