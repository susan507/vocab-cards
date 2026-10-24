import { Fragment, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { BOOKS } from '@/lib/books';
import { downloadBookAudio, isBookDownloaded } from '@/lib/offlineAudio';
import type { DownloadProgress } from '@/lib/offlineAudio';
import type { Book } from '@/lib/types';
import { COLORS } from '@/theme';

export default function BooksScreen() {
  return (
    <ScrollView>
      {BOOKS.map(book => (
        <Fragment key={book.id}>
          <ListRow href={`/${book.id}`} title={book.title} subtitle={book.source.name} />
          {Platform.OS !== 'web' ? <OfflineRow book={book} /> : null}
        </Fragment>
      ))}
    </ScrollView>
  );
}

function OfflineRow({ book }: { book: Book }) {
  const [complete, setComplete] = useState(() => isBookDownloaded(book));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>();

  const start = async () => {
    setBusy(true);
    const result = await downloadBookAudio(book, setProgress);
    setBusy(false);
    setComplete(result.failed === 0);
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
  row: { paddingTop: 0, paddingBottom: 14, paddingHorizontal: 20 },
  pressed: { opacity: 0.6 },
  label: { color: COLORS.muted, fontSize: 13 },
});
