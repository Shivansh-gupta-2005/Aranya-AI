"""Command line interface for dataset and model workflows."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from aranya_ml.data.catalog import Catalog, load_catalog, validate_catalog


def _load_valid_catalog(path: str) -> Catalog | None:
    catalog = load_catalog(Path(path))
    errors = validate_catalog(catalog)
    if errors:
        print("Catalog invalid:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return None
    return catalog


def _validate(args: argparse.Namespace) -> int:
    catalog = _load_valid_catalog(args.catalog)
    if catalog is None:
        return 1
    eligible = sum(recording.training_eligible for recording in catalog.recordings)
    print(f"Valid recordings: {len(catalog.recordings)}")
    print(f"Target annotations: {len(catalog.annotations)}")
    print(f"Recording groups: {len({item.recording_group_id for item in catalog.recordings})}")
    print(f"Training eligible: {eligible}")
    return 0


def _train(args: argparse.Namespace) -> int:
    catalog = _load_valid_catalog(args.catalog)
    if catalog is None:
        return 1
    eligible = [recording for recording in catalog.recordings if recording.training_eligible]
    if not eligible:
        print("No training-eligible recordings. Complete data review first.", file=sys.stderr)
        return 2
    print(
        "Training implementation is gated on an approved dataset and experiment config.",
        file=sys.stderr,
    )
    return 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="aranya-ml")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-catalog", help="Validate normalized dataset metadata.")
    validate.add_argument("--catalog", default="datasets/v1")
    validate.set_defaults(handler=_validate)

    train = commands.add_parser("train", help="Run training after its data gate passes.")
    train.add_argument("--catalog", default="datasets/v1")
    train.set_defaults(handler=_train)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
