import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorderKeeping } from '../src/lib/books.ts';

const source = Array.from({ length: 50 }, (_, i) => i);

test('random keeps the current item first and shuffles the rest', () => {
  const { items, index } = reorderKeeping(source, 17, true);
  assert.equal(index, 0);
  assert.equal(items[0], 17);
  assert.deepEqual(
    [...items].sort((a, b) => a - b),
    source,
  );
  assert.notDeepEqual(
    items.slice(1),
    source.filter(n => n !== 17),
  );
});

test('in order jumps to the current item in source order', () => {
  assert.deepEqual(reorderKeeping(source, 17, false), { items: source, index: 17 });
});

test('no current item: plain shuffle or source order from the start', () => {
  assert.deepEqual(reorderKeeping(source, undefined, false), { items: source, index: 0 });
  const { items, index } = reorderKeeping(source, undefined, true);
  assert.equal(index, 0);
  assert.equal(items.length, source.length);
  assert.deepEqual(reorderKeeping([], undefined, true), { items: [], index: 0 });
});
