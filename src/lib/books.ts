import type { Book, Word } from './types';
import usborneFtwEs from '@/data/books/usborne-ftw-es.json';

// Register new imports here.
export const BOOKS: Book[] = [usborneFtwEs];

export const getBook = (id: string) => BOOKS.find(b => b.id === id);

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
