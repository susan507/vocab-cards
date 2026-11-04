import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTileStyles } from '@/components/Tile';
import { useNewPerDay } from '@/lib/prefs';
import { makeStyles, THEMES, useThemeChoice } from '@/theme';

export default function SettingsScreen() {
  const [newPerDay, setNewPerDay] = useNewPerDay();
  const [text, setText] = useState<string>();
  const { theme: current, set: setTheme } = useThemeChoice();
  const styles = useStyles();
  const tileStyles = useTileStyles();
  return (
    <ScrollView contentContainerStyle={[tileStyles.screen, styles.form]}>
      <Text style={styles.label}>New words per day</Text>
      <TextInput
        value={text ?? String(newPerDay)}
        onChangeText={next => {
          const digits = next.replace(/\D/g, '').slice(0, 4);
          setText(digits);
          if (digits) setNewPerDay(Number(digits));
        }}
        onBlur={() => setText(undefined)}
        keyboardType="number-pad"
        accessibilityLabel="New words per day"
        style={styles.input}
      />
      <Text style={styles.note}>
        How many unseen words spaced repetition introduces each day. Words due for review always
        come first.
      </Text>
      <Text style={[styles.label, styles.section]}>Theme</Text>
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {THEMES.map(t => {
          const selected = t === current;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityLabel={t.name}
              accessibilityState={{ checked: selected }}
              onPress={() => setTheme(t)}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: t.bg, borderColor: selected ? current.accent : t.border },
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.dot, { backgroundColor: t.accent }]} />
              </View>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {selected ? '✓ ' : ''}
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles(theme => ({
  form: { gap: 12, maxWidth: 420 },
  label: { color: theme.text, fontSize: 15, fontWeight: '600' },
  section: { marginTop: 12 },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontSize: 16,
  },
  note: { color: theme.muted, fontSize: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 104, padding: 8, gap: 6, borderRadius: 10, borderWidth: 1 },
  selected: { borderWidth: 2, padding: 7 },
  pressed: { opacity: 0.6 },
  chip: {
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 12, fontWeight: '600' },
}));
