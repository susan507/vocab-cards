import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
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
import { reorderKeeping, wordKey } from '@/lib/books';
import { resolveAudio, resolveImage } from '@/lib/offlineAudio';
import {
  ORDERS,
  useDeckOrder,
  useNewPerDay,
  useNewToday,
  useProgress,
  useSavedSession,
} from '@/lib/prefs';
import type { Order } from '@/lib/prefs';
import {
  answer,
  answerProgress,
  isFirstRound,
  parseSession,
  removeWord,
  setRetired,
  startSession,
  today,
} from '@/lib/srs';
import type { ProgressMap, Session } from '@/lib/srs';
import type { Link, Word } from '@/lib/types';
import { COLORS } from '@/theme';

const SWIPE_DISTANCE = 40;
const ROW_HEIGHT = 60;
// Keeps the card clear of the top bar, mirrored below so text stays centred.
const CHROME_SPACE = 56;
const MODE_ROW = 40;
// Room for the round line, the Yes/No buttons and the retire control under a spaced-repetition card.
const ANSWER_SPACE = 136;

/** Picks a spaced-repetition session's word ids (see srs.ts); `newLeft` is today's remaining new words. */
export type SessionDeck = (progress: ProgressMap, newLeft: number, day: string) => string[];

// `order` is null until the spaced-repetition session is ready (progress still loading).
type DeckView = {
  items: Word[];
  index: number;
  order: Order | null;
  revealed: boolean;
  session: Session | null;
};

/**
 * Full-screen flashcards. Swipe left/right = next/prev, tap = replay audio.
 * `words` is in source order; the saved deck order (or a fixed `mode`) decides what's shown.
 * Spaced repetition: a session of Yes/No rounds over `sessionDeck`'s words, saved under `sessionKey`;
 * tap reveals the English.
 */
