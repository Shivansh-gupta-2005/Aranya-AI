# Prototype Limitations

The current repository does not include physical sensor firmware, LoRaWAN transport, a backend, or real multi-node localization. Demo sensor events and location estimates are simulated and labeled as such.

YAMNet is a general audio model. The manual mapping and DSP fallback are experimental. They do not establish field accuracy.

Operator feedback stays in browser storage. It does not retrain or calibrate a model. A production feedback loop needs reviewed exports, privacy controls, dataset versioning, and an offline training job.

No candidate target is promoted. Training, threshold selection, edge export, and hardware work remain gated on approved data and measured results.
