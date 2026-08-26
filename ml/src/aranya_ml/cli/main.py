"""Command line interface for dataset and model workflows."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from aranya_ml.data.catalog import Catalog, load_catalog, validate_catalog
from aranya_ml.data.pilot_manifest import audit_pilot_rows, load_pilot_manifest
from aranya_ml.training.experiment import (
    ExperimentConfig,
    run_experiment,
    select_experiment_rows,
)


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


def _audit_pilot(args: argparse.Namespace) -> int:
    try:
        rows = load_pilot_manifest(args.manifest, allow_provisional=args.allow_provisional)
        selected = select_experiment_rows(rows, args.allow_provisional)
        report = audit_pilot_rows(selected)
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


def _train_pilot(args: argparse.Namespace) -> int:
    if args.features == "yamnet" and args.yamnet_model is None:
        print("--yamnet-model is required for YAMNet features", file=sys.stderr)
        return 2
    try:
        report = run_experiment(
            ExperimentConfig(
                manifest=args.manifest,
                output=args.output,
                feature_kind=args.features,
                model_kind=args.model,
                allow_provisional=args.allow_provisional,
                yamnet_model=args.yamnet_model,
                seed=args.seed,
                workers=args.workers,
            )
        )
    except (OSError, ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="aranya-ml")
    commands = parser.add_subparsers(dest="command", required=True)

    validate = commands.add_parser("validate-catalog", help="Validate normalized dataset metadata.")
    validate.add_argument("--catalog", default="datasets/v1")
    validate.set_defaults(handler=_validate)

    train = commands.add_parser("train", help="Run training after its data gate passes.")
    train.add_argument("--catalog", default="datasets/v1")
    train.set_defaults(handler=_train)

    audit_pilot = commands.add_parser("audit-pilot", help="Audit a pilot manifest.")
    audit_pilot.add_argument("--manifest", type=Path, required=True)
    audit_pilot.add_argument("--allow-provisional", action="store_true")
    audit_pilot.set_defaults(handler=_audit_pilot)

    train_pilot = commands.add_parser("train-pilot", help="Run a pilot experiment.")
    train_pilot.add_argument("--manifest", type=Path, required=True)
    train_pilot.add_argument("--output", type=Path, required=True)
    train_pilot.add_argument("--features", choices=("logmel", "yamnet"), required=True)
    train_pilot.add_argument("--model", choices=("logistic", "mlp"), required=True)
    train_pilot.add_argument("--yamnet-model", type=Path)
    train_pilot.add_argument("--allow-provisional", action="store_true")
    train_pilot.add_argument("--seed", type=int, default=20260826)
    train_pilot.add_argument("--workers", type=int, default=8)
    train_pilot.set_defaults(handler=_train_pilot)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
