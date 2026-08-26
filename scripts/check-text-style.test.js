import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectTextFiles, findNonAscii } from './check-text-style.mjs';

describe('findNonAscii', () => {
  it('accepts plain ASCII', () => {
    expect(findNonAscii('plain -> text')).toEqual([]);
  });

  it('reports each line with non-ASCII text', () => {
    expect(findNonAscii('good\nbad \u2014 text\n')).toEqual([2]);
  });
});

describe('collectTextFiles', () => {
  it('does not follow directory junctions', () => {
    const root = mkdtempSync(join(tmpdir(), 'aranya-style-'));
    const scanRoot = join(root, 'scan');
    const target = join(root, 'third-party');
    mkdirSync(scanRoot);
    mkdirSync(target);
    writeFileSync(join(target, 'third-party.md'), 'bad \u2014 text');
    symlinkSync(target, join(scanRoot, 'linked-work'), 'junction');

    try {
      expect(collectTextFiles(scanRoot)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
