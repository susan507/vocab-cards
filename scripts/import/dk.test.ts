import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChapters } from './dk.ts';
import type { DkContent } from './dk.ts';

const content = (chapter: string, texts: string[][]): DkContent => ({
  chapters: [
    {
      chapter: 1,
      title: chapter,
      units: texts.map((t, i) => ({
        unit: 1.1 + i / 10,
        exercises: t.map((text, exercise) => ({
          exercise,
          text,
          filename: `f${i}.${exercise}.mp3`,
        })),
      })),
    },
  ],
});

test('buildChapters joins by unit and exercise, keeping order and headings', () => {
  const es = content('El cuerpo', [
    ['El cuerpo humano', 'la cabeza', 'el hombro'],
    ['Las manos', 'el dedo'],
  ]);
  const en = content('The body', [
    ['The human body', 'head'],
    ['Hands', 'finger'],
  ]);
  const [chapter] = buildChapters(es, en, { '1.1/2': 'shoulder' });
  assert.equal(chapter.title, '1 El cuerpo (The body)');
  assert.deepEqual(
    chapter.sections.map(s => [s.title, s.words.map(w => `${w.es}|${w.en}`)]),
    [
      [
        'El cuerpo humano (The human body)',
        ['El cuerpo humano|The human body', 'la cabeza|head', 'el hombro|shoulder'],
      ],
      ['Las manos (Hands)', ['Las manos|Hands', 'el dedo|finger']],
    ],
  );
  assert.match(chapter.sections[0].words[1].audio!, /\/es\/audio\/f0\.1\.mp3$/);
});

test('buildChapters leaves unmatched English empty', () => {
  const [chapter] = buildChapters(content('A', [['B', 'c']]), content('A', [['B']]), {});
  assert.equal(chapter.sections[0].words[1].en, '');
});
