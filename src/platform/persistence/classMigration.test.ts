import { describe, expect, it } from 'vitest';
import {
  migratePersistedEventState,
  migratePersistedFeedbackState,
} from './classMigration';

describe('persisted class migration', () => {
  it('migrates legacy event classes without dropping other fields', () => {
    const migrated = migratePersistedEventState({
      events: [
        { id: 'e1', eventClass: 'gunshot', confidence: 0.9 },
        { id: 'e2', eventClass: 'fire_anomaly', confidence: 0.8 },
      ],
    }) as { events: Array<{ id: string; eventClass: string; confidence: number }> };

    expect(migrated.events).toEqual([
      { id: 'e1', eventClass: 'gunfire', confidence: 0.9 },
      { id: 'e2', eventClass: 'fire', confidence: 0.8 },
    ]);
  });

  it('migrates feedback predictions', () => {
    const migrated = migratePersistedFeedbackState({
      records: [{ id: 'f1', predictedClass: 'metal_clank' }],
    }) as { records: Array<{ id: string; predictedClass: string }> };

    expect(migrated.records[0].predictedClass).toBe('metal_tool_activity');
  });
});
