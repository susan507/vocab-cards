import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tileStyles } from '@/components/Tile';
import { useNewPerDay } from '@/lib/prefs';
import { COLORS } from '@/theme';

export default function SettingsScreen() {
  const [newPerDay, setNewPerDay] = useNewPerDay();
  const [text, setText] = useState<string>();
  return (
    <View style={[tileStyles.screen, styles.form]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, maxWidth: 420 },
  label: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 16,
  },
  note: { color: COLORS.muted, fontSize: 13 },
});
