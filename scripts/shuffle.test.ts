import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shuffle } from '../src/lib/books.ts';

test('shuffle keeps every item and leaves the input untouched', () => {
  const input = Array.from({ length: 50 }, (_, i) => i);
  const out = shuffle(input);
  assert.deepEqual(
    input,
    Array.from({ length: 50 }, (_, i) => i),
  );
  assert.deepEqual(
    [...out].sort((a, b) => a - b),
    input,
  );
  assert.notDeepEqual(out, input);
});
