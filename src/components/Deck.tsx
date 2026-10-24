import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
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
import { resolveAudio } from '@/lib/offlineAudio';
import type { Word } from '@/lib/types';
import { COLORS } from '@/theme';

const SWIPE_DISTANCE = 40;

/** Full-screen flashcards. Swipe left/right = next/prev, tap = replay audio. */
export function Deck({ words, onClose }: { words: Word[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const player = useAudioPlayer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Called synchronously from gesture handlers so mobile browsers allow playback.
  const play = useCallback(
    (i: number) => {
      const uri = words[i]?.audio;
      if (!uri) return;
      player.replace({ uri: resolveAudio(uri) });
      player.play();
    },
    [player, words],
  );

  const go = useCallback(
    (delta: number) => {
      const next = indexRef.current + delta;
      if (next < 0 || next >= words.length) return;
      indexRef.current = next;
      setIndex(next);
      play(next);
    },
    [play, words.length],
  );

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    play(0);
  }, [play]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') play(indexRef.current);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, play, onClose]);

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
      if (!e.canceled) play(indexRef.current);
    },
  });
  const gesture = useExclusiveGestures(swipe, tap);

  const word = words[index];
  if (!word) return <View style={styles.root} />;
  const esSize = Math.min(72, Math.max(32, width * 0.1));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.root}>
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable
            onPress={onClose}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.chrome}>✕</Text>
          </Pressable>
          <Text style={styles.chrome}>
            {index + 1} / {words.length}
          </Text>
        </View>
        {word.image ? (
          <Image source={{ uri: word.image }} style={styles.image} resizeMode="contain" />
        ) : null}
        <Text style={[styles.es, { fontSize: esSize }]}>{word.es}</Text>
        <Text style={[styles.en, { fontSize: esSize * 0.5 }]}>{word.en}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  },
  chrome: { color: COLORS.muted, fontSize: 18 },
  image: { width: '60%', height: '30%' },
  es: { color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  en: { color: COLORS.muted, textAlign: 'center' },
});
