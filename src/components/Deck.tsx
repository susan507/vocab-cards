import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reorderKeeping } from '@/lib/books';
import { resolveAudio } from '@/lib/offlineAudio';
import { ORDERS, useDeckOrder } from '@/lib/prefs';
import type { Order } from '@/lib/prefs';
import type { Word } from '@/lib/types';
import { COLORS } from '@/theme';

const SWIPE_DISTANCE = 40;
const ROW_HEIGHT = 60;

type DeckView = { items: Word[]; index: number; random: boolean };

/**
 * Full-screen flashcards. Swipe left/right = next/prev, tap = replay audio.
 * `words` is in source order; the saved deck order decides what's shown.
 */
export function Deck({ words, onClose }: { words: Word[]; onClose: () => void }) {
  const [order, setOrder] = useDeckOrder();
  const random = order === 'random';
  const [view, setView] = useState<DeckView>(() => ({
    random,
    ...reorderKeeping(words, undefined, random),
  }));
  // Gesture and key handlers read this so they always act on the card on screen.
  const viewRef = useRef(view);
  const [listOpen, setListOpen] = useState(false);
  const player = useAudioPlayer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const show = useCallback((next: DeckView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  // Called synchronously from gesture and press handlers so mobile browsers allow playback.
  const play = useCallback(
    (word: Word | undefined) => {
      if (!word?.audio) return;
      player.replace({ uri: resolveAudio(word.audio) });
      player.play();
    },
    [player],
  );

  const goTo = useCallback(
    (index: number) => {
      const current = viewRef.current;
      if (index < 0 || index >= current.items.length) return;
      show({ ...current, index });
      play(current.items[index]);
    },
    [play, show],
  );
  const go = useCallback((delta: number) => goTo(viewRef.current.index + delta), [goTo]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    play(viewRef.current.items[0]);
  }, [play]);

  // The saved order can change from the toggle or finish loading after mount.
  useEffect(() => {
    const current = viewRef.current;
    if (current.random === random) return;
    show({ random, ...reorderKeeping(words, current.items[current.index], random) });
  }, [random, words, show]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (listOpen) {
        if (e.key === 'Escape') setListOpen(false);
        return;
      }
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter')
        play(viewRef.current.items[viewRef.current.index]);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, play, onClose, listOpen]);

  const swipe = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-15, 15],
    onDeactivate: e => {
      if (
        Math.abs(e.translationX) > SWIPE_DISTANCE &&
        Math.abs(e.translationX) > Math.abs(e.translationY)
      )
        go(e.translationX < 0 ? 1 : -1);
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    onDeactivate: e => {
      if (!e.canceled) play(viewRef.current.items[viewRef.current.index]);
    },
  });
  const gesture = useExclusiveGestures(swipe, tap);

  const { items, index } = view;
  const word = items[index];
  if (!word) return <View style={styles.root} />;
  const esSize = Math.min(72, Math.max(32, width * 0.1));

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={styles.card}>
          {word.image ? (
            <Image source={{ uri: word.image }} style={styles.image} resizeMode="contain" />
          ) : null}
          <Text style={[styles.es, { fontSize: esSize }]}>{word.es}</Text>
          <Text style={[styles.en, { fontSize: esSize * 0.5 }]}>{word.en}</Text>
          {/* Visual cues only: swipe for prev/next, tap anywhere to replay. */}
          {word.audio ? (
            <Ionicons
              name="volume-high-outline"
              size={28}
              color={COLORS.muted}
              pointerEvents="none"
            />
          ) : null}
          {index > 0 ? (
            <Ionicons
              name="chevron-back"
              size={36}
              color={COLORS.muted}
              pointerEvents="none"
              style={[styles.arrow, { left: 8 }]}
            />
          ) : null}
          {index < items.length - 1 ? (
            <Ionicons
              name="chevron-forward"
              size={36}
              color={COLORS.muted}
              pointerEvents="none"
              style={[styles.arrow, { right: 8 }]}
            />
          ) : null}
        </View>
      </GestureDetector>
      {/* A sibling over the card, not inside the GestureDetector, so its buttons never swipe or replay. */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          onPress={onClose}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.chrome}>✕</Text>
        </Pressable>
        <View style={styles.segmented} accessibilityRole="radiogroup">
          {(Object.keys(ORDERS) as Order[]).map(key => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: order === key }}
              onPress={() => setOrder(key)}
              hitSlop={{ top: 12, bottom: 12 }}
              style={[styles.segment, order === key && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, order === key && styles.segmentTextActive]}>
                {ORDERS[key]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.topRight}>
          <Pressable
            onPress={() => setListOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Word list"
          >
            <Ionicons name="list" size={24} color={COLORS.muted} />
          </Pressable>
          <Text style={styles.chrome}>
            {index + 1} / {items.length}
          </Text>
        </View>
      </View>
      <Modal visible={listOpen} animationType="fade" onRequestClose={() => setListOpen(false)}>
        <View style={[styles.list, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Words</Text>
            <Pressable
              onPress={() => setListOpen(false)}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close word list"
            >
              <Text style={styles.chrome}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={items}
            keyExtractor={(_, i) => String(i)}
            getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
            initialScrollIndex={Math.max(0, index - 2)}
            style={styles.listBody}
            renderItem={({ item, index: i }) => (
              <Pressable
                onPress={() => {
                  setListOpen(false);
                  goTo(i);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  i === index && styles.rowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.rowEs} numberOfLines={1}>
                  {item.es}
                </Text>
                <Text style={styles.rowEn} numberOfLines={1}>
                  {item.en}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
    // Web: no text selection or browser panning while swiping.
    ...(Platform.OS === 'web'
      ? ({ userSelect: 'none', touchAction: 'none', cursor: 'pointer' } as object)
      : null),
  },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 2,
  },
  segment: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: COLORS.text },
  segmentText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: COLORS.background },
  chrome: { color: COLORS.muted, fontSize: 18 },
  arrow: { position: 'absolute', top: '50%', marginTop: -18, opacity: 0.6 },
  image: { width: '60%', height: '30%' },
  es: { color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  en: { color: COLORS.muted, textAlign: 'center' },
  list: { flex: 1, backgroundColor: COLORS.background },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
  listBody: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 20 },
  rowActive: { backgroundColor: COLORS.surface },
  pressed: { opacity: 0.6 },
  rowEs: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  rowEn: { color: COLORS.muted, fontSize: 14 },
});
