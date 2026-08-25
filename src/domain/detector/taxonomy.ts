import sharedTaxonomy from '../../../contracts/taxonomy.v1.json';

export type TargetClass =
  | 'gunfire'
  | 'chainsaw'
  | 'metal_tool_activity'
  | 'fire'
  | 'vehicle';

export type ContextClass = 'wildlife' | 'background' | 'tree_fall';

export type DetectorClass = TargetClass | ContextClass;

export const TARGET_CLASSES = sharedTaxonomy.targets.map((target) => target.id) as TargetClass[];
export const CONTEXT_CLASSES = sharedTaxonomy.contextClasses as ContextClass[];

const LEGACY_MAPPINGS = sharedTaxonomy.legacyMappings as Record<string, DetectorClass>;

export function migrateLegacyClass(classId: string): string {
  return LEGACY_MAPPINGS[classId] ?? classId;
}

export function isTargetClass(classId: string): classId is TargetClass {
  return TARGET_CLASSES.includes(classId as TargetClass);
}
