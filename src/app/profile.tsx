import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { tileStyles } from '@/components/Tile';
import { signIn, signOut, useProfile } from '@/lib/prefs';
import { COLORS } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ProfileScreen() {
  const profile = useProfile();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          Signed in as {profile.name}. Your stars and learned topics sync across devices.
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
        Sign in to keep your own stars and learned topics on every device. A new name creates a
        profile.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
        style={styles.input}
      />
      <TextInput
        value={pin}
        onChangeText={text => setPin(text.replace(/\D/g, ''))}
        placeholder="PIN (4–6 digits)"
        placeholderTextColor={COLORS.muted}
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

const styles = StyleSheet.create({
  form: { gap: 12, maxWidth: 420 },
  text: { color: COLORS.text, fontSize: 15 },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 16,
  },
  error: { color: '#ff8fa3', fontSize: 14 },
  note: { color: COLORS.muted, fontSize: 13 },
  button: {
    backgroundColor: COLORS.text,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: COLORS.background, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
