# ARANYA AI

ARANYA AI is a browser-based prototype for acoustic forest-surveillance workflows. It processes microphone or uploaded audio locally in the browser, turns confirmed acoustic classifications into canonical events and alerts, and presents them through a dashboard, map, incident workflow, analytics, and demo mode.

The repository is the software source project. It does not contain raw training audio, Python virtual environments, Node dependencies, or hardware firmware.

## Current architecture

```text
Audio upload / browser microphone
  -> 16 kHz preprocessing and visual evidence
  -> local TensorFlow.js YAMNet inference
  -> AudioSet-to-Aranya baseline mapping and temporal processing
  -> canonical event pipeline
  -> persisted browser event/feedback state
  -> dashboard, alerts, map, incidents, and analytics
```

The current real inference path is browser-only. The sensor-network and multi-node localization displays are clearly simulated prototype layers; no LoRaWAN, physical sensor transport, or TDOA localization is implemented here.

## Stack

- React 18, TypeScript, Vite, Tailwind CSS
- TensorFlow.js with a locally served YAMNet GraphModel
- Zustand browser persistence
- Leaflet / React Leaflet, Recharts, Lucide
- Optional Python ML workspace for future dataset and model experiments

## Repository layout

```text
src/                    React UI, audio processing, model provider, event pipeline, stores
public/models/yamnet/   Required local TensorFlow.js runtime model
ml/                     Python dataset/embedding/classifier experiment workspace
models/yamnet-tf/       Local conversion source only; intentionally ignored
tfjs-converter/         Local Python conversion environment; intentionally ignored
yamnet-convert/         Local Python conversion environment; intentionally ignored
```

## Requirements and installation

Install a current Node.js/npm version compatible with Vite 5, then use the lockfile:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Production validation:

```powershell
npm run build
```

`npm run lint` is defined, but the current repository does not yet contain an ESLint flat-config file required by ESLint 9; it is not a passing validation command until that configuration is added.

## Local YAMNet runtime model

`public/models/yamnet/model.json` and its four `group1-shard*.bin` files are required for the existing browser inference path:

```ts
tf.loadGraphModel('/models/yamnet/model.json')
```

They are committed as normal Git files because the complete model is about 15.09 MB and no individual file exceeds GitHub's 100 MB normal-Git limit. Do not remove or relocate them without updating and validating the application loader.

## ML workspace

`ml/` is separate from the React runtime. It contains manifest/schema tooling and planned experiments comparing:

1. Current YAMNet + manual AudioSet mapping baseline.
2. YAMNet 1024-D embeddings + Logistic Regression.
3. YAMNet 1024-D embeddings + small MLP.

No trained Aranya-specific model or performance claim is committed. The initial experiment uses `gunshot`, `chainsaw_logging`, `metal_tool_activity`, and `background`, with hard-negative subtypes retained in manifest metadata.

After explicitly approving Python dependency installation, ML checks can be run with:

```powershell
python -B -m unittest discover -s ml/tests
python -B ml/scripts/validate_manifest.py --manifest ml/data/manifest.csv
```

## Dataset policy

Commit dataset manifests, schemas, acquisition/provenance metadata, code, and configuration. Do not commit raw audio, downloaded public datasets, embeddings, checkpoints, or generated training/evaluation artifacts. The `ml/data/raw/` directory is intentionally ignored and remains local.

## Hardware status

The intended production design is INMP441 microphone -> ESP32-S3 edge inference -> event metadata -> LoRaWAN -> gateway/backend -> dashboard. This repository currently demonstrates the software-side browser workflow only. Firmware and physical LoRaWAN integration are not included.

## Collaboration workflow

Use `main` as the protected integration branch. Develop through short-lived branches named `feature/<description>`, `fix/<description>`, or `experiment/<description>`, then open a pull request for review. Do not copy the whole local project directory to a teammate; clone the repository and install dependencies locally.

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit, review, model, and data rules.
