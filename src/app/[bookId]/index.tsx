import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchBox } from '@/components/SearchBox';
import { StarButton } from '@/components/StarButton';
import { Tile, TileGrid, TopicTile, tileStyles } from '@/components/Tile';
import { deckPath, getCatalogBook, searchTopics, topicKey } from '@/lib/books';
import type { CatalogBook } from '@/lib/types';
import { COLORS } from '@/theme';

export default function ChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = getCatalogBook(bookId);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (book ? searchTopics(query, [book]) : []), [book, query]);

  if (!book) return null;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tileStyles.screen}>
      <Stack.Screen options={{ title: book.title }} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search this book" />
      {!query.trim() ? (
        <TileGrid>
          {book.chapters.map((_, c) => (
            <ChapterTile key={c} book={book} chapter={c} />
          ))}
        </TileGrid>
      ) : results.length ? (
        <TileGrid>
          {results.map(t =>
            t.section === undefined ? (
              <ChapterTile key={topicKey(t)} book={book} chapter={t.chapter} />
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

function ChapterTile({ book, chapter: c }: { book: CatalogBook; chapter: number }) {
  const chapter = book.chapters[c];
  const key = topicKey({ book, chapter: c });
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
    </Tile>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.background,
    maxWidth: '100%',
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 6,
  },
  chipText: { color: COLORS.text, fontSize: 14, flexShrink: 1 },
});
