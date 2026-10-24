import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Deck } from '@/components/Deck';
import { chapterDeck, getBook, shuffle } from '@/lib/books';

export default function ChapterDeckScreen() {
  const { bookId, chapter, section, order } = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    section?: string;
    order?: string;
  }>();
  const book = getBook(bookId);
  const words = useMemo(() => {
    if (!book) return [];
    const deck = chapterDeck(
      book,
      Number(chapter),
      section === undefined ? undefined : Number(section),
    );
    return order === 'random' ? shuffle(deck) : deck;
  }, [book, chapter, section, order]);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/${bookId}`));
  return <Deck words={words} onClose={close} />;
}
