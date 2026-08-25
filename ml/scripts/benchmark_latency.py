from __future__ import annotations
import argparse

def main() -> int:
    parser = argparse.ArgumentParser(description="Future inference and detection latency benchmark.")
    parser.add_argument("--model", required=True); parser.add_argument("--audio", required=True); parser.add_argument("--repetitions", type=int, default=30); parser.parse_args()
    raise SystemExit("Scaffolding only: latency is measured only after real model inference is available.")

if __name__ == "__main__": main()
