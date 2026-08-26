"""Audio inventory helpers for the Aranya dataset workspace.

Only files below an explicitly supplied dataset root should be inventoried.
Dependency, build, and test-data directories are pruned before audio files
are considered, so incidental WAV files cannot become dataset candidates.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

AUDIO_SUFFIXES = frozenset({".wav", ".flac", ".mp3", ".ogg", ".m4a", ".aac"})

# Repository-specific conversion/build trees that are never dataset sources.
EXCLUDED_DATASET_DIRECTORIES = frozenset(
    {
        "tfjs-converter",
        "yamnet-convert",
        "node_modules",
    }
)

# Common Python/Node dependency and generated-data directory names. Keep this
# list case-insensitive because inventories may be run on different platforms.
DEPENDENCY_DIRECTORIES = frozenset(
    {
        "site-packages",
        "dist-packages",
        "__pycache__",
        ".venv",
        "venv",
        "virtualenv",
        "pip-wheel-metadata",
        ".npm",
        ".yarn",
        "bower_components",
    }
)


def is_excluded_directory(name: str) -> bool:
    """Return whether a directory name is unsafe as a dataset source."""

    return name.casefold() in EXCLUDED_DATASET_DIRECTORIES | DEPENDENCY_DIRECTORIES


def iter_audio_files(root: str | Path) -> Iterator[Path]:
    """Yield audio files below *root*, pruning dependency trees in-place."""

    root_path = Path(root)
    for directory, directory_names, file_names in os.walk(root_path):
        directory_names[:] = sorted(
            name for name in directory_names if not is_excluded_directory(name)
        )
        for file_name in sorted(file_names):
            path = Path(directory) / file_name
            if path.suffix.casefold() in AUDIO_SUFFIXES:
                yield path
