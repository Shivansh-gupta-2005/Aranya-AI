from __future__ import annotations
import argparse

def main() -> int:
    parser = argparse.ArgumentParser(description="Future YAMNet embedding extraction entry point.")
    parser.add_argument("--manifest", required=True); parser.add_argument("--model-dir", required=True); parser.add_argument("--output", required=True); parser.parse_args()
    raise SystemExit("Scaffolding only: extraction is not run until real data and approved dependencies are available.")

if __name__ == "__main__": main()
