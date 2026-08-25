from __future__ import annotations
import argparse
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.manifest import load_manifest, validate_records

def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an Aranya recording manifest.")
    parser.add_argument("--manifest", required=True); parser.add_argument("--check-paths", action="store_true"); parser.add_argument("--require-splits", action="store_true")
    args = parser.parse_args(); path = Path(args.manifest); records = load_manifest(path)
    errors = validate_records(records, args.check_paths, args.require_splits, path.parent)
    if errors:
        print("Manifest invalid:\n" + "\n".join(f"- {error}" for error in errors)); return 1
    print(f"Valid records: {len(records)}"); print(f"Recording groups: {len({r.recording_group_id for r in records})}"); print(f"Total duration seconds: {sum(r.duration_seconds for r in records):.3f}"); print(f"Class distribution: {dict(Counter(r.label for r in records))}"); return 0

if __name__ == "__main__": raise SystemExit(main())
