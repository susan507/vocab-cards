import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Deck } from '@/components/Deck';
import { chapterDeck, getBook } from '@/lib/books';

export default function ChapterDeckScreen() {
  const { bookId, chapter, section } = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    section?: string;
  }>();
  const book = getBook(bookId);
  const words = useMemo(
    () =>
      book
        ? chapterDeck(book, Number(chapter), section === undefined ? undefined : Number(section))
        : [],
    [book, chapter, section],
  );
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/${bookId}`));
  return <Deck words={words} onClose={close} />;
}
