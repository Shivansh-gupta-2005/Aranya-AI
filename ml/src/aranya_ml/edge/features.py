"""Deterministic spectral features shared with the ESP32 edge model."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class EdgeFeatureConfig:
    sample_rate_hz: int = 16_000
    window_samples: int = 15_360
    fft_size: int = 256
    frame_hop_samples: int = 240
    frame_count: int = 64
    band_count: int = 32

    @property
    def window_seconds(self) -> float:
        return self.window_samples / self.sample_rate_hz


DEFAULT_EDGE_FEATURE_CONFIG = EdgeFeatureConfig()


def iter_fixed_windows(
    audio: np.ndarray, config: EdgeFeatureConfig = DEFAULT_EDGE_FEATURE_CONFIG
) -> Iterator[np.ndarray]:
    """Yield fixed windows with a half-window hop and zero padding."""
    samples = np.asarray(audio, dtype=np.float32).reshape(-1)
    window_samples = config.window_samples
    if len(samples) <= window_samples:
        padded = np.zeros(window_samples, dtype=np.float32)
        padded[: len(samples)] = samples
        yield padded
        return

    hop = window_samples // 2
    last_start = len(samples) - window_samples
    starts = list(range(0, last_start + 1, hop))
    if starts[-1] != last_start:
        starts.append(last_start)
    for start in starts:
        yield samples[start : start + window_samples].astype(np.float32, copy=False)


def extract_edge_spectrogram(
    audio_window: np.ndarray,
    config: EdgeFeatureConfig = DEFAULT_EDGE_FEATURE_CONFIG,
) -> np.ndarray:
    """Return a 64 by 32 log-energy image using firmware-friendly FFT bands."""
    samples = np.asarray(audio_window, dtype=np.float32).reshape(-1)
    if len(samples) != config.window_samples:
        raise ValueError(f"expected {config.window_samples} samples, got {len(samples)}")
    usable_bins = config.band_count * 4
    if usable_bins > config.fft_size // 2:
        raise ValueError("band configuration exceeds the available FFT bins")

    hann = np.hanning(config.fft_size).astype(np.float32)
    features = np.empty((config.frame_count, config.band_count), dtype=np.float32)
    for frame_index in range(config.frame_count):
        start = frame_index * config.frame_hop_samples
        end = start + config.fft_size
        frame = np.zeros(config.fft_size, dtype=np.float32)
        available = samples[start : min(end, len(samples))]
        frame[: len(available)] = available
        spectrum = np.fft.rfft(frame * hann)
        power = np.square(np.abs(spectrum[:usable_bins])).astype(np.float32)
        band_power = power.reshape(config.band_count, 4).sum(axis=1)
        features[frame_index] = np.log1p(band_power)
    return features
