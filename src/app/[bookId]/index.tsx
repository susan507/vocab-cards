import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StarButton } from '@/components/StarButton';
import { deckPath, getCatalogBook, topicKey } from '@/lib/books';
import type { Topic } from '@/lib/books';
import { ORDERS, useDeckOrder } from '@/lib/prefs';
import type { Order } from '@/lib/prefs';
import { COLORS } from '@/theme';

const PADDING = 16;
const GAP = 12;
const MIN_TILE = 260;
const MAX_WIDTH = 1200;

export default function ChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = getCatalogBook(bookId);
  const [order, setOrder] = useDeckOrder();
  const { width } = useWindowDimensions();

  if (!book) return null;

  const inner = Math.min(width, MAX_WIDTH) - PADDING * 2;
  const columns = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
  const tileWidth = (inner - GAP * (columns - 1)) / columns;
  const open = (topic: Topic) => router.push(deckPath(topic, order === 'random') as Href);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: book.title }} />
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {(Object.keys(ORDERS) as Order[]).map(key => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: order === key }}
            onPress={() => setOrder(key)}
            style={[styles.segment, order === key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, order === key && styles.segmentTextActive]}>
              {ORDERS[key]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {book.chapters.map((chapter, c) => {
          const count = chapter.sections.reduce((n, s) => n + s.count, 0);
          return (
            <Pressable
              key={c}
              accessibilityRole="link"
              onPress={() => open({ book, chapter: c })}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>{chapter.title}</Text>
                <StarButton topicKey={topicKey({ book, chapter: c })} />
              </View>
              <Text style={styles.count}>{count} words</Text>
              {chapter.sections.length > 1 ? (
                <View style={styles.chips}>
                  {chapter.sections.map((section, s) => (
                    <Pressable
                      key={s}
                      accessibilityRole="link"
                      onPress={() => open({ book, chapter: c, section: s })}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    >
                      <Text style={styles.chipText}>{section.title ?? `Part ${s + 1}`}</Text>
                      <StarButton topicKey={topicKey({ book, chapter: c, section: s })} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: PADDING, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  segmented: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segment: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8 },
  segmentActive: { backgroundColor: COLORS.text },
  segmentText: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
  segmentTextActive: { color: COLORS.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16 },
  pressed: { opacity: 0.6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '600', flex: 1 },
  count: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
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
