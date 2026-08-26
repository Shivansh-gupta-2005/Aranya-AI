# Detector Taxonomy

## Candidate targets

The version 1 detector has five candidate targets:

1. `gunfire`
2. `chainsaw`
3. `metal_tool_activity`
4. `fire`
5. `vehicle`

Candidate status does not imply release readiness. Each class must pass its own data and evaluation gates.

`background` is not a sixth output. It means that no target crossed its threshold.

## Multi-label behavior

A recording or window may contain more than one target. Models return one independent score per target. Scores must not be normalized across targets.

## Context classes

The browser baseline may still report `wildlife`, `background`, and `tree_fall`. These context classes are outside the five-target model contract.

## Legacy migration

Persisted browser data uses this mapping:

```text
gunshot -> gunfire
fire_anomaly -> fire
metal_clank -> metal_tool_activity
```

The other class IDs keep their current spelling.

## Promotion

Thresholds are selected on validation data for recall within a documented false-alert budget. A class stays a candidate when it lacks data or fails evaluation. Successful classes do not wait for unrelated candidates.
