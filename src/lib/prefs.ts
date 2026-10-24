import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { topicFromKey } from './books';
import { credentials } from './credentials';
import { supabase } from './supabase';
import type { AuthResponse } from '@supabase/supabase-js';

// In-memory mirror of AsyncStorage so every mounted screen sees a change at once.
const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function save(key: string, value: string) {
  cache.set(key, value);
  listeners.forEach(l => l());
  AsyncStorage.setItem(key, value).catch(() => {});
}

export async function loadPersisted(key: string) {
  if (!cache.has(key)) {
    const saved = await AsyncStorage.getItem(key).catch(() => null);
    if (!cache.has(key)) {
      cache.set(key, saved);
      listeners.forEach(l => l());
    }
  }
  return cache.get(key) ?? null;
}

/** Read-modify-write against the loaded value, so concurrent updates don't drop each other. */
export async function updatePersisted(key: string, update: (prev: string | null) => string) {
  await loadPersisted(key);
  save(key, update(cache.get(key) ?? null));
}

/** A null key (not known yet) reads as undefined, like a value still loading. */
export function usePersisted(key: string | null) {
  const value = useSyncExternalStore(subscribe, () => (key === null ? undefined : cache.get(key)));
  useEffect(() => {
    if (key === null || cache.has(key)) return;
    AsyncStorage.getItem(key)
      .then(saved => {
        if (cache.has(key)) return;
        cache.set(key, saved);
        listeners.forEach(l => l());
      })
      .catch(() => {});
  }, [key]);
  return value;
}

export type Profile = { id: string; name: string };

const PROFILE_KEY = 'profile';

const parseProfile = (raw: string | null | undefined): Profile | null => {
  try {
    const p = JSON.parse(raw ?? 'null');
    return typeof p?.id === 'string' && typeof p.name === 'string' ? p : null;
  } catch {
    return null;
  }
};

/** The signed-in profile, null for guest, undefined while loading. */
export function useProfile() {
  const raw = usePersisted(PROFILE_KEY);
  return useMemo(() => (raw === undefined ? undefined : parseProfile(raw)), [raw]);
}

/** Signed-in data lives under its own keys so the guest lists stay untouched. */
const scoped = (profile: Profile | null, key: string) => (profile ? `p:${profile.id}:${key}` : key);

const logError = ({ error }: { error: unknown }) => {
  if (error) console.warn(error);
};

const toSettings = (value: unknown): Record<string, string> =>
  value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string'))
    : {};

const parseSettings = (raw: string | null | undefined) => {
  try {
    return toSettings(JSON.parse(raw ?? '{}'));
  } catch {
    return {};
  }
};

/** Guest settings are separate keys; a profile's are one object mirrored to `profiles.settings`. */
function useSetting(key: string) {
  const profile = useProfile();
  const raw = usePersisted(
    profile === undefined ? null : scoped(profile, profile ? 'settings' : key),
  );
  const value = profile ? parseSettings(raw)[key] : raw;
  const set = (next: string) => {
    if (profile === undefined) return;
    if (!profile) return save(key, next);
    const settingsKey = scoped(profile, 'settings');
    const settings = { ...parseSettings(cache.get(settingsKey)), [key]: next };
    save(settingsKey, JSON.stringify(settings));
    supabase.from('profiles').update({ settings }).eq('id', profile.id).then(logError);
  };
  return [value, set] as const;
}

export const ORDERS = { inOrder: 'In order', random: 'Random' } as const;
export type Order = keyof typeof ORDERS;

export function useDeckOrder() {
  const [saved, set] = useSetting('deckOrder');
  const order: Order = saved === 'random' ? 'random' : 'inOrder';
  return [order, (next: Order) => set(next)] as const;
}

