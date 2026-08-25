from __future__ import annotations
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.manifest import ManifestRecord, validate_records

def record(**changes: object) -> ManifestRecord:
    values = dict(file_id="f1", path="audio/f1.wav", label="background", background_subtype="forest_ambience", source_name="team", source_url="", license="team-owned", license_verified=True, attribution_required=False, recording_group_id="group-1", session_id="session-1", source_identity="operator-1", location_description="forest", environment_description="quiet", microphone="INMP441", sample_rate_hz=16000, channels=1, duration_seconds=10.0, event_start_seconds=None, event_end_seconds=None, annotation_confidence=1.0, annotator="annotator", split="", notes="")
    values.update(changes); return ManifestRecord(**values)

class ManifestTests(unittest.TestCase):
    def test_valid_background(self): self.assertEqual(validate_records([record()]), [])
    def test_duplicate_ids(self): self.assertTrue(any("duplicate file_id" in e for e in validate_records([record(), record(recording_group_id="group-2")])) )
    def test_background_subtype_required(self): self.assertTrue(any("background requires" in e for e in validate_records([record(background_subtype="")])) )
    def test_threat_interval_required(self): self.assertTrue(any("annotated event interval" in e for e in validate_records([record(label="gunshot", background_subtype="")])) )
    def test_invalid_interval(self): self.assertTrue(any("event interval" in e for e in validate_records([record(event_start_seconds=8.0, event_end_seconds=12.0)])) )

if __name__ == "__main__": unittest.main()
