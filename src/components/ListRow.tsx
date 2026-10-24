import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS } from '@/theme';

export function ListRow({
  href,
  title,
  subtitle,
  indent,
}: {
  href: Href;
  title: string;
  subtitle?: string;
  indent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, indent && styles.indent, pressed && styles.pressed]}
    >
      <Text style={[styles.title, indent && styles.small]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, paddingHorizontal: 20 },
  indent: { paddingVertical: 10, paddingLeft: 40 },
  pressed: { opacity: 0.6 },
  title: { color: COLORS.text, fontSize: 18 },
  small: { fontSize: 16 },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
});
