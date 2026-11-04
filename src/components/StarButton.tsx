import { Pressable, Text } from 'react-native';
import { useStars } from '@/lib/prefs';
import { makeStyles } from '@/theme';

export function StarButton({ topicKey }: { topicKey: string }) {
  const stars = useStars();
  const starred = stars.has(topicKey);
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={starred ? 'Unstar' : 'Star'}
      accessibilityState={{ selected: starred }}
      hitSlop={8}
      onPress={() => stars.toggle(topicKey)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.star, starred && styles.starred]}>{starred ? '★' : '☆'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(theme => ({
  button: { paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  star: { color: theme.muted, fontSize: 20, lineHeight: 24 },
  starred: { color: theme.accent },
}));
