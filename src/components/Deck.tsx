import Ionicons from '@expo/vector-icons/Ionicons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
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
import { reorderKeeping, spokenText } from '@/lib/books';
import { resolveAudio, resolveImage } from '@/lib/offlineAudio';
import { ORDERS, useDeckOrder, useDirection, useProgress, useSavedSession } from '@/lib/prefs';
import type { Order } from '@/lib/prefs';
import {
  answer,
  answerProgress,
  answerReview,
  chapterSessionIds,
  DIRECTIONS,
  drillPile,
  dueSessionIds,
  nextDueIn,
  openReview,
  parseReview,
  isUntouched,
  parseSession,
  progressKey,
  removeFromReview,
  removeWord,
  reviewCurrent,
  reviewOrder,
  setRetired,
  shakiestIds,
  startReview,
  startSession,
  today,
} from '@/lib/srs';
import type { Direction, ProgressMap, Review, Session } from '@/lib/srs';
import type { Link, Word } from '@/lib/types';
import { makeStyles, useTheme } from '@/theme';

const SWIPE_DISTANCE = 40;
const ROW_HEIGHT = 60;
// Keeps the card clear of the top bar, mirrored below so text stays centred.
const CHROME_SPACE = 56;
const MODE_ROW = 40;
// Room for the round line, the Yes/No buttons and the retire control under a spaced-repetition card.
const ANSWER_SPACE = 136;

// `order` is null until the spaced-repetition session is ready (progress still loading).
type DeckView = {
  items: Word[];
  index: number;
  order: Order | null;
  /** The direction `session` belongs to. */
  dir: Direction;
  revealed: boolean;
  /** A chapter's spaced-repetition session. */
  session: Session | null;
  /** "Review all" instead of a session. */
  review: Review | null;
  /** The chapter had nothing due when opened. */
  caughtUp: boolean;
};

const NO_SRS = { revealed: false, session: null, review: null, caughtUp: false };

/**
 * Full-screen flashcards. Swipe left/right = next/prev, tap = replay audio.
 * `words` is in source order; the saved deck order (or a fixed `mode`) decides what's shown.
 * Spaced repetition: a session of Yes/No rounds over `words` (or, with `review`, the whole-book
 * review queue), saved under `sessionKey`; tap reveals the other side. The direction setting decides
 * which side is the prompt.
 */
