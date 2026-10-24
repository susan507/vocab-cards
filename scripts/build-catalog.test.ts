import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOG_PATH, catalogJson, readBooks } from './build-catalog.ts';

test('catalog.json is up to date with the book files (run `npm run catalog`)', () => {
  assert.equal(readFileSync(CATALOG_PATH, 'utf8'), catalogJson());
});

test('word ids are stable and only repeat for identical words', () => {
  for (const book of readBooks()) {
    const seen = new Map<string, string>();
    for (const w of book.chapters.flatMap(c => c.sections).flatMap(s => s.words)) {
      const text = `${w.es}|${w.en}`;
      assert.equal(seen.get(w.id) ?? text, text, `${book.id}:${w.id}`);
      seen.set(w.id, text);
    }
  }
  const word = (bookId: string, id: string) =>
    readBooks()
      .find(b => b.id === bookId)
      ?.chapters.flatMap(c => c.sections)
      .flatMap(s => s.words)
      .find(w => w.id === id);
  assert.equal(word('usborne-ftw-es', 'FTWSX001')?.es, 'El cuarto de baño');
  assert.equal(word('usborne-ftw-es', 'FTWS0418')?.en, 'oar');
  assert.equal(word('usborne-ftw-es', 'FTWS0418-2')?.en, 'paddle');
  assert.equal(word('dk-idic-es', '1.1.1')?.es, 'la cabeza');
});
