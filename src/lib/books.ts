import type { Book, Catalog, CatalogBook, Word } from './types';
import catalogJson from '@/data/catalog.json';

// Register new books here, then run `npm run catalog`. Each loader is a separate web chunk.
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  'usborne-ftw-es': () => import('@/data/books/usborne-ftw-es.json'),
  'dk-idic-es': () => import('@/data/books/dk-idic-es.json'),
};

const catalog: Catalog = catalogJson;

export const CATALOG: CatalogBook[] = Object.keys(LOADERS).map(id => catalog[id]);

export const getCatalogBook = (id: string): CatalogBook | undefined => catalog[id];

const loaded = new Map<string, Book>();

export const getLoadedBook = (id: string) => loaded.get(id);

export async function loadBook(id: string): Promise<Book | undefined> {
  const load = LOADERS[id];
  if (!load) return undefined;
  const book = (await load()).default as Book;
  loaded.set(id, book);
  return book;
}

/**
 * A deck is just an ordered Word[]: the card screen doesn't know where words came from.
 * Future modes (shuffle, multi-chapter review, spaced repetition) build a different array.
 */
export function chapterDeck(book: Book, chapter: number, section?: number): Word[] {
  const sections = book.chapters[chapter]?.sections ?? [];
  return (section === undefined ? sections : sections.slice(section, section + 1)).flatMap(
    s => s.words,
  );
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
