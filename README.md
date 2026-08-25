# ARANYA AI

ARANYA AI is a browser prototype for acoustic forest monitoring. It analyzes microphone and uploaded audio locally. Confirmed detections flow into one event store for alerts, maps, incidents, and analytics.

The current browser path uses a local YAMNet model with a manual AudioSet mapping. It is a baseline, not a trained ARANYA model. Sensor nodes, localization, LoRaWAN, and edge firmware remain clearly marked simulations or future work.

## Quick start

Install Node.js 24 and npm 11. Then run:

```powershell
npm ci
npm run dev
```

The local YAMNet files under `public/models/yamnet/` are required. The app loads `model.json` from that directory.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same checks on pull requests and pushes to `main`.

## Detector contract

The five candidate targets are `gunfire`, `chainsaw`, `metal_tool_activity`, `fire`, and `vehicle`. Scores are independent and may produce several detections. `background` means no target crossed its threshold. It is not a target output.

Versioned JSON contracts live under `contracts/`. TypeScript and Python tests read the same taxonomy and schemas.

## Repository layout

```text
contracts/                Shared taxonomy and model interfaces
docs/                     Architecture and ML policy
src/app/                  State-writing application commands
src/domain/               Pure detector and event rules
src/platform/             Browser adapters such as audio capture and persistence
src/services/models/      Current inference adapters and baselines
src/components/, pages/   React presentation and user flows
ml/datasets/              Tracked metadata, annotations, and frozen splits
ml/src/aranya_ml/         Python data, feature, model, and evaluation package
ml/work/                  Ignored local audio and generated artifacts
```

The repository keeps one web application at its root. It does not add an `apps/web` wrapper until another deployable application exists.

## ML workspace

Install [uv](https://docs.astral.sh/uv/), then run:

```powershell
cd ml
uv sync --locked --group dev
uv run aranya-ml validate-catalog --catalog datasets/v1
uv run pytest
```

The tracked v1 catalog contains historical prototype material only. All 13 recordings have previous test use. None is training eligible.

## Design and policy

- [Repository boundaries](docs/architecture/repository-boundaries.md)
- [Browser inference](docs/architecture/browser-inference.md)
- [Detector taxonomy](docs/ml/taxonomy.md)
- [Dataset policy](docs/ml/dataset-policy.md)
- [Evaluation protocol](docs/ml/evaluation-protocol.md)
- [Prototype limits](docs/product/prototype-limitations.md)
- [Contributing](CONTRIBUTING.md)
