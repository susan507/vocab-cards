import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { syncProfile, useImportedBooksSync, useProfile } from '@/lib/prefs';
import { makeStyles, useTheme, useThemeChoice } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    syncProfile().catch(console.warn);
  }, []);
  useImportedBooksSync();
  const { theme, loaded } = useThemeChoice();
  useEffect(() => {
    if (Platform.OS !== 'web' || !loaded) return;
    // index.html reads this before JS loads, so a reload starts in the right colour.
    document.documentElement.style.setProperty('--bg', theme.bg);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
    try {
      localStorage.setItem('themeBg', theme.bg);
    } catch {}
  }, [theme, loaded]);
  // Waits a tick for the saved theme rather than flashing the default.
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Books', headerRight: () => <HeaderButtons /> }}
        />
        <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
        <Stack.Screen name="[bookId]/index" options={{ title: '' }} />
        <Stack.Screen name="[bookId]/[chapter]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

function HeaderButtons() {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.buttons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={8}
        onPress={() => router.push('/settings')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="settings-outline" size={20} color={theme.text} />
      </Pressable>
      <ProfileButton />
    </View>
  );
}

function ProfileButton() {
  const profile = useProfile();
  const styles = useStyles();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profile"
      hitSlop={8}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
    >
      <Ionicons name="person-circle-outline" size={22} color={theme.text} />
      <Text style={styles.name}>{profile ? profile.name : 'Guest'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(theme => ({
  buttons: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  pressed: { opacity: 0.6 },
  name: { color: theme.text, fontSize: 15 },
}));
