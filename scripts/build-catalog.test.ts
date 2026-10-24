import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOG_PATH, catalogJson } from './build-catalog.ts';

test('catalog.json is up to date with the book files (run `npm run catalog`)', () => {
  assert.equal(readFileSync(CATALOG_PATH, 'utf8'), catalogJson());
});
