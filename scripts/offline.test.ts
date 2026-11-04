import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterMedia, mediaFileName } from '../src/lib/books.ts';
import type { Book } from '../src/lib/types.ts';

test('chapterMedia lists every section of one chapter, deduped, in order', () => {
  const book: Book = {
    id: 'b',
    title: 'B',
    source: { name: '', url: '' },
    chapters: [
      { title: 'One', sections: [{ words: [{ id: 'a', es: 'a', en: 'a', audio: 'u/1.mp3' }] }] },
      {
        title: 'Two',
        sections: [
          {
            words: [
              { id: 'b', es: 'b', en: 'b', audio: 'u/2.mp3' },
              { id: 'c', es: 'c', en: 'c', image: 'i/c.png' },
            ],
          },
          {
            words: [
              { id: 'd', es: 'd', en: 'd', audio: 'u/3.mp3' },
              { id: 'b', es: 'b', en: 'b', audio: 'u/2.mp3' },
            ],
          },
        ],
      },
    ],
  };
  assert.deepEqual(chapterMedia(book, 1, 'audio'), ['u/2.mp3', 'u/3.mp3']);
  assert.deepEqual(chapterMedia(book, 1, 'image'), ['i/c.png']);
  assert.deepEqual(chapterMedia(book, 0, 'audio'), ['u/1.mp3']);
  assert.deepEqual(chapterMedia(book, 0, 'image'), []);
  assert.deepEqual(chapterMedia(book, 9, 'audio'), []);
});

test('mediaFileName is stable, distinct for same-basename URLs, and keeps the extension', () => {
  const a = mediaFileName('https://a.example/x/image.JPG?v=1');
  assert.equal(a, mediaFileName('https://a.example/x/image.JPG?v=1'));
  assert.match(a, /^[0-9a-z]+\.jpg$/);
  assert.notEqual(a, mediaFileName('https://b.example/x/image.JPG?v=1'));
  assert.notEqual(a, mediaFileName('https://a.example/x/image.JPG?v=2'));
  assert.match(mediaFileName('https://picsum.photos/id/237/400/300'), /^[0-9a-z]+$/);
});
