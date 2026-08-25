import { describe, expect, it } from 'vitest';
import { findNonAscii } from './check-text-style.mjs';

describe('findNonAscii', () => {
  it('accepts plain ASCII', () => {
    expect(findNonAscii('plain -> text')).toEqual([]);
  });

  it('reports each line with non-ASCII text', () => {
    expect(findNonAscii('good\nbad \u2014 text\n')).toEqual([2]);
  });
});
