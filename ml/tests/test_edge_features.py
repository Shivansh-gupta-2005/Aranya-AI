import numpy as np

from aranya_ml.edge.features import (
    DEFAULT_EDGE_FEATURE_CONFIG,
    extract_edge_spectrogram,
    iter_fixed_windows,
)


def test_short_audio_is_padded_to_one_fixed_window() -> None:
    audio = np.ones(8000, dtype=np.float32)

    windows = list(iter_fixed_windows(audio, DEFAULT_EDGE_FEATURE_CONFIG))

    assert len(windows) == 1
    assert windows[0].shape == (DEFAULT_EDGE_FEATURE_CONFIG.window_samples,)
    assert np.all(windows[0][:8000] == 1.0)
    assert np.all(windows[0][8000:] == 0.0)


def test_long_audio_uses_deterministic_half_window_hops() -> None:
    config = DEFAULT_EDGE_FEATURE_CONFIG
    audio = np.arange(config.window_samples * 2, dtype=np.float32)

    windows = list(iter_fixed_windows(audio, config))

    assert len(windows) == 3
    assert windows[0][0] == 0.0
    assert windows[1][0] == config.window_samples // 2
    assert windows[2][0] == config.window_samples


def test_edge_spectrogram_has_stable_shape_and_zero_floor() -> None:
    config = DEFAULT_EDGE_FEATURE_CONFIG
    features = extract_edge_spectrogram(np.zeros(config.window_samples, dtype=np.float32), config)

    assert features.shape == (config.frame_count, config.band_count)
    assert features.dtype == np.float32
    assert np.all(features == 0.0)


def test_edge_spectrogram_places_a_one_kilohertz_tone_in_expected_band() -> None:
    config = DEFAULT_EDGE_FEATURE_CONFIG
    time = np.arange(config.window_samples, dtype=np.float32) / config.sample_rate_hz
    audio = np.sin(2.0 * np.pi * 1000.0 * time).astype(np.float32)

    features = extract_edge_spectrogram(audio, config)
    strongest_band = int(np.argmax(features.mean(axis=0)))

    assert strongest_band in {3, 4}
