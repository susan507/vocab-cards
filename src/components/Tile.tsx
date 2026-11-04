import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { DoneButton } from '@/components/DoneButton';
import { StarButton } from '@/components/StarButton';
import { deckPath, topicKey, topicLabels } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { useDone } from '@/lib/prefs';
import { makeStyles } from '@/theme';

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
  children,
}: {
  href: Href;
  eyebrow?: string;
  title: string;
  detail?: string;
  starKey?: string;
  doneKey?: string;
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
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </Pressable>
  );
}

/** A chapter or subtopic tile; the last label is the title, the rest sit above it. */
export function TopicTile({ topic, inBook }: { topic: Topic; inBook?: boolean }) {
  const labels = topicLabels(topic).slice(inBook ? 1 : 0);
  const key = topicKey(topic);
  return (
    <Tile
      href={deckPath(topic) as Href}
      eyebrow={labels.slice(0, -1).join(' › ')}
      title={labels[labels.length - 1]}
      starKey={key}
      doneKey={topic.section === undefined ? key : undefined}
    />
  );
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
  detail: { color: theme.muted, fontSize: 13, marginTop: 4 },
}));
