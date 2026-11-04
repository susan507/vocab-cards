import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Children, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { DoneButton } from '@/components/DoneButton';
import { DownloadControl } from '@/components/DownloadControl';
import { StarButton } from '@/components/StarButton';
import { chapterDeck, deckPath, getLoadedBook, loadBook, topicKey, topicLabels } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { useDirection, useDone, useProgress } from '@/lib/prefs';
import { strength, today } from '@/lib/srs';
import type { Book } from '@/lib/types';
import { makeStyles, useTheme } from '@/theme';

const PADDING = 16;
const GAP = 12;
const MIN_TILE = 260;
const MAX_WIDTH = 1200;

/** Wraps children in equal-width columns: one on phones, more as the window widens. */
export function TileGrid({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, MAX_WIDTH) - PADDING * 2;
  const styles = useStyles();
  const columns = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
  const tileWidth = (inner - GAP * (columns - 1)) / columns;
  return (
    <View style={styles.grid}>
      {Children.map(children, child => (
        <View style={{ width: tileWidth }}>{child}</View>
      ))}
    </View>
  );
}

export function Tile({
  href,
  eyebrow,
  title,
  detail,
  starKey,
  doneKey,
  accessory,
  children,
}: {
  href: Href;
  eyebrow?: string;
  title: string;
  detail?: string;
  starKey?: string;
  doneKey?: string;
  /** Small icons on the detail line's right. */
  accessory?: ReactNode;
  children?: ReactNode;
}) {
  const done = useDone();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.tile,
        doneKey && done.has(doneKey) && styles.done,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.titleRow}>
        {doneKey ? <DoneButton topicKey={doneKey} /> : null}
        <View style={styles.text}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {starKey ? <StarButton topicKey={starKey} /> : null}
      </View>
      {detail || accessory ? (
        <View style={styles.detailRow}>
          <Text style={styles.detail}>{detail}</Text>
          {accessory}
        </View>
      ) : null}
      {children}
    </Pressable>
  );
}

/** A chapter or subtopic tile, the same wherever it's shown; the last label is the title, the rest sit above it. */
export function TopicTile({ topic, inBook }: { topic: Topic; inBook?: boolean }) {
  const { book, chapter: c, section } = topic;
  const labels = topicLabels(topic).slice(inBook ? 1 : 0);
  const key = topicKey(topic);
  const chapter = book.chapters[c];
  const isChapter = section === undefined;
  const count = (isChapter ? chapter.sections : [chapter.sections[section]]).reduce(
    (n, s) => n + s.count,
    0,
  );
  const theme = useTheme();
  const styles = useStyles();
  const bar = useChapterStrength(book.id, isChapter ? c : undefined);
  return (
    <Tile
      href={deckPath(topic) as Href}
      eyebrow={labels.slice(0, -1).join(' › ')}
      title={labels[labels.length - 1]}
      detail={`${count} words`}
      starKey={key}
      doneKey={isChapter ? key : undefined}
      accessory={
        isChapter ? (
          <View style={styles.accessory}>
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
        ) : null
      }
    >
      {isChapter && chapter.sections.length > 1 ? (
        <View style={styles.chips}>
          {chapter.sections.map((s, i) => (
            <Pressable
              key={i}
              accessibilityRole="link"
              onPress={() => router.push(deckPath({ book, chapter: c, section: i }) as Href)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipText}>{s.title ?? `Part ${i + 1}`}</Text>
              <StarButton topicKey={topicKey({ book, chapter: c, section: i })} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {bar === undefined ? null : (
        <View
          style={styles.bar}
          accessibilityLabel="How well you remember this chapter"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(bar * 100) }}
        >
          <View style={[styles.barFill, { width: `${bar * 100}%` }]} />
        </View>
      )}
    </Tile>
  );
}

/** How well a chapter's studied words are remembered right now (0–1), once any are studied. */
function useChapterStrength(bookId: string, chapter: number | undefined) {
  const [progress] = useProgress(bookId);
  const [dir] = useDirection();
  const studied = chapter !== undefined && !!progress && Object.keys(progress).length > 0;
  const [book, setBook] = useState<Book | undefined>(() => getLoadedBook(bookId));
  useEffect(() => {
    if (studied && !book) loadBook(bookId).then(setBook, () => {});
  }, [studied, book, bookId]);
  return useMemo(() => {
    if (chapter === undefined || !book || !progress || !studied) return undefined;
    return strength(chapterDeck(book, chapter), bookId, progress, today(), dir);
  }, [chapter, book, progress, studied, bookId, dir]);
}

export const useTileStyles = makeStyles(theme => ({
  screen: { padding: PADDING, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  heading: { color: theme.muted, fontSize: 13, fontWeight: '600', marginVertical: 12 },
  empty: { color: theme.muted, fontSize: 15 },
}));

const useStyles = makeStyles(theme => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
  },
  done: { opacity: 0.7 },
  pressed: { opacity: 0.6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { flex: 1 },
  eyebrow: { color: theme.muted, fontSize: 12, marginBottom: 2 },
  title: { color: theme.text, fontSize: 18, fontWeight: '600' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  detail: { color: theme.muted, fontSize: 13, flexShrink: 1 },
  accessory: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  barFill: { height: '100%', backgroundColor: theme.accent },
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
