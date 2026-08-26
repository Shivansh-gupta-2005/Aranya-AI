from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from aranya_ml.features.logmel import extract_logmel_summary


@pytest.mark.filterwarnings("ignore::DeprecationWarning:audioread.rawread")
def test_logmel_summary_keeps_short_event_maximum(tmp_path: Path) -> None:
    sample_rate = 16_000
    random = np.random.default_rng(7)
    audio = random.normal(0.0, 0.0001, sample_rate * 2).astype(np.float32)
    burst_start = sample_rate
    burst_length = sample_rate // 10
    time = np.arange(burst_length) / sample_rate
    burst = 0.8 * np.sin(2 * np.pi * 1000 * time)
    audio[burst_start : burst_start + burst_length] += burst.astype(np.float32)
    path = tmp_path / "burst.wav"
    sf.write(path, audio, sample_rate)

    result = extract_logmel_summary(path)

    assert result.shape == (192,)
    mean, deviation, maximum = np.split(result, 3)
    assert np.all(maximum >= mean)
    assert np.any(maximum > mean + deviation)
    assert result.dtype == np.float32
