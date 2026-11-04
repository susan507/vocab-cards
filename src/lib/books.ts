import { useSyncExternalStore } from 'react';
import type { Book, Catalog, CatalogBook, Word } from './types';
import catalogJson from '@/data/catalog.json';

// Register new books here, then run `npm run catalog`. Each loader is a separate web chunk.
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  'usborne-ftw-es': () => import('@/data/books/usborne-ftw-es.json'),
  'dk-idic-es': () => import('@/data/books/dk-idic-es.json'),
  'gente-hoy-1': () => import('@/data/books/gente-hoy-1.json'),
};

const catalog: Catalog = catalogJson;

/** The bundled books. Screens list `useBooks()`, which adds the ones imported on this device or profile. */
export const CATALOG: CatalogBook[] = Object.keys(LOADERS).map(id => catalog[id]);

/** A book's catalog entry: its titles and word counts, without the words. */
export const catalogEntry = ({ chapters, ...book }: Book): CatalogBook => ({
  ...book,
  chapters: chapters.map(c => ({
    title: c.title,
    sections: c.sections.map(s => ({ title: s.title, count: s.words.length })),
    ...(c.links?.length && { links: c.links }),
  })),
});

const imported = new Map<string, { book: Book; entry: CatalogBook }>();
let books = CATALOG;
const bookListeners = new Set<() => void>();
let markImportedReady: () => void;
const importedReady = new Promise<void>(resolve => (markImportedReady = resolve));

/** Replaces the imported (private) books; ids of bundled books are ignored. */
export function setImportedBooks(list: Book[]) {
  imported.clear();
  for (const book of list)
    if (!LOADERS[book.id]) imported.set(book.id, { book, entry: catalogEntry(book) });
  books = [...CATALOG, ...[...imported.values()].map(i => i.entry)];
  markImportedReady();
  bookListeners.forEach(l => l());
}

const subscribeBooks = (listener: () => void) => {
  bookListeners.add(listener);
  return () => {
    bookListeners.delete(listener);
  };
};

/** Bundled books followed by imported ones. */
export const useBooks = () => useSyncExternalStore(subscribeBooks, () => books);

export const getCatalogBook = (id: string): CatalogBook | undefined =>
  catalog[id] ?? imported.get(id)?.entry;

export const isBundled = (id: string) => id in LOADERS;

/** Global, stable key for per-word progress. */
export const wordKey = (bookId: string, word: Word) => `${bookId}:${word.id}`;

const loaded = new Map<string, Book>();

export const getLoadedBook = (id: string) => loaded.get(id) ?? imported.get(id)?.book;

export async function loadBook(id: string): Promise<Book | undefined> {
  const load = LOADERS[id];
  if (!load) {
    await importedReady;
    return imported.get(id)?.book;
  }
  const book = (await load()).default as Book;
  loaded.set(id, book);
  return book;
}

/** What text-to-speech reads for a word: no verb-irregularity marks or "/a" endings. */
export const spokenText = (es: string) =>
  es
    .replace(/\s*\((?:g|i|ie|ue|u|y|zc)\)/g, '')
    .replace(/\/[a-záéíóúüñ]+/gi, '')
    .trim();

const isString = (v: unknown): v is string => typeof v === 'string';
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const isLinks = (v: unknown) =>
  v === undefined ||
  (Array.isArray(v) && v.every(l => isRecord(l) && isString(l.title) && isString(l.url)));
const isWord = (w: unknown) =>
  isRecord(w) &&
  isString(w.id) &&
  w.id.length > 0 &&
  isString(w.es) &&
  isString(w.en) &&
  (w.audio === undefined || isString(w.audio)) &&
  (w.image === undefined || isString(w.image));
const isChapter = (c: unknown) =>
  isRecord(c) &&
  isString(c.title) &&
  isLinks(c.links) &&
  Array.isArray(c.sections) &&
  c.sections.length > 0 &&
  c.sections.every(
    s =>
      isRecord(s) &&
      (s.title === undefined || isString(s.title)) &&
      Array.isArray(s.words) &&
      s.words.every(isWord),
  );

