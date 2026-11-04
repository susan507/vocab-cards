import { Stack, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SearchBox } from '@/components/SearchBox';
import { Tile, TileGrid, TopicTile, useTileStyles } from '@/components/Tile';
import { searchTopics, topicKey, useBooks } from '@/lib/books';

export default function ChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = useBooks().find(b => b.id === bookId);
  const [query, setQuery] = useState('');
  const results = useMemo(() => (book ? searchTopics(query, [book]) : []), [book, query]);
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
            <TopicTile key={c} topic={{ book, chapter: c }} inBook />
          ))}
        </TileGrid>
      ) : results.length ? (
        <TileGrid>
          {results.map(t => (
            <TopicTile key={topicKey(t)} topic={t} inBook />
          ))}
        </TileGrid>
      ) : (
        <Text style={tileStyles.empty}>No matching topics</Text>
      )}
    </ScrollView>
  );
}
