# Aranya ML Dataset Workspace

This directory is the controlled workspace for Aranya audio data. The
repository currently contains no verified Aranya training recordings.

- `raw/team_recorded/` is for our own recordings.
- `raw/public/` is for externally sourced recordings whose licensing has been
  verified.
- `quarantine/` is for recordings with unclear labels, licensing, or
  provenance. Quarantined audio must not enter a training manifest.
- `splits/` contains generated train/validation/test manifests only.

Dependency and test audio must never be included in the dataset. In
particular, audio under `tfjs-converter/`, `yamnet-convert/`, `node_modules/`,
Python/Node dependency directories, or package test-data directories is not a
dataset recording.

Do not copy audio into the workspace until its source, labels, license,
attribution requirements, and redistribution permission have been verified.

Create `manifest.csv` with the fields in `manifest.schema.json`. One row is one original recording, not a generated window. Use a stable `file_id` and a portable path relative to the manifest file or repository root.

Every recording needs documented `source_name`, `source_url`, `license`, `license_verified`, `recording_group_id`, `session_id`, `source_identity`, recording conditions, microphone, sample rate, channels, and duration. Team-owned material should use a clear internal license such as `team-owned`; external material must preserve attribution and per-file license information.

Threat recordings should include event start/end seconds when the event is localized within a longer recording. A full-clip threat can use 0 and the recording duration. Background recordings require a background subtype.

## Leakage prevention

`recording_group_id` identifies material sharing an original source, session, capture, or near-duplicate lineage. The grouped split assigns each group to exactly one of train, validation, or test. Window generation happens only after that assignment. The 60-group value is a target/reference, not a minimum gate.
