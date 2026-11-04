import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATALOG,
  getCatalogBook,
  loadBook,
  parseBook,
  searchTopics,
  setImportedBooks,
  spokenText,
  topicFromKey,
} from '../src/lib/books.ts';
import type { Book } from '../src/lib/types.ts';

const book: Book = {
  id: 'my-book',
  title: 'My Book',
  source: { name: 'Me', url: 'https://example.com' },
  chapters: [
    { title: 'Unidad 0', sections: [{ words: [{ id: 'zorgo', es: 'zorgo', en: 'zorg' }] }] },
    { title: 'Unidad 1', sections: [{ words: [] }] },
  ],
};

test('parseBook accepts a Book and explains what is wrong with anything else', () => {
  assert.equal(parseBook(book), book);
  assert.equal(typeof parseBook(null), 'string');
  assert.equal(typeof parseBook({ ...book, id: 'Bad/Id' }), 'string');
  assert.equal(typeof parseBook({ ...book, id: CATALOG[0].id }), 'string');
  assert.equal(typeof parseBook({ ...book, chapters: [] }), 'string');
  assert.equal(
    typeof parseBook({ ...book, chapters: [{ title: 'x', sections: [{ words: [{ id: 'a' }] }] }] }),
    'string',
  );
});

test('imported books join the catalog, search and topics', async () => {
  setImportedBooks([book, { ...book, id: CATALOG[0].id, title: 'Impostor' }]);
  assert.deepEqual(getCatalogBook('my-book')?.chapters[0], {
    title: 'Unidad 0',
    sections: [{ title: undefined, count: 1 }],
  });
  assert.equal(getCatalogBook(CATALOG[0].id), CATALOG[0]);
  assert.equal(topicFromKey('my-book/1')?.chapter, 1);
  assert.ok(searchTopics('unidad', [getCatalogBook('my-book')!]).length === 2);
  assert.equal((await loadBook('my-book'))?.title, 'My Book');
  setImportedBooks([]);
  assert.equal(getCatalogBook('my-book'), undefined);
  assert.equal(await loadBook('my-book'), undefined);
});

test('spokenText drops verb marks and gender endings', () => {
  assert.equal(spokenText('blirmir (ue)'), 'blirmir');
  assert.equal(spokenText('plusco/a'), 'plusco');
  assert.equal(spokenText('el/la quelpa'), 'el quelpa');
  assert.equal(spokenText('la trumba'), 'la trumba');
});
