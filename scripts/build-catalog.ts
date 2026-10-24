import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Book, Catalog } from '../src/lib/types.ts';

const BOOKS_DIR = 'src/data/books';
export const CATALOG_PATH = 'src/data/catalog.json';

export function buildCatalog(books: Book[]): Catalog {
  return Object.fromEntries(
    books.map(({ chapters, ...book }) => [
      book.id,
      {
        ...book,
        chapters: chapters.map(c => ({
          title: c.title,
          sections: c.sections.map(s => ({ title: s.title, count: s.words.length })),
        })),
      },
    ]),
  );
}

export const readBooks = (): Book[] =>
  readdirSync(BOOKS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(readFileSync(`${BOOKS_DIR}/${f}`, 'utf8')));

export const catalogJson = () => JSON.stringify(buildCatalog(readBooks()), null, 2) + '\n';

export function writeCatalog() {
  writeFileSync(CATALOG_PATH, catalogJson());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeCatalog();
