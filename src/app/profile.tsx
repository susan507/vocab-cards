import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTileStyles } from '@/components/Tile';
import { signIn, signOut, useProfile } from '@/lib/prefs';
import { makeStyles, useTheme } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ProfileScreen() {
  const profile = useProfile();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const theme = useTheme();
  const styles = useStyles();
  const tileStyles = useTileStyles();

  const submit = async () => {
    setBusy(true);
    setError(null);
    const message = await signIn(name, pin).catch(() => 'Couldn’t reach the server.');
    setBusy(false);
    if (message) setError(message);
    else close();
  };

  if (profile)
    return (
      <View style={[tileStyles.screen, styles.form]}>
        <Text style={styles.text}>
          Signed in as {profile.name}. Your stars, learned topics and word progress sync across
          devices.
        </Text>
        <Button
          label="Sign out"
          onPress={() => {
            signOut();
            close();
          }}
        />
      </View>
    );

  return (
    <View style={[tileStyles.screen, styles.form]}>
      <Text style={styles.text}>
        Sign in to keep your own stars, learned topics and word progress on every device. A new name
        creates a profile.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        style={styles.input}
      />
      <TextInput
        value={pin}
        onChangeText={text => setPin(text.replace(/\D/g, ''))}
        placeholder="PIN (4–6 digits)"
        placeholderTextColor={theme.muted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        onSubmitEditing={submit}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={busy ? 'Signing in…' : 'Sign in / create'} onPress={submit} disabled={busy} />
      <Text style={styles.note}>
        Profiles are not secure: anyone who knows your name and PIN can use it. Don’t reuse a real
        PIN.
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.pressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(theme => ({
  form: { gap: 12, maxWidth: 420 },
  text: { color: theme.text, fontSize: 15 },
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
  error: { color: theme.danger, fontSize: 14 },
  note: { color: theme.muted, fontSize: 13 },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: theme.onAccent, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}));
