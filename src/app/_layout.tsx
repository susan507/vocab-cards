import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { syncProfile, useProfile } from '@/lib/prefs';
import { COLORS } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    syncProfile().catch(console.warn);
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Books', headerRight: () => <ProfileButton /> }}
        />
        <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
        <Stack.Screen name="[bookId]/index" options={{ title: '' }} />
        <Stack.Screen name="[bookId]/[chapter]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

function ProfileButton() {
  const profile = useProfile();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profile"
      hitSlop={8}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
    >
      <Ionicons name="person-circle-outline" size={22} color={COLORS.text} />
      <Text style={styles.name}>{profile ? profile.name : 'Guest'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  pressed: { opacity: 0.6 },
  name: { color: COLORS.text, fontSize: 15 },
});
