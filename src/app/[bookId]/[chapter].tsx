import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Deck } from '@/components/Deck';
import { chapterDeck, getLoadedBook, loadBook } from '@/lib/books';
import type { Book } from '@/lib/types';
import { COLORS } from '@/theme';

export default function ChapterDeckScreen() {
  const { bookId, chapter, section } = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    section?: string;
  }>();
  const [book, setBook] = useState<Book | null | undefined>(() => getLoadedBook(bookId));
  useEffect(() => {
    if (book) return;
    loadBook(bookId)
      .then(b => setBook(b ?? null))
      .catch(() => setBook(null));
  }, [book, bookId]);
  const words = useMemo(() => {
    if (!book) return [];
    return chapterDeck(book, Number(chapter), section === undefined ? undefined : Number(section));
  }, [book, chapter, section]);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/${bookId}`));
  if (book === undefined) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }
  return <Deck words={words} onClose={close} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.muted, fontSize: 16 },
});
