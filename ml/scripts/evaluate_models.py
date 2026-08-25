from __future__ import annotations
import argparse

def main() -> int:
    parser = argparse.ArgumentParser(description="Future held-out model evaluation entry point.")
    parser.add_argument("--manifest", required=True); parser.add_argument("--models", nargs="+", required=True); parser.add_argument("--output", required=True); parser.parse_args()
    raise SystemExit("Scaffolding only: evaluation requires actual held-out predictions and creates no fabricated metrics.")

if __name__ == "__main__": main()
