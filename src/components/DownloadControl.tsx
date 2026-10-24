import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useOfflineStatus } from '@/lib/offlineAudio';
import type { DownloadJob, OfflineStatus } from '@/lib/offlineAudio';
import { COLORS } from '@/theme';

/** Whole-book row without `chapter`; a compact icon for a chapter tile corner with it. */
export function DownloadControl({ bookId, chapter }: { bookId: string; chapter?: number }) {
  const status = useOfflineStatus(bookId);
  if (!status.downloaded) return null;
  return chapter === undefined ? (
    <BookControl status={status} downloaded={status.downloaded} />
  ) : (
    <ChapterControl status={status} downloaded={status.downloaded} chapter={chapter} />
  );
}

type Props = { status: OfflineStatus; downloaded: ReadonlySet<number> };

const progressText = (job: DownloadJob) => `${job.done}/${job.total}`;

function BookControl({ status, downloaded }: Props) {
  const job = status.book;
  const complete = downloaded.size >= status.chapterCount;
  const label = job?.running
    ? `Downloading ${progressText(job)}`
    : complete
      ? 'Available offline'
      : job?.failed
        ? `${job.failed} failed — tap to retry`
        : downloaded.size
          ? `${downloaded.size}/${status.chapterCount} chapters offline — tap to download all`
          : 'Download for offline';
  const actionable = !job?.running && !complete;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !actionable }}
      onPress={actionable ? status.downloadBook : undefined}
      style={({ pressed }) => [styles.row, actionable && pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function ChapterControl({ status, downloaded, chapter }: Props & { chapter: number }) {
  const job = status.chapter(chapter);
  const complete = downloaded.has(chapter);
  const running = !complete && (job?.running || status.book?.running);
  const actionable = !complete && !running;
  return (
    // Stays enabled when idle so a tap never falls through to the parent tile.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        complete
          ? 'Available offline'
          : running
            ? 'Downloading'
            : job?.failed
              ? `${job.failed} failed, retry download`
              : 'Download for offline'
      }
      accessibilityState={{ disabled: !actionable }}
      hitSlop={8}
      onPress={actionable ? () => status.downloadChapter(chapter) : undefined}
      style={({ pressed }) => [styles.icon, actionable && pressed && styles.pressed]}
    >
      {complete ? (
        <Ionicons name="checkmark-circle" size={20} color={COLORS.muted} />
      ) : job?.running && job.total ? (
        <Text style={styles.progress}>{progressText(job)}</Text>
      ) : running ? (
        <ActivityIndicator size="small" color={COLORS.muted} />
      ) : job?.failed ? (
        <Ionicons name="alert-circle-outline" size={20} color="#ffd166" />
      ) : (
        <Ionicons name="cloud-download-outline" size={20} color={COLORS.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingTop: 0, paddingBottom: 14, paddingHorizontal: 20 },
  label: { color: COLORS.muted, fontSize: 13 },
  icon: { minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  progress: { color: COLORS.muted, fontSize: 11 },
  pressed: { opacity: 0.6 },
});
