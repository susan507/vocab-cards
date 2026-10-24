import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterAudio } from '../src/lib/books.ts';
import type { Book } from '../src/lib/types.ts';

test('chapterAudio lists every section of one chapter, deduped, in order', () => {
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
              { id: 'c', es: 'c', en: 'c' },
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
  assert.deepEqual(chapterAudio(book, 1), ['u/2.mp3', 'u/3.mp3']);
  assert.deepEqual(chapterAudio(book, 0), ['u/1.mp3']);
  assert.deepEqual(chapterAudio(book, 9), []);
});
