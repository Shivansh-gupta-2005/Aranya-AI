from __future__ import annotations
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.manifest import ManifestRecord, grouped_split_records

def make_record(index: int, group: str, label: str) -> ManifestRecord:
    background = label == "background"
    return ManifestRecord(f"f{index}", f"f{index}.wav", label, "forest_ambience" if background else "", "team", "", "team-owned", True, False, group, group, group, "forest", "test", "test", 16000, 1, 5.0, None if background else 1.0, None if background else 2.0, 1.0, "test", "", "")

class GroupSplitTests(unittest.TestCase):
    def test_group_never_crosses_splits(self):
        result = grouped_split_records([make_record(i, f"group-{i // 2}", "background" if i % 2 else "gunshot") for i in range(12)], seed=7)
        groups = {}
        for item in result: groups.setdefault(item.recording_group_id, set()).add(item.split)
        self.assertTrue(all(len(splits) == 1 for splits in groups.values())); self.assertEqual({r.split for r in result}, {"train", "validation", "test"})
    def test_deterministic(self):
        records = [make_record(i, f"group-{i}", "background") for i in range(10)]
        self.assertEqual([r.split for r in grouped_split_records(records, seed=123)], [r.split for r in grouped_split_records(records, seed=123)])
    def test_all_assigned(self): self.assertTrue(all(r.split in {"train", "validation", "test"} for r in grouped_split_records([make_record(i, f"g{i}", "background") for i in range(5)])))

if __name__ == "__main__": unittest.main()
