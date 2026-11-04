import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SearchBox } from '@/components/SearchBox';
import { DownloadControl } from '@/components/DownloadControl';
import { StarButton } from '@/components/StarButton';
import { Tile, TileGrid, TopicTile, useTileStyles } from '@/components/Tile';
import {
  chapterDeck,
  deckPath,
  getCatalogBook,
  getLoadedBook,
  loadBook,
  searchTopics,
  topicKey,
} from '@/lib/books';
import { useProgress } from '@/lib/prefs';
import { strength, today } from '@/lib/srs';
import type { Book, CatalogBook } from '@/lib/types';
import { makeStyles, useTheme } from '@/theme';

export default function ChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = getCatalogBook(bookId);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (book ? searchTopics(query, [book]) : []), [book, query]);
  const strengths = useChapterStrengths(bookId);
  const tileStyles = useTileStyles();

  if (!book) return null;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tileStyles.screen}>
      <Stack.Screen options={{ title: book.title }} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search this book" />
      {!query.trim() ? (
        <TileGrid>
          <Tile
            href={`/${book.id}/all` as Href}
            title="Review all"
            detail="Spaced repetition over every word in the book"
          />
          {book.chapters.map((_, c) => (
            <ChapterTile key={c} book={book} chapter={c} strength={strengths?.[c]} />
          ))}
        </TileGrid>
      ) : results.length ? (
        <TileGrid>
          {results.map(t =>
            t.section === undefined ? (
              <ChapterTile
                key={topicKey(t)}
                book={book}
                chapter={t.chapter}
                strength={strengths?.[t.chapter]}
              />
            ) : (
              <TopicTile key={topicKey(t)} topic={t} inBook />
            ),
          )}
        </TileGrid>
      ) : (
        <Text style={tileStyles.empty}>No matching topics</Text>
      )}
    </ScrollView>
  );
}

/** Per chapter, how well its studied words are remembered right now (0–1), once any are studied. */
function useChapterStrengths(bookId: string) {
  const [progress] = useProgress(bookId);
  const studied = !!progress && Object.keys(progress).length > 0;
  const [book, setBook] = useState<Book | undefined>(() => getLoadedBook(bookId));
  useEffect(() => {
    if (studied && !book) loadBook(bookId).then(setBook, () => {});
  }, [studied, book, bookId]);
  return useMemo(() => {
    if (!book || !progress || !studied) return undefined;
    const day = today();
    return book.chapters.map((_, c) => strength(chapterDeck(book, c), bookId, progress, day));
  }, [book, progress, studied, bookId]);
}

function ChapterTile({
  book,
  chapter: c,
  strength,
}: {
  book: CatalogBook;
  chapter: number;
  strength?: number;
}) {
  const chapter = book.chapters[c];
  const key = topicKey({ book, chapter: c });
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Tile
      href={deckPath({ book, chapter: c }) as Href}
      title={chapter.title}
      detail={`${chapter.sections.reduce((n, s) => n + s.count, 0)} words`}
      starKey={key}
      doneKey={key}
    >
      {chapter.sections.length > 1 ? (
        <View style={styles.chips}>
          {chapter.sections.map((section, s) => (
            <Pressable
              key={s}
              accessibilityRole="link"
              onPress={() => router.push(deckPath({ book, chapter: c, section: s }) as Href)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipText}>{section.title ?? `Part ${s + 1}`}</Text>
              <StarButton topicKey={topicKey({ book, chapter: c, section: s })} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {strength === undefined ? null : (
        <View
          style={styles.bar}
          accessibilityLabel="How well you remember this chapter"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(strength * 100) }}
        >
          <View style={[styles.barFill, { width: `${strength * 100}%` }]} />
        </View>
      )}
      <View style={styles.footer}>
        {chapter.links?.length ? (
          <Ionicons
            name="link"
            size={18}
            color={theme.muted}
            accessibilityLabel="Has extra material"
          />
        ) : null}
        <DownloadControl bookId={book.id} chapter={c} />
      </View>
    </Tile>
  );
}

const useStyles = makeStyles(theme => ({
  pressed: { opacity: 0.6 },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  barFill: { height: '100%', backgroundColor: theme.accent },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.bg,
    maxWidth: '100%',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 6,
  },
  chipText: { color: theme.text, fontSize: 14, flexShrink: 1 },
}));