const parseKeys = (raw: string | null | undefined): string[] => {
  try {
    const keys: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

const LISTS = { stars: 'star', done: 'done' } as const;
type List = keyof typeof LISTS;

/** Topic keys in the order they were added. Keys that no longer resolve are dropped. */
function useTopicSet(list: List) {
  const profile = useProfile();
  const storageKey = profile === undefined ? null : scoped(profile, list);
  const raw = usePersisted(storageKey);
  return useMemo(() => {
    const keys = new Set(parseKeys(raw));
    return {
      topics: [...keys].flatMap(k => topicFromKey(k) ?? []),
      has: (key: string) => keys.has(key),
      toggle: (key: string) => {
        if (storageKey === null || !cache.has(storageKey)) return;
        const next = parseKeys(cache.get(storageKey));
        const on = !next.includes(key);
        save(storageKey, JSON.stringify(on ? [...next, key] : next.filter(k => k !== key)));
        if (!profile) return;
        const mark = { user_id: profile.id, kind: LISTS[list], topic_key: key };
        const marks = supabase.from('topic_marks');
        (on ? marks.upsert(mark, { ignoreDuplicates: true }) : marks.delete().match(mark)).then(
          logError,
        );
      },
    };
  }, [raw, storageKey, profile, list]);
}

export const useStars = () => useTopicSet('stars');

/** Chapters marked as learned. */
export const useDone = () => useTopicSet('done');

export function useCollapsed(section: string, byDefault = false) {
  const [saved, set] = useSetting(`collapsed/${section}`);
  const collapsed = saved ? saved === '1' : byDefault;
  return [collapsed, () => set(collapsed ? '0' : '1')] as const;
}

/** Pulls the profile's marks and settings into its local cache, keeping local order. */
async function loadProfile(profile: Profile, mergeGuest: boolean) {
  const [settings, marks] = await Promise.all([
    supabase.from('profiles').select('settings').eq('id', profile.id).maybeSingle(),
    supabase.from('topic_marks').select('kind, topic_key'),
  ]);
  logError(settings);
  logError(marks);
  if (settings.data)
    save(scoped(profile, 'settings'), JSON.stringify(toSettings(settings.data.settings)));
  if (marks.error) return;
  const rows: { kind: string; topic_key: string }[] = marks.data;
  if (mergeGuest) {
    const guest = await Promise.all(
      (Object.keys(LISTS) as List[]).map(async list =>
        parseKeys(await loadPersisted(list)).map(topic_key => ({
          user_id: profile.id,
          kind: LISTS[list],
          topic_key,
        })),
      ),
    );
    if (guest.flat().length) {
      rows.push(...guest.flat());
      logError(await supabase.from('topic_marks').upsert(guest.flat(), { ignoreDuplicates: true }));
    }
  }
  for (const list of Object.keys(LISTS) as List[]) {
    const remote = new Set(rows.filter(r => r.kind === LISTS[list]).map(r => r.topic_key));
    const key = scoped(profile, list);
    const local = parseKeys(await loadPersisted(key)).filter(k => remote.has(k));
    save(key, JSON.stringify([...new Set([...local, ...remote])]));
  }
}

/** Returns an error message, or null once signed in. A new name creates the profile. */
export async function signIn(name: string, pin: string) {
  const creds = credentials(name, pin);
  if (!creds)
    return 'Use up to 30 letters, digits, dots, dashes or underscores for the name and 4–6 digits for the PIN.';
  let result: AuthResponse = await supabase.auth.signInWithPassword(creds);
  let created = false;
  if (result.error?.code === 'invalid_credentials') {
    const signUp = await supabase.auth.signUp({
      ...creds,
      options: { data: { name: name.trim() } },
    });
    if (signUp.error?.code === 'user_already_exists') return 'Wrong PIN for this name.';
    result = signUp;
    created = !signUp.error;
  }
  const { data, error } = result;
  if (error?.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (error?.code === 'validation_failed' || error?.code === 'weak_password')
    return 'That name or PIN isn’t allowed.';
  if (error || !data.user || !data.session)
    return `Couldn’t sign in${error ? `: ${error.message}` : ''}.`;
  const profile = { id: data.user.id, name: String(data.user.user_metadata.name ?? name.trim()) };
  await loadProfile(profile, created);
  save(PROFILE_KEY, JSON.stringify(profile));
  return null;
}

export function signOut() {
  save(PROFILE_KEY, 'null');
  supabase.auth.signOut({ scope: 'local' }).then(logError);
}

/** On start: drop a profile whose session is gone, otherwise refresh it from the server. */
export async function syncProfile() {
  const [{ data }, saved] = await Promise.all([
    supabase.auth.getSession(),
    loadPersisted(PROFILE_KEY),
  ]);
  const user = data.session?.user;
  const profile = parseProfile(saved);
  if (!user || profile?.id !== user.id) {
    if (profile) save(PROFILE_KEY, 'null');
    return;
  }
  await loadProfile(profile, false);
}
