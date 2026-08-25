# Contributing to ARANYA AI

## Branches and pull requests

Keep `main` as the integration branch. Start work from an up-to-date `main` branch and use one of:

- `feature/<short-description>`
- `fix/<short-description>`
- `experiment/<short-description>`

Use focused commits such as `feat: add grouped dataset split` or `fix: preserve gunshot peak events`. Open a pull request before merging into `main`; include purpose, verification performed, relevant screenshots or evidence, and limitations. Do not force-push shared branches.

## Local setup

```powershell
npm ci
npm run dev
npm run build
```

The Python ML workspace is separate from the React runtime. Do not install its dependencies into `node_modules`; create a local Python environment only after the ML environment is approved.

## What not to commit

Never commit `node_modules`, build output, Python virtual environments, conversion environments, `.env` files, credentials, raw datasets, embeddings, checkpoints, generated metrics, caches, or personal IDE settings. Always review `git status` before staging.

## Models and datasets

Keep the required browser runtime model in `public/models/yamnet/`. Do not add arbitrary model binaries, raw audio, or trained checkpoints without reviewing size, provenance, licensing, runtime requirement, and whether Git LFS is needed.

For ML data, commit manifests, schemas, source URLs, license/provenance metadata, and reproducible scripts. Keep raw recordings in ignored dataset directories. Preserve recording-group boundaries before creating windows or splitting data.

## Verification

Run relevant checks and report the results in the pull request:

```powershell
npm run build
python -B -m unittest discover -s ml/tests
```

Do not present simulated infrastructure, heuristic fallback, or unmeasured model performance as real AI or hardware results.
