import { SoundEventClass } from '../../types';
import { TargetClass } from '../../domain/detector/taxonomy';

// ============================================================
// YAMNet / AudioSet class mapping
// ------------------------------------------------------------
// YAMNet (google/yamnet) predicts 521 independent AudioSet event
// classes. The current browser baseline tracks eight relevant categories,
// so we map the subset of AudioSet class indices that are
// acoustically relevant onto each ARANYA SoundEventClass and pool
// their scores. Indices below come from the official YAMNet class
// map (tensorflow/models research/audioset/yamnet/yamnet_class_map.csv).
//
// This mapping is a best-effort heuristic grouping, not a trained
// classifier of its own: it lets a general-purpose pretrained
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
  gunfire: [421, 422, 423, 424, 427], // Gunshot/gunfire, machine gun, fusillade, artillery, firecracker
  tree_fall: [431, 432, 433, 434, 454, 463, 464], // Wood, Chop, Splinter, Crack, Thud, Smash/crash, Breaking
  // Fire, Crackle only: the actual sound of flame/burning. Smoke/fire
  // alarm sounds (393, 394) are deliberately NOT pooled here at full
  // weight: they're electronic beeping, not fire itself, and in a real
  // forest deployment there's no fire-alarm hardware to hear, so treating
  // them as equally strong "fire" evidence would let a spurious or
  // out-of-context alarm-like sound drag a weak signal up to a false
  // "fire" conclusion. They're still used, at reduced weight, as
  // corroborating evidence: see FIRE_ALARM_CORROBORATION_INDICES and
  // poolCurrentNormalizedScores.
  fire: [292, 293],
  metal_tool_activity: [478, 483], // Clang, Clatter
};

/**
 * Smoke/fire-alarm classes: "Smoke detector, smoke alarm" (393), "Fire
 * alarm" (394). Pooled into fire at reduced weight (see
 * FIRE_ALARM_CORROBORATION_WEIGHT) rather than the full weight given to
 * genuine fire/crackle sound: see the comment on AUDIOSET_TO_ARANYA.fire.
 */
export const FIRE_ALARM_CORROBORATION_INDICES = [393, 394];
export const FIRE_ALARM_CORROBORATION_WEIGHT = 0.35;

function validateScores(rawScores: number[]): void {
  if (rawScores.length !== AUDIOSET_NUM_CLASSES) {
    throw new Error(`Expected ${AUDIOSET_NUM_CLASSES} AudioSet scores.`);
  }
}

function poolRawCurrentScores(rawScores: number[]): Record<SoundEventClass, number> {
  validateScores(rawScores);
  const pooled = {} as Record<SoundEventClass, number>;
  for (const [classId, indices] of Object.entries(AUDIOSET_TO_ARANYA) as [
    SoundEventClass,
    number[],
  ][]) {
    pooled[classId] = indices.reduce((sum, index) => sum + (rawScores[index] ?? 0), 0);
  }
  pooled.fire += FIRE_ALARM_CORROBORATION_INDICES.reduce(
    (sum, index) => sum + (rawScores[index] ?? 0) * FIRE_ALARM_CORROBORATION_WEIGHT,
    0
  );
  return pooled;
}

export function poolCurrentNormalizedScores(
  rawScores: number[]
): Record<SoundEventClass, number> {
  const pooled = poolRawCurrentScores(rawScores);
  const total = Object.values(pooled).reduce((sum, value) => sum + value, 0) || 1e-6;
  for (const classId of Object.keys(pooled) as SoundEventClass[]) {
    pooled[classId] /= total;
  }
  return pooled;
}

export function poolIndependentTargetScores(
  rawScores: number[]
): Record<TargetClass, number> {
  const pooled = poolRawCurrentScores(rawScores);
  return {
    gunfire: Math.min(pooled.gunfire, 1),
    chainsaw: Math.min(pooled.chainsaw, 1),
    metal_tool_activity: Math.min(pooled.metal_tool_activity, 1),
    fire: Math.min(pooled.fire, 1),
    vehicle: Math.min(pooled.vehicle, 1),
  };
}

/** Flat reverse lookup: AudioSet index -> ARANYA class (for indices we track). */
export const INDEX_TO_ARANYA: Map<number, SoundEventClass> = new Map();
for (const [cls, indices] of Object.entries(AUDIOSET_TO_ARANYA) as [SoundEventClass, number[]][]) {
  for (const idx of indices) {
    INDEX_TO_ARANYA.set(idx, cls);
  }
}
for (const idx of FIRE_ALARM_CORROBORATION_INDICES) {
  INDEX_TO_ARANYA.set(idx, 'fire');
}
