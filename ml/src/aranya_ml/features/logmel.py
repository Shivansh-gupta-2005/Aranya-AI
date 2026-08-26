"""Windowed log-mel features for the local acoustic baseline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np


@dataclass(frozen=True)
class LogMelConfig:
    sample_rate_hz: int = 16_000
    n_fft: int = 512
    hop_length: int = 256
    win_length: int = 512
    n_mels: int = 64
    fmin: int = 40
    fmax: int = 7_600


DEFAULT_LOGMEL_CONFIG = LogMelConfig()


def extract_logmel_summary(
    path: str | Path, config: LogMelConfig = DEFAULT_LOGMEL_CONFIG
) -> np.ndarray:
    audio, _ = librosa.load(path, sr=config.sample_rate_hz, mono=True)
    if not len(audio):
        raise ValueError(f"audio is empty: {path}")
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=config.sample_rate_hz,
        n_fft=config.n_fft,
        hop_length=config.hop_length,
        win_length=config.win_length,
        n_mels=config.n_mels,
        fmin=config.fmin,
        fmax=config.fmax,
        power=2.0,
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)
    return np.concatenate(
        (
            log_mel.mean(axis=1),
            log_mel.std(axis=1),
            log_mel.max(axis=1),
        )
    ).astype(np.float32)
