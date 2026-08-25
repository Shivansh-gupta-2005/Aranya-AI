from __future__ import annotations
import argparse

def main() -> int:
    parser = argparse.ArgumentParser(description="Future small MLP training entry point.")
    parser.add_argument("--embeddings", required=True); parser.add_argument("--manifest", required=True); parser.add_argument("--output", required=True); parser.parse_args()
    raise SystemExit("Scaffolding only: no classifier is trained and no metric is generated.")

if __name__ == "__main__": main()
