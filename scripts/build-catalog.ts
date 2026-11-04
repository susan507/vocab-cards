import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogEntry } from '../src/lib/books.ts';
import type { Book, Catalog } from '../src/lib/types.ts';

const BOOKS_DIR = 'src/data/books';
export const CATALOG_PATH = 'src/data/catalog.json';

export const buildCatalog = (books: Book[]): Catalog =>
  Object.fromEntries(books.map(book => [book.id, catalogEntry(book)]));

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
