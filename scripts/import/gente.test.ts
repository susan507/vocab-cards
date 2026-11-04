import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChapter, componentData } from './gente.ts';
import type { SdList } from './gente.ts';

const list: SdList = {
  vocabList: { name: 'Unidad 1' },
  vocabTranslations: [
    { id: 1, translationId: 10, createdAt: '2018-01-01', isDeleted: false },
    { id: 2, translationId: 20, createdAt: '2018-01-02', isDeleted: false },
    { id: 3, translationId: 30, createdAt: '2018-01-02', isDeleted: false },
    { id: 4, translationId: 10, createdAt: '2018-01-03', isDeleted: true },
  ],
  translations: [
    {
      id: 10,
      translation: 'country',
      senseId: 100,
      translationImageId: 7,
      headwordArticle: 'el',
      headwordAudioUrl: 'https://a/pais',
    },
    {
      id: 20,
      translation: 'to be',
      senseId: 200,
      translationImageId: null,
      headwordArticle: null,
      headwordAudioUrl: null,
    },
    {
      id: 30,
      translation: 'Cuba',
      senseId: 300,
      translationImageId: null,
      headwordArticle: 'la',
      headwordAudioUrl: 'https://a/cuba',
    },
  ],
  senses: [
    { id: 100, wordId: 1000 },
    { id: 200, wordId: 2000 },
    { id: 300, wordId: 3000 },
  ],
  words: [
    { id: 1000, source: 'país' },
    { id: 2000, source: 'ser' },
    { id: 3000, source: 'Cuba' },
  ],
  translationImages: [{ id: 7, path: '/dictionary-images/original/abc.jpg' }],
};

test('buildChapter orders newest first, joins words and adds topic links', () => {
  const unit = {
    name: 'Unidad 1 - gente',
    articles: [{ title: 'Numbers', path: '/guide/numbers' }],
    vocabLists: [],
  };
  const chapter = buildChapter(unit, [list], { '3': { es: 'Cuba' } });
  assert.equal(chapter.title, 'Unidad 1 - gente');
  assert.deepEqual(chapter.links, [
    { title: 'Numbers', url: 'https://www.spanishdict.com/guide/numbers' },
  ]);
  assert.equal(chapter.sections[0].title, 'Unidad 1');
  assert.deepEqual(chapter.sections[0].words, [
    { id: '3', es: 'Cuba', en: 'Cuba', audio: 'https://a/cuba' },
    { id: '2', es: 'ser', en: 'to be' },
    {
      id: '1',
      es: 'el país',
      en: 'country',
      audio: 'https://a/pais',
      image: 'https://sd-hegemone-production.sdcdns.com/dictionary-images/300/abc.jpg',
    },
  ]);
});

test('buildChapter omits links when a unit has no topics', () => {
  assert.equal(buildChapter({ name: 'U', articles: [], vocabLists: [] }, [list]).links, undefined);
});

test('componentData reads the embedded page JSON', () => {
  const html = '<script>window.SD_COMPONENT_DATA = {"a":{"b":1}};</script>';
  assert.deepEqual(componentData(html), { a: { b: 1 } });
});
