import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { useDone } from '@/lib/prefs';
import { useTheme } from '@/theme';

export function DoneButton({ topicKey }: { topicKey: string }) {
  const done = useDone();
  const checked = done.has(topicKey);
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Learned"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={() => done.toggle(topicKey)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Ionicons
        name={checked ? 'checkmark-circle' : 'checkmark-circle-outline'}
        size={24}
        color={checked ? theme.accent : theme.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({ pressed: { opacity: 0.6 } });
