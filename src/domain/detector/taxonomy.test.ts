import { describe, expect, it } from 'vitest';
import sharedTaxonomy from '../../../contracts/taxonomy.v1.json';
import { CONTEXT_CLASSES, TARGET_CLASSES, migrateLegacyClass } from './taxonomy';

describe('detector taxonomy', () => {
  it('uses the shared target order', () => {
    expect(TARGET_CLASSES).toEqual(sharedTaxonomy.targets.map((target) => target.id));
    expect(CONTEXT_CLASSES).toEqual(sharedTaxonomy.contextClasses);
  });

  it('migrates legacy browser class IDs', () => {
    expect(migrateLegacyClass('gunshot')).toBe('gunfire');
    expect(migrateLegacyClass('fire_anomaly')).toBe('fire');
    expect(migrateLegacyClass('chainsaw')).toBe('chainsaw');
  });
});
