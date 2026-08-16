import { SoundEventClass } from '../../types';

// ============================================================
// YAMNet / AudioSet class mapping
// ------------------------------------------------------------
// YAMNet (google/yamnet) predicts 521 independent AudioSet event
// classes. ARANYA only cares about 7 forest-relevant categories,
// so we map the subset of AudioSet class indices that are
// acoustically relevant onto each ARANYA SoundEventClass and pool
// their scores. Indices below come from the official YAMNet class
// map (tensorflow/models research/audioset/yamnet/yamnet_class_map.csv).
//
// This mapping is a best-effort heuristic grouping, not a trained
// classifier of its own — it lets a general-purpose pretrained
// audio event model stand in for a forest-specific one until a
// custom ARANYA model is trained. Keep this file isolated so that
// swapping in a custom model later only means writing a new
// AudioModelPlugin + (if needed) a new mapping.
// ============================================================

export const AUDIOSET_NUM_CLASSES = 521;

export const AUDIOSET_TO_ARANYA: Record<SoundEventClass, number[]> = {
  chainsaw: [341, 415], // Chainsaw, Sawing
  vehicle: [
    294, 300, 301, 302, 304, 305, 308, 309, 310, 312, 314, 316, 317, 319, 320,
    321, 323, 324, 325, 326, 327, 330, 331, 337, 338, 342, 343, 344, 345,
  ], // Vehicle / car / truck / motorcycle / train / aircraft / engine family
  wildlife: [67, 68, 81, 103, 106, 107, 116, 121, 127], // Animal, Bird, Insect, Frog, Wild animals
  background: [
    277, 278, 279, 280, 281, 283, 284, 285, 286, 481, 494, 507, 508, 514, 515,
  ], // Wind, rain, thunder, stream, rustle, silence, ambient/environmental noise
  gunshot: [421, 422, 423, 424, 427], // Gunshot/gunfire, machine gun, fusillade, artillery, firecracker
  tree_fall: [431, 432, 433, 434, 454, 463, 464], // Wood, Chop, Splinter, Crack, Thud, Smash/crash, Breaking
  fire_anomaly: [292, 293, 393, 394], // Fire, Crackle, Smoke/fire alarm
};

/** Flat reverse lookup: AudioSet index -> ARANYA class (for indices we track). */
export const INDEX_TO_ARANYA: Map<number, SoundEventClass> = new Map();
for (const [cls, indices] of Object.entries(AUDIOSET_TO_ARANYA) as [SoundEventClass, number[]][]) {
  for (const idx of indices) {
    INDEX_TO_ARANYA.set(idx, cls);
  }
}