export function Deck({
  words,
  bookId,
  sessionKey,
  sessionDeck,
  links,
  mode,
  onClose,
}: {
  words: Word[];
  bookId: string;
  sessionKey: string;
  sessionDeck: SessionDeck;
  links?: Link[];
  mode?: Order;
  onClose: () => void;
}) {
  const [savedOrder, setOrder] = useDeckOrder();
  const order = mode ?? savedOrder;
  const srs = order === 'srs';
  const [progress, setProgress] = useProgress(bookId);
  const [newPerDay] = useNewPerDay();
  const newToday = useNewToday();
  const [savedSession, saveSession] = useSavedSession(sessionKey);
  const byId = useMemo(() => new Map(words.map(w => [w.id, w])), [words]);
  const [view, setView] = useState<DeckView>(() =>
    srs
      ? { items: [], index: 0, order: null, revealed: false, session: null }
      : {
          order,
          revealed: false,
          session: null,
          ...reorderKeeping(words, undefined, order === 'random'),
        },
  );
  // Gesture and key handlers read this so they always act on the card on screen.
  const viewRef = useRef(view);
  const [panel, setPanel] = useState<'words' | 'links'>();
  const player = useAudioPlayer();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

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

  const wordOf = useCallback(
    (v: DeckView) => (v.order === 'srs' ? byId.get(v.session?.queue[0] ?? '') : v.items[v.index]),
    [byId],
  );

  // The saved order can change from the toggle or finish loading after mount.
  useEffect(() => {
    const current = viewRef.current;
    if (current.order === order) return;
    if (order !== 'srs') {
      show({
        order,
        revealed: false,
        session: null,
        ...reorderKeeping(words, wordOf(current), order === 'random'),
      });
      return;
    }
    if (progress === undefined || newToday.count === undefined || savedSession === undefined)
      return;
    const day = today();
    const session =
      parseSession(savedSession, day) ??
      startSession(sessionDeck(progress, Math.max(0, newPerDay - newToday.count), day), day);
    saveSession(session.queue.length ? session : null);
    show({ ...current, order, session, revealed: false });
    play(byId.get(session.queue[0] ?? ''));
  }, [
    order,
    words,
    show,
    play,
    wordOf,
    progress,
    newToday.count,
    newPerDay,
    savedSession,
    saveSession,
    sessionDeck,
    byId,
  ]);

  // Spaced repetition: every action below runs from a press or key handler, so audio may start.
  const reveal = useCallback(() => {
    const current = viewRef.current;
    if (current.order === 'srs' && !current.revealed) show({ ...current, revealed: true });
    play(wordOf(current));
  }, [play, show, wordOf]);

  const moveOn = (session: Session) => {
    // A finished session isn't kept: the next one starts afresh.
    saveSession(session.queue.length ? session : null);
    show({ ...viewRef.current, session, revealed: false });
    play(byId.get(session.queue[0] ?? ''));
  };

  const onAnswer = (yes: boolean) => {
    const current = viewRef.current;
    const { session, revealed } = current;
    const word = wordOf(current);
    if (!session || !word || !revealed || !progress) return;
    if (isFirstRound(session)) {
      const key = wordKey(bookId, word);
      const prev = progress[key];
      setProgress(key, answerProgress(prev, yes, session.day, new Date()));
      if (!prev?.box) newToday.increment();
    }
    moveOn(answer(session, yes));
  };

  const retire = () => {
    const current = viewRef.current;
    const word = wordOf(current);
    if (!current.session || !word || !progress) return;
    const key = wordKey(bookId, word);
    setProgress(key, setRetired(progress[key], true, new Date()));
    moveOn(removeWord(current.session, word.id));
  };

  const onAnswerKey = useEffectEvent(onAnswer);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (panel) {
        if (e.key === 'Escape') setPanel(undefined);
        return;
      }
      const srsKeys = viewRef.current.order === 'srs';
      if (srsKeys && (e.key === 'y' || e.key === 'n')) onAnswerKey(e.key === 'y');
      else if (e.key === 'ArrowRight' && !srsKeys) go(1);
      else if (e.key === 'ArrowLeft' && !srsKeys) go(-1);
      else if (e.key === ' ' || e.key === 'Enter') reveal();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, reveal, onClose, panel]);

  const swipe = usePanGesture({
    runOnJS: true,
    enabled: !srs,
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
      if (!e.canceled) reveal();
    },
  });
  const gesture = useExclusiveGestures(swipe, tap);

  const { items, index, revealed, session } = view;
  const word = wordOf(view);
  const srsReady = srs && view.order === 'srs';
  if (!word && !srsReady) return <View style={styles.root} />;
  // Image cards also size by height so a landscape phone leaves the picture some room.
  const esSize = word
    ? Math.min(72, Math.max(32, (word.image ? Math.min(width, height) : width) * 0.1))
    : 32;
  const bottomSpace = insets.bottom + (srs ? ANSWER_SPACE : CHROME_SPACE);
  // Three modes don't fit beside the other controls on a small phone: they get their own row.
  const narrow = width < 400 && !mode;
  const topSpace = insets.top + CHROME_SPACE + (narrow ? MODE_ROW : 0);
  const modeToggle = (
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
  );

  return (
    <View style={styles.root}>
      {!word ? (
        <View
          style={[
            styles.card,
            { paddingTop: topSpace, paddingBottom: insets.bottom + CHROME_SPACE },
          ]}
        >
          <Text style={styles.doneTitle}>That’s all for now</Text>
          <Text style={styles.en}>Come back later for more.</Text>
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <View style={[styles.card, { paddingTop: topSpace, paddingBottom: bottomSpace }]}>
            {word.image ? (
              <Image
                source={{ uri: resolveImage(word.image) }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : null}
            <Text style={[styles.es, { fontSize: esSize }]}>{word.es}</Text>
            {srs && !revealed ? (
              <Text style={styles.hint}>Tap to see the English</Text>
            ) : (
              <Text style={[styles.en, { fontSize: esSize * 0.5 }]}>{word.en}</Text>
            )}
            {/* Visual cues only: swipe for prev/next, tap anywhere to replay. */}
            {word.audio ? (
              <Ionicons
                name="volume-high-outline"
                size={28}
                color={COLORS.muted}
                pointerEvents="none"
              />
            ) : null}
            {index > 0 && !srs ? (
              <Ionicons
                name="chevron-back"
                size={36}
                color={COLORS.muted}
                pointerEvents="none"
                style={[styles.arrow, { left: 8 }]}
              />
            ) : null}
            {index < items.length - 1 && !srs ? (
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
      )}
      {srs && word ? (
        <>
          <Pressable
            onPress={retire}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="I know this word: don’t show it again"
            style={[styles.retire, { bottom: insets.bottom + 80 }]}
          >
            <Ionicons name="checkmark" size={20} color={COLORS.muted} />
          </Pressable>
          {session ? (
            <Text style={[styles.status, { bottom: insets.bottom + 84 }]}>
              {session.stage === 'revise' ? 'Revise · round ' : 'Round '}
              {session.round} · {session.queue.length} to go · Yes {session.yes.length} · No{' '}
              {session.no.length}
            </Text>
          ) : null}
          {revealed ? (
            <View style={[styles.answers, { bottom: insets.bottom + 16 }]}>
              {(['No', 'Yes'] as const).map(label => (
                <Pressable
                  key={label}
                  onPress={() => onAnswer(label === 'Yes')}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.answer, pressed && styles.pressed]}
                >
                  <Text style={styles.answerText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
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
        {narrow || mode ? <View /> : modeToggle}
        <View style={styles.topRight}>
          {links?.length ? (
            <Pressable
              onPress={() => setPanel('links')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Extra material"
            >
              <Ionicons name="link" size={24} color={COLORS.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setPanel('words')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Word list"
          >
            <Ionicons name="list" size={24} color={COLORS.muted} />
          </Pressable>
          {srs ? null : (
            <Text style={styles.chrome}>
              {index + 1} / {items.length}
            </Text>
          )}
        </View>
      </View>
      {narrow ? <View style={[styles.modeRow, { top: insets.top + 48 }]}>{modeToggle}</View> : null}
      <Modal
        visible={panel !== undefined}
        animationType="fade"
        onRequestClose={() => setPanel(undefined)}
      >
        <View style={[styles.list, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{panel === 'links' ? 'Extra material' : 'Words'}</Text>
            <Pressable
              onPress={() => setPanel(undefined)}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close list"
            >
              <Text style={styles.chrome}>✕</Text>
            </Pressable>
          </View>
          {panel === 'links' ? (
            <FlatList
              data={links}
              keyExtractor={(_, i) => String(i)}
              style={styles.listBody}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => Linking.openURL(item.url).catch(() => {})}
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Text style={styles.rowEs} numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={srs ? words : items}
              keyExtractor={(_, i) => String(i)}
              getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
              initialScrollIndex={srs ? 0 : Math.max(0, index - 2)}
              style={styles.listBody}
              renderItem={({ item, index: i }) => {
                const key = wordKey(bookId, item);
                const retired = srs && progress?.[key]?.retired;
                return (
                  <Pressable
                    // In spaced repetition the list only restores retired words; sessions decide the order.
                    disabled={srs && !retired}
                    onPress={() => {
                      if (!srs) {
                        setPanel(undefined);
                        goTo(i);
                      } else if (retired) {
                        setProgress(key, setRetired(progress?.[key], false, new Date()));
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      retired ? `${item.es}, known. Tap to study again` : undefined
                    }
                    style={({ pressed }) => [
                      styles.row,
                      (srs ? item === word : i === index) && styles.rowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowEs} numberOfLines={1}>
                        {item.es}
                      </Text>
                      <Text style={styles.rowEn} numberOfLines={1}>
                        {item.en}
                      </Text>
                    </View>
                    {retired ? <Ionicons name="checkmark" size={20} color={COLORS.muted} /> : null}
                  </Pressable>
                );
              }}
            />
          )}
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
  modeRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
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
  // Takes whatever height the text leaves, so an image card never overflows a short screen.
  image: { width: '100%', maxWidth: 480, maxHeight: 360, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  es: { color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  en: { color: COLORS.muted, textAlign: 'center' },
  hint: { color: COLORS.muted, fontSize: 15, textAlign: 'center', opacity: 0.7 },
  doneTitle: { color: COLORS.text, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  retire: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    position: 'absolute',
    left: 60,
    right: 60,
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  answers: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    maxWidth: 480,
    marginHorizontal: 'auto',
  },
  answer: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  answerText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
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
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  rowText: { flex: 1 },
  rowActive: { backgroundColor: COLORS.surface },
  pressed: { opacity: 0.6 },
  rowEs: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  rowEn: { color: COLORS.muted, fontSize: 14 },
});
