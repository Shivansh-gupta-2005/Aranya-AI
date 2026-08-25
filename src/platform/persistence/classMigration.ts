import { migrateLegacyClass } from '../../domain/detector/taxonomy';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateItems(
  persisted: unknown,
  collectionName: 'events' | 'records',
  classField: 'eventClass' | 'predictedClass'
): unknown {
  if (!isRecord(persisted) || !Array.isArray(persisted[collectionName])) {
    return persisted;
  }
  return {
    ...persisted,
    [collectionName]: persisted[collectionName].map((item) => {
      if (!isRecord(item) || typeof item[classField] !== 'string') {
        return item;
      }
      return { ...item, [classField]: migrateLegacyClass(item[classField]) };
    }),
  };
}

export function migratePersistedEventState(persisted: unknown): unknown {
  return migrateItems(persisted, 'events', 'eventClass');
}

export function migratePersistedFeedbackState(persisted: unknown): unknown {
  return migrateItems(persisted, 'records', 'predictedClass');
}
