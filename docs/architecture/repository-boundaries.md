# Repository Boundaries

ARANYA uses one repository for the browser application and the Python ML workspace. A full monorepo layout is deferred until another deployable application exists.

## Dependency direction

```text
app -> features
features -> domain, inference, platform, shared
inference -> domain, contracts
platform -> browser APIs
domain -> no React, Zustand, TensorFlow, or browser globals
ml -> contracts, never frontend implementation files
```

The domain owns stable vocabulary and pure policy. Features coordinate user flows. Inference owns model adapters and temporal detection. Platform code wraps browser APIs. Shared code contains small UI and utility units with no feature policy.

## Module rule

Split a module when it has multiple reasons to change or cannot be tested independently. File length alone is not a design rule. A new folder must enforce ownership or dependency direction.

## Cross-runtime contracts

Versioned JSON files under `contracts/` define the detector taxonomy, output, and model bundle. TypeScript and Python tests load the same files. Runtime-specific code may adapt these contracts but may not redefine class order or score meaning.

## Future deployables

Firmware, backend services, and gateway code are not scaffolded until their owners, runtime constraints, and interfaces exist. Empty architecture creates maintenance work without reducing risk.
