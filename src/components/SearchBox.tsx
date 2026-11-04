import { TextInput } from 'react-native';
import { makeStyles, useTheme } from '@/theme';

export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      autoCorrect={false}
      autoCapitalize="none"
      clearButtonMode="while-editing"
      returnKeyType="search"
      style={styles.search}
    />
  );
}

const useStyles = makeStyles(theme => ({
  search: {
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontSize: 16,
  },
}));