/** Checks that an imported file is a `Book`; returns it, or why not. */
export function parseBook(value: unknown): Book | string {
  if (!isRecord(value)) return 'Not a book file.';
  const { id, title, source, chapters } = value;
  if (!isString(id) || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id))
    return 'The book id must be lowercase letters, digits and dashes.';
  if (LOADERS[id]) return 'That book is already built in.';
  if (!isString(title) || !title.trim()) return 'The book has no title.';
  if (!isRecord(source) || !isString(source.name) || !isString(source.url))
    return 'The book has no source.';
  if (!Array.isArray(chapters) || !chapters.length || !chapters.every(isChapter))
    return 'The book’s chapters aren’t in the expected format.';
  return value as Book;
}

/**
 * A deck is just an ordered Word[]: the card screen doesn't know where words came from.
 * Other modes build a different array from it (`reorderKeeping`, `srsQueue` in srs.ts).
 */
export function chapterDeck(book: Book, chapter: number, section?: number): Word[] {
  const sections = book.chapters[chapter]?.sections ?? [];
  return (section === undefined ? sections : sections.slice(section, section + 1)).flatMap(
    s => s.words,
  );
}

export const bookDeck = (book: Book): Word[] =>
  book.chapters.flatMap(c => c.sections.flatMap(s => s.words));

export const chapterMedia = (book: Book, chapter: number, kind: 'audio' | 'image') => [
  ...new Set(chapterDeck(book, chapter).flatMap(w => w[kind] ?? [])),
];

/** Collision-safe local name for a downloaded file: a hash of the whole URL, keeping its extension. */
export function mediaFileName(url: string): string {
  // cyrb53
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i++) {
    const ch = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (h2 & 0x1fffff) + (h1 >>> 0)).toString(36);
  const ext = /\.[a-z0-9]{2,5}$/i.exec(url.split(/[?#]/)[0].split('/').pop() ?? '')?.[0] ?? '';
  return hash + ext.toLowerCase();
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `source` in its own or a random order, keeping `current` on screen (first, when shuffled). */
export function reorderKeeping<T>(
  source: readonly T[],
  current: T | undefined,
  random: boolean,
): { items: T[]; index: number } {
  const i = current === undefined ? -1 : source.indexOf(current);
  if (!random) return { items: [...source], index: Math.max(0, i) };
  if (i < 0) return { items: shuffle(source), index: 0 };
  return { items: [source[i], ...shuffle(source.filter((_, j) => j !== i))], index: 0 };
}

/** A chapter, or one subtopic of it. Its key (`book/chapter[/section]`) is what stars store. */
export type Topic = { book: CatalogBook; chapter: number; section?: number };

export const topicKey = ({ book, chapter, section }: Topic) =>
  [book.id, chapter, section].filter(p => p !== undefined).join('/');

export function topicFromKey(key: string): Topic | undefined {
  const [id, c, s] = key.split('/');
  const book = getCatalogBook(id);
  const chapter = book?.chapters[Number(c)];
  if (!book || !chapter) return undefined;
  if (s === undefined) return { book, chapter: Number(c) };
  return chapter.sections[Number(s)] ? { book, chapter: Number(c), section: Number(s) } : undefined;
}

export function topicLabels({ book, chapter, section }: Topic): string[] {
  const c = book.chapters[chapter];
  return [
    book.title,
    c.title,
    ...(section === undefined ? [] : [c.sections[section].title ?? `Part ${section + 1}`]),
  ];
}

export const deckPath = ({ book, chapter, section }: Topic) =>
  `/${book.id}/${chapter}${section === undefined ? '' : `?section=${section}`}`;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Case- and accent-insensitive match on chapter and subtopic titles, in catalog order. */
export function searchTopics(query: string, books: CatalogBook[] = CATALOG): Topic[] {
  const q = fold(query.trim());
  if (!q) return [];
  return books.flatMap(book =>
    book.chapters.flatMap((c, chapter) => [
      ...(fold(c.title).includes(q) ? [{ book, chapter }] : []),
      ...(c.sections.length > 1
        ? c.sections.flatMap((s, section) =>
            s.title && fold(s.title).includes(q) ? [{ book, chapter, section }] : [],
          )
        : []),
    ]),
  );
}
