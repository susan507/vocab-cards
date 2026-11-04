import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { DownloadControl } from '@/components/DownloadControl';
import { SearchBox } from '@/components/SearchBox';
import { Tile, TileGrid, TopicTile, useTileStyles } from '@/components/Tile';
import { searchTopics, topicKey, useBooks } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { useCollapsed, useDone, useStars } from '@/lib/prefs';
import type { CatalogBook } from '@/lib/types';
import { makeStyles, useTheme } from '@/theme';

const MAX_RESULTS = 100;

export default function BooksScreen() {
  const [query, setQuery] = useState('');
  const books = useBooks();
  const results = useMemo(() => searchTopics(query, books), [query, books]);
  const { topics: starred } = useStars();
  const { topics: learned } = useDone();
  const tileStyles = useTileStyles();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tileStyles.screen}>
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search topics" />
      {query.trim() ? (
        results.length ? (
          <TopicTiles topics={results.slice(0, MAX_RESULTS)} />
        ) : (
          <Text style={tileStyles.empty}>No matching topics</Text>
        )
      ) : (
        <>
          <Section id="books" title="Books">
            <TileGrid>
              {books.map(book => (
                <Tile
                  key={book.id}
                  href={`/${book.id}` as Href}
                  title={book.title}
                  detail={`${book.source.name} · ${book.chapters.length} chapters · ${wordCount(book)} words`}
                >
                  <DownloadControl bookId={book.id} />
                </Tile>
              ))}
            </TileGrid>
          </Section>
          {starred.length ? (
            <Section id="starred" title="★ Starred">
              <TopicTiles topics={starred} />
            </Section>
          ) : null}
          {learned.length ? (
            <Section id="learned" title="✓ Learned" collapsedByDefault>
              <TopicTiles topics={learned} />
            </Section>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Section({
  id,
  title,
  collapsedByDefault,
  children,
}: {
  id: string;
  title: string;
  collapsedByDefault?: boolean;
  children: ReactNode;
}) {
  const [collapsed, toggle] = useCollapsed(id, collapsedByDefault);
  const theme = useTheme();
  const styles = useStyles();
  const tileStyles = useTileStyles();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        onPress={toggle}
        style={({ pressed }) => [styles.heading, pressed && styles.pressed]}
      >
        <Ionicons
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={theme.muted}
        />
        <Text style={tileStyles.heading}>{title}</Text>
      </Pressable>
      {collapsed ? null : children}
    </>
  );
}

const TopicTiles = ({ topics }: { topics: Topic[] }) => (
  <TileGrid>
    {topics.map(t => (
      <TopicTile key={topicKey(t)} topic={t} />
    ))}
  </TileGrid>
);

const wordCount = (book: CatalogBook) =>
  book.chapters.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.count, 0), 0);

const useStyles = makeStyles(theme => ({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
}));
