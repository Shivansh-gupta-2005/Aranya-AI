# Dataset Policy

## Tracked data

Git stores curated recording metadata, event annotations, source and license records, and frozen group-to-split assignments under `ml/datasets/`.

Git does not store raw audio, quarantine audio, embeddings, caches, checkpoints, generated reports, or exported models. Those files belong under ignored `ml/work/`.

## Annotation rules

One recording may have several target intervals. Unreviewed time is not background. A recording is a verified negative only after complete review confirms that no target interval exists.

Every training record needs verified provenance, a license decision, technical metadata, a stable recording group, and annotation review. Unknown values must be explicit. Code must not invent missing provenance.

## Leakage control

Recordings that share a source, session, capture, or near-duplicate lineage use the same `recording_group_id`. The split assigns whole groups before window generation. Frozen assignments never move when new data arrives.

Once test results affect a decision, later experiments need a new test version. The old test material remains marked as previously used.

## Safety

Do not create unsafe target sounds for data collection. Gunfire and fire data require authorized, controlled sources or properly licensed recordings. Preserve privacy and location sensitivity in recorded metadata.