export function Deck({
  words,
  bookId,
  sessionKey,
  review: isReview,
  links,
  mode,
  onClose,
}: {
  words: Word[];
  bookId: string;
  sessionKey: string;
  review?: boolean;
  links?: Link[];
  mode?: Order;
  onClose: () => void;
}) {
  const [savedOrder, setOrder] = useDeckOrder();
  const order = mode ?? savedOrder;
  const srs = order === 'srs';
  const [dir, setDir] = useDirection();
  // EN→ES spaced repetition: the Spanish audio would give the answer away, so it waits for the reveal.
  const autoPlay = dir === 'esEn';
  const [progress, setProgress] = useProgress(bookId);
  const [savedSession, saveSession] = useSavedSession(sessionKey, dir);
  const byId = useMemo(() => new Map(words.map(w => [w.id, w])), [words]);
  const reviewIds = useMemo(
    () => (isReview && progress ? reviewOrder(words, bookId, progress, today(), dir) : []),
    [isReview, words, bookId, progress, dir],
  );
  const [view, setView] = useState<DeckView>(() =>
    srs
      ? { items: [], index: 0, order: null, dir, ...NO_SRS }
      : { order, dir, ...NO_SRS, ...reorderKeeping(words, undefined, order === 'random') },
  );
  // Gesture and key handlers read this so they always act on the card on screen.
  const viewRef = useRef(view);
  const [panel, setPanel] = useState<'words' | 'links'>();
  const player = useAudioPlayer();
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const show = useCallback((next: DeckView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  // Called synchronously from gesture and press handlers so mobile browsers allow playback.
  // A word without a recording is read out by text-to-speech.
  const play = useCallback(
    (word: Word | undefined) => {
      if (!word) return;
      Speech.stop();
      if (!word.audio) {
        Speech.speak(spokenText(word.es), { language: 'es-ES' });
        return;
      }
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
    (v: DeckView) =>
      v.order !== 'srs'
        ? v.items[v.index]
        : byId.get((v.review ? reviewCurrent(v.review, reviewIds) : v.session?.queue[0]) ?? ''),
    [byId, reviewIds],
  );

  // The saved order and direction can change from the toggles or finish loading after mount.
  useEffect(() => {
    const current = viewRef.current;
    if (current.order === order && (order !== 'srs' || current.dir === dir)) return;
    if (order !== 'srs') {
      show({
        order,
        dir,
        ...NO_SRS,
        ...reorderKeeping(words, wordOf(current), order === 'random'),
      });
      return;
    }
    if (progress === undefined || savedSession === undefined) return;
    const day = today();
    let next: DeckView;
    if (isReview) {
      const review = openReview(parseReview(savedSession, day) ?? startReview(day), reviewIds);
      saveSession(review);
      next = { ...current, order, dir, ...NO_SRS, review };
    } else {
      const parsed = parseSession(savedSession, day);
      const saved = parsed && !isUntouched(parsed) ? parsed : null;
      const ids = saved ? [] : dueSessionIds(words, bookId, progress, day, dir);
      const session = saved ?? startSession(ids, day);
      saveSession(session.queue.length ? session : null);
      next = { ...current, order, dir, ...NO_SRS, session, caughtUp: !saved && !ids.length };
    }
    show(next);
    if (autoPlay) play(wordOf(next));
  }, [
    order,
    dir,
    autoPlay,
    words,
    show,
    play,
    wordOf,
    progress,
    savedSession,
    saveSession,
    isReview,
    reviewIds,
    bookId,
  ]);

  // Spaced repetition: every action below runs from a press or key handler, so audio may start.
  const reveal = useCallback(() => {
    const current = viewRef.current;
    if (current.order === 'srs' && !current.revealed) show({ ...current, revealed: true });
    play(wordOf(current));
  }, [play, show, wordOf]);

  const moveOn = (change: Partial<Pick<DeckView, 'session' | 'review'>>) => {
    const next = { ...viewRef.current, ...change, revealed: false, caughtUp: false };
    // A finished chapter session isn't kept: the next one starts afresh.
    saveSession(next.review ?? (next.session?.queue.length ? next.session : null));
    show(next);
    if (autoPlay) play(wordOf(next));
  };

  const onAnswer = (yes: boolean) => {
    const current = viewRef.current;
    const { session, review, revealed } = current;
    const word = wordOf(current);
    if (!word || !revealed || !progress || current.dir !== dir) return;
    const key = progressKey(bookId, word, dir);
    const prev = progress[key];
    const next = answerProgress(prev, yes, (review ?? session)?.day ?? today(), new Date());
    if (next !== prev) setProgress(key, next);
    if (review) moveOn({ review: answerReview(review, yes, reviewIds) });
    else if (session) moveOn({ session: answer(session, yes) });
  };

  const retire = () => {
    const current = viewRef.current;
    const { session, review } = current;
    const word = wordOf(current);
    if (!word || !progress || current.dir !== dir) return;
    const key = progressKey(bookId, word, dir);
    setProgress(key, setRetired(progress[key], true, new Date()));
    if (review) moveOn({ review: removeFromReview(review, word.id, reviewIds) });
    else if (session) moveOn({ session: removeWord(session, word.id) });
  };

  /** From the caught-up screen: a session over another chapter deck. */
  const startAnyway = (ids: string[]) =>
    moveOn({ session: startSession(ids, today()), review: null });

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

  const { items, index, revealed, session, review, caughtUp } = view;
  const rounds = review ? review.drill : session;
  const word = wordOf(view);
  const srsReady = srs && view.order === 'srs';
  if (!word && !srsReady) return <View style={styles.root} />;
  // Image cards also size by height so a landscape phone leaves the picture some room.
  const esSize = word
    ? Math.min(72, Math.max(32, (word.image ? Math.min(width, height) : width) * 0.1))
    : 32;
  const bottomSpace = insets.bottom + (srs ? ANSWER_SPACE : CHROME_SPACE);
  // The mode and direction toggles don't fit beside the other controls on a phone: they get their own row.
  const narrow = width < 480 && !mode;
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
  const nextDir: Direction = dir === 'esEn' ? 'enEs' : 'esEn';
  const dirToggle = (
    <Pressable
      onPress={() => {
        setDir(nextDir);
        // Space and Enter reveal the card; left focused here they would also switch back.
        if (Platform.OS === 'web') (document.activeElement as HTMLElement | null)?.blur();
      }}
      hitSlop={{ top: 12, bottom: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`Direction ${DIRECTIONS[dir]}. Switch to ${DIRECTIONS[nextDir]}`}
      style={[styles.segmented, styles.segment]}
    >
      <Text style={styles.segmentText}>{DIRECTIONS[dir]}</Text>
    </Pressable>
  );
  const toggles = (
    <View style={styles.toggles}>
      {mode ? null : modeToggle}
      {dirToggle}
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
          {caughtUp || review ? (
            <CaughtUp
              words={words}
              bookId={bookId}
              progress={progress ?? {}}
              dir={dir}
              review={!!review}
              onStart={startAnyway}
            />
          ) : (
            <>
              <Text style={styles.doneTitle}>That’s all for now</Text>
              <Text style={styles.en}>Come back later for more.</Text>
            </>
          )}
        </View>
      ) : (
        <GestureDetector gesture={gesture}>
          <View style={[styles.card, { paddingTop: topSpace, paddingBottom: bottomSpace }]}>
            {word.image ? (
              <Image
                source={{ uri: resolveImage(word.image) }}
                // ES→EN spaced repetition: the picture gives the answer away. Hidden, not removed, so nothing moves on reveal.
                style={[styles.image, srs && dir === 'esEn' && !revealed && styles.hidden]}
                resizeMode="contain"
              />
            ) : null}
            <Text style={[styles.es, { fontSize: esSize }]}>
              {dir === 'esEn' ? word.es : word.en}
            </Text>
            {srs && !revealed ? (
              <Text style={styles.hint}>
                Tap to see the {dir === 'esEn' ? 'English' : 'Spanish'}
              </Text>
            ) : (
              <Text style={[styles.en, { fontSize: esSize * 0.5 }]}>
                {dir === 'esEn' ? word.en : word.es}
              </Text>
            )}
            {/* Visual cues only: swipe for prev/next, tap anywhere to replay. */}
            <Ionicons
              name="volume-high-outline"
              size={28}
              color={theme.muted}
              pointerEvents="none"
            />
            {index > 0 && !srs ? (
              <Ionicons
                name="chevron-back"
                size={36}
                color={theme.muted}
                pointerEvents="none"
                style={[styles.arrow, { left: 8 }]}
              />
            ) : null}
            {index < items.length - 1 && !srs ? (
              <Ionicons
                name="chevron-forward"
                size={36}
                color={theme.muted}
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
            <Ionicons name="checkmark" size={20} color={theme.muted} />
          </Pressable>
          {review && !review.drill ? (
            review.pile.length ? (
              <Pressable
                onPress={() => moveOn({ review: drillPile(review) })}
                hitSlop={8}
                accessibilityRole="button"
                style={[styles.status, { bottom: insets.bottom + 84 }]}
              >
                <Text style={[styles.statusText, styles.drill]}>
                  Drill No pile ({review.pile.length})
                </Text>
              </Pressable>
            ) : null
          ) : rounds ? (
            <Text style={[styles.status, styles.statusText, { bottom: insets.bottom + 84 }]}>
              {review
                ? 'No pile · round '
                : rounds.stage === 'revise'
                  ? 'Revise · round '
                  : 'Round '}
              {rounds.round} · {rounds.queue.length} to go · Yes {rounds.yes.length} · No{' '}
              {rounds.no.length}
            </Text>
          ) : null}
          {revealed ? (
            <View style={[styles.answers, { bottom: insets.bottom + 16 }]}>
              {(['No', 'Yes'] as const).map(label => (
                <Pressable
                  key={label}
                  onPress={() => onAnswer(label === 'Yes')}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.answer,
                    label === 'Yes' && styles.yes,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.answerText, label === 'Yes' && styles.yesText]}>
                    {label}
                  </Text>
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
        {narrow ? <View /> : toggles}
        <View style={styles.topRight}>
          {links?.length ? (
            <Pressable
              onPress={() => setPanel('links')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Extra material"
            >
              <Ionicons name="link" size={24} color={theme.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setPanel('words')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Word list"
          >
            <Ionicons name="list" size={24} color={theme.muted} />
          </Pressable>
          {srs ? null : (
            <Text style={styles.chrome}>
              {index + 1} / {items.length}
            </Text>
          )}
        </View>
      </View>
      {narrow ? <View style={[styles.modeRow, { top: insets.top + 48 }]}>{toggles}</View> : null}
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
                const key = progressKey(bookId, item, dir);
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
                    {retired ? <Ionicons name="checkmark" size={20} color={theme.muted} /> : null}
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

/** Nothing due: when to come back, and (in a chapter) sessions to run anyway. */
function CaughtUp({
  words,
  bookId,
  progress,
  dir,
  review,
  onStart,
}: {
  words: Word[];
  bookId: string;
  progress: ProgressMap;
  dir: Direction;
  review: boolean;
  onStart: (ids: string[]) => void;
}) {
  const styles = useStyles();
  const day = today();
  const wait = nextDueIn(words, bookId, progress, day, dir);
  const options = review
    ? []
    : ([
        ['Practise the shakiest anyway', shakiestIds(words, bookId, progress, day, dir)],
        ['Run the whole chapter again', chapterSessionIds(words, bookId, progress, dir)],
      ] as const);
  return (
    <>
      <Text style={styles.doneTitle}>All caught up</Text>
      <Text style={styles.en}>
        {wait === undefined
          ? review
            ? 'This reviews the words you’ve studied. Start with a chapter.'
            : 'Nothing to review here.'
          : review
            ? 'Every word you’ve studied has had a turn today. Come back tomorrow.'
            : `Next review ${wait <= 1 ? 'tomorrow' : `in ${wait} days`}.`}
      </Text>
      <View style={styles.catchUp}>
        {options.map(([label, ids]) =>
          ids.length ? (
            <Pressable
              key={label}
              onPress={() => onStart([...ids])}
              accessibilityRole="button"
              style={({ pressed }) => [styles.catchUpButton, pressed && styles.pressed]}
            >
              <Text style={styles.answerText}>{label}</Text>
            </Pressable>
          ) : null,
        )}
      </View>
    </>
  );
}

const useStyles = makeStyles(theme => ({
  root: { flex: 1, backgroundColor: theme.bg },
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 2,
  },
  toggles: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segment: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: theme.accent },
  segmentText: { color: theme.muted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: theme.onAccent },
  chrome: { color: theme.muted, fontSize: 18 },
  arrow: { position: 'absolute', top: '50%', marginTop: -18, opacity: 0.6 },
  // Takes whatever height the text leaves, so an image card never overflows a short screen.
  image: { width: '100%', maxWidth: 480, maxHeight: 360, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  hidden: { opacity: 0 },
  es: { color: theme.text, fontWeight: '600', textAlign: 'center' },
  en: { color: theme.muted, textAlign: 'center' },
  hint: { color: theme.muted, fontSize: 15, textAlign: 'center', opacity: 0.7 },
  doneTitle: { color: theme.text, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  retire: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { position: 'absolute', left: 60, right: 60, alignItems: 'center' },
  statusText: { color: theme.muted, fontSize: 13, textAlign: 'center' },
  drill: { color: theme.accent, fontWeight: '600' },
  catchUp: { gap: 12, alignItems: 'center', marginTop: 12 },
  catchUpButton: {
    minHeight: 48,
    minWidth: 260,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  answerText: { color: theme.text, fontSize: 17, fontWeight: '600' },
  yes: { backgroundColor: theme.accent, borderColor: theme.accent },
  yesText: { color: theme.onAccent },
  list: { flex: 1, backgroundColor: theme.bg },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listTitle: { color: theme.text, fontSize: 18, fontWeight: '600' },
  listBody: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  rowText: { flex: 1 },
  rowActive: { backgroundColor: theme.border },
  pressed: { opacity: 0.6 },
  rowEs: { color: theme.text, fontSize: 17, fontWeight: '600' },
  rowEn: { color: theme.muted, fontSize: 14 },
}));
