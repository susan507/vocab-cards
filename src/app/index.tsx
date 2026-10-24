import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SearchBox } from '@/components/SearchBox';
import { Tile, TileGrid, TopicTile, tileStyles } from '@/components/Tile';
import { CATALOG, loadBook, searchTopics, topicKey } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { downloadBookAudio, isBookDownloaded } from '@/lib/offlineAudio';
import type { DownloadProgress } from '@/lib/offlineAudio';
import { useCollapsed, useDone, useStars } from '@/lib/prefs';
import type { CatalogBook } from '@/lib/types';
import { COLORS } from '@/theme';

const MAX_RESULTS = 100;

export default function BooksScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTopics(query), [query]);
  const { topics: starred } = useStars();
  const { topics: learned } = useDone();

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
              {CATALOG.map(book => (
                <Tile
                  key={book.id}
                  href={`/${book.id}` as Href}
                  title={book.title}
                  detail={`${book.source.name} · ${book.chapters.length} chapters · ${wordCount(book)} words`}
                >
                  {Platform.OS !== 'web' ? <OfflineRow book={book} /> : null}
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
          color={COLORS.muted}
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

function OfflineRow({ book }: { book: CatalogBook }) {
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>();

  useEffect(() => {
    loadBook(book.id)
      .then(full => setComplete(!!full && isBookDownloaded(full)))
      .catch(() => {});
  }, [book.id]);

  const start = async () => {
    setBusy(true);
    const full = await loadBook(book.id);
    const result = full ? await downloadBookAudio(full, setProgress) : undefined;
    setBusy(false);
    setComplete(result?.failed === 0);
  };

  const label = complete
    ? 'Available offline'
    : busy && progress
      ? `Downloading ${progress.done}/${progress.total}`
      : progress?.failed
        ? `${progress.failed} failed, tap to retry`
        : 'Download for offline';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={complete || busy}
      onPress={start}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  row: { marginTop: 12, alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  label: { color: COLORS.muted, fontSize: 13 },
});
