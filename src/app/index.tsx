import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { StarButton } from '@/components/StarButton';
import { CATALOG, deckPath, loadBook, searchTopics, topicKey, topicLabels } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { downloadBookAudio, isBookDownloaded } from '@/lib/offlineAudio';
import type { DownloadProgress } from '@/lib/offlineAudio';
import { useDeckOrder, useStars } from '@/lib/prefs';
import type { CatalogBook } from '@/lib/types';
import { COLORS } from '@/theme';

const MAX_RESULTS = 100;

export default function BooksScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTopics(query), [query]);
  const { topics: starred } = useStars();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search topics"
        placeholderTextColor={COLORS.muted}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={styles.search}
      />
      {query.trim() ? (
        results.length ? (
          results.slice(0, MAX_RESULTS).map(t => <TopicRow key={topicKey(t)} topic={t} />)
        ) : (
          <Text style={styles.empty}>No matching topics</Text>
        )
      ) : (
        <>
          {starred.length ? (
            <>
              <Text style={styles.heading}>★ Starred</Text>
              {starred.map(t => (
                <TopicRow key={topicKey(t)} topic={t} />
              ))}
              <Text style={styles.heading}>Books</Text>
            </>
          ) : null}
          {CATALOG.map(book => (
            <Fragment key={book.id}>
              <ListRow href={`/${book.id}`} title={book.title} subtitle={book.source.name} />
              {Platform.OS !== 'web' ? <OfflineRow book={book} /> : null}
            </Fragment>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TopicRow({ topic }: { topic: Topic }) {
  const [order] = useDeckOrder();
  const [bookTitle, ...rest] = topicLabels(topic);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(deckPath(topic, order === 'random') as Href)}
      style={({ pressed }) => [styles.topic, pressed && styles.pressed]}
    >
      <View style={styles.topicText}>
        <Text style={styles.bookTitle}>{bookTitle} ›</Text>
        <Text style={styles.topicTitle}>{rest.join(' › ')}</Text>
      </View>
      <StarButton topicKey={topicKey(topic)} />
    </Pressable>
  );
}

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
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingBottom: 24 },
  search: {
    margin: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 16,
  },
  heading: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  empty: { color: COLORS.muted, fontSize: 15, paddingHorizontal: 20 },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 16,
  },
  topicText: { flex: 1 },
  topicTitle: { color: COLORS.text, fontSize: 16 },
  row: { paddingTop: 0, paddingBottom: 14, paddingHorizontal: 20 },
  pressed: { opacity: 0.6 },
  label: { color: COLORS.muted, fontSize: 13 },
  bookTitle: { color: COLORS.muted, fontSize: 12, marginBottom: 2 },
});
