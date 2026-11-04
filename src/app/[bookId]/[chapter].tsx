import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Deck } from '@/components/Deck';
import type { SessionDeck } from '@/components/Deck';
import { bookDeck, chapterDeck, getLoadedBook, loadBook } from '@/lib/books';
import { chapterSessionIds, reviewSessionIds } from '@/lib/srs';
import type { Book } from '@/lib/types';
import { makeStyles } from '@/theme';

export default function ChapterDeckScreen() {
  const { bookId, chapter, section } = useLocalSearchParams<{
    bookId: string;
    chapter: string;
    section?: string;
  }>();
  // `/<book>/all` is "Review all": spaced repetition over the whole book.
  const all = chapter === 'all';
  const styles = useStyles();
  const [book, setBook] = useState<Book | null | undefined>(() => getLoadedBook(bookId));
  useEffect(() => {
    if (book) return;
    loadBook(bookId)
      .then(b => setBook(b ?? null))
      .catch(() => setBook(null));
  }, [book, bookId]);
  const words = useMemo(() => {
    if (!book) return [];
    if (all) return bookDeck(book);
    return chapterDeck(book, Number(chapter), section === undefined ? undefined : Number(section));
  }, [book, all, chapter, section]);
  const sessionDeck = useCallback<SessionDeck>(
    (progress, newLeft, day, dir) =>
      all
        ? reviewSessionIds(words, bookId, progress, newLeft, day, dir)
        : chapterSessionIds(words, bookId, progress, dir),
    [all, words, bookId],
  );
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/${bookId}`));
  if (book === undefined) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }
  return (
    <Deck
      words={words}
      bookId={bookId}
      sessionKey={all ? `${bookId}/all` : [bookId, chapter, section].filter(Boolean).join('/')}
      sessionDeck={sessionDeck}
      links={all ? undefined : book?.chapters[Number(chapter)]?.links}
      mode={all ? 'srs' : undefined}
      onClose={close}
    />
  );
}

const useStyles = makeStyles(theme => ({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme.muted, fontSize: 16 },
}));
