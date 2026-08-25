"""Fixed-window metadata generation, deliberately after recording-level splitting."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, Iterator
from .manifest import ManifestRecord, THREAT_LABELS

YAMNET_SAMPLE_RATE = 16000; YAMNET_WINDOW_SECONDS = 0.96; YAMNET_HOP_SECONDS = 0.48

@dataclass(frozen=True)
class WindowSpec:
    window_id: str; file_id: str; path: str; label: str; background_subtype: str; recording_group_id: str; split: str; start_seconds: float; end_seconds: float

def _overlap(a: float, b: float, c: float, d: float) -> float: return max(0.0, min(b, d) - max(a, c))

def iter_window_specs(records: Iterable[ManifestRecord], window_seconds: float = YAMNET_WINDOW_SECONDS, hop_seconds: float = YAMNET_HOP_SECONDS, minimum_event_overlap: float = 0.20) -> Iterator[WindowSpec]:
    if window_seconds <= 0 or hop_seconds <= 0 or not 0 <= minimum_event_overlap <= 1: raise ValueError("invalid window parameters")
    for record in records:
        if record.split not in {"train", "validation", "test"}: raise ValueError("records must be split before window generation")
        starts = [0.0]; start = hop_seconds
        while start < record.duration_seconds and start < record.duration_seconds - window_seconds + hop_seconds:
            starts.append(start); start += hop_seconds
        for index, start in enumerate(starts):
            end = min(start + window_seconds, record.duration_seconds)
            if record.label in THREAT_LABELS and record.event_start_seconds is not None and record.event_end_seconds is not None:
                duration = record.event_end_seconds - record.event_start_seconds; center = (record.event_start_seconds + record.event_end_seconds) / 2
                if not (start <= center < end or _overlap(start, end, record.event_start_seconds, record.event_end_seconds) / duration >= minimum_event_overlap): continue
            yield WindowSpec(f"{record.file_id}:w{index:05d}", record.file_id, record.path, record.label, record.background_subtype, record.recording_group_id, record.split, start, end)
