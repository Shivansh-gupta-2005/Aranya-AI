# Contributing to ARANYA AI

Use a short branch from current `main`. Use `feature/<name>`, `fix/<name>`, or `experiment/<name>`. Open a pull request before merge. Do not force-push a shared branch.

## Setup

The web application needs Node.js 24 and npm 11.

```powershell
npm ci
npm run dev
```

The ML workspace uses Python 3.11 or 3.12 through uv.

```powershell
cd ml
uv sync --locked --group dev
```

Do not install ML packages into the web project. Do not keep a second requirements file beside `pyproject.toml` and `uv.lock`.

## Verification

Run the full checks before requesting review:

```powershell
npm run lint
npm run typecheck
npm test
npm run build

cd ml
uv run ruff check src tests
uv run ruff format --check src tests
uv run pyright
uv run pytest
uv run aranya-ml validate-catalog --catalog datasets/v1
```

Report which commands ran. Include screenshots for visible UI changes. State any check you could not run.

## Code boundaries

Keep business rules in `src/domain/`. Keep state writes in `src/app/`. Keep browser APIs in `src/platform/`. Model adapters belong in `src/services/models/` until inference becomes a separate deployable package.

Split code by ownership and reason to change. Do not create folders only to make a tree look larger. Keep functions pure when they do not need I/O.

## Data and models

Commit reviewed metadata under `ml/datasets/`. Keep raw audio, embeddings, reports, checkpoints, exports, and caches under ignored `ml/work/`.

Never mark a recording training eligible without verified provenance, license review, complete annotation coverage, human review, and a frozen group split. Never reuse decision-influencing test data for training.

Do not add model claims without frozen evaluation evidence. Keep candidate classes marked as candidates until each class passes its release gate.

## Git hygiene

Review `git status` and staged diffs before every commit. Do not commit secrets, `.env` files, editor state, generated reports, local worktrees, virtual environments, or dependency directories.

Use focused commit messages such as `feat: add detector output contract` or `fix: preserve frozen split groups`. Do not add tool attribution to commits or pull requests.
