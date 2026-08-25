from __future__ import annotations
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.manifest import grouped_split_records, load_manifest, validate_records, write_manifest

def main() -> int:
    parser = argparse.ArgumentParser(description="Assign complete recording groups to train/validation/test.")
    parser.add_argument("--manifest", required=True); parser.add_argument("--output", required=True); parser.add_argument("--train", type=float, default=.70); parser.add_argument("--validation", type=float, default=.15); parser.add_argument("--test", type=float, default=.15); parser.add_argument("--seed", type=int, default=20260823); parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args(); output = Path(args.output)
    if output.exists() and not args.overwrite: raise SystemExit(f"output exists; pass --overwrite: {output}")
    source = Path(args.manifest); records = load_manifest(source); errors = validate_records(records)
    if errors: raise SystemExit("Cannot split invalid manifest:\n" + "\n".join(errors))
    result = grouped_split_records(records, (args.train, args.validation, args.test), args.seed); write_manifest(output, result)
    print(f"Wrote {len(result)} records to {output}"); print({name: sum(r.split == name for r in result) for name in ("train", "validation", "test")}); print("Split completed before window generation."); return 0

if __name__ == "__main__": raise SystemExit(main())
