import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CATALOG, parseBook, setImportedBooks, topicFromKey, useBooks } from './books';
import { credentials } from './credentials';
import {
  asSaved,
  forDirection,
  isProgress,
  newestSaved,
  parseProgress,
  parseSaved,
  sameSaved,
  toSaved,
} from './srs';
import type { Direction, Progress, ProgressMap, Review, Saved, Session } from './srs';
import { supabase } from './supabase';
import type { Book } from './types';
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
  return [value, set, raw !== undefined] as const;
}

/** The colour theme's id; the last item is false until the saved value has loaded. */
export const useThemeSetting = () => useSetting('theme');

export const ORDERS = { inOrder: 'In order', random: 'Random', srs: 'Spaced' } as const;
export type Order = keyof typeof ORDERS;

export function useDeckOrder() {
  const [saved, set] = useSetting('deckOrder');
  const order: Order = saved === 'random' || saved === 'srs' ? saved : 'inOrder';
  return [order, (next: Order) => set(next)] as const;
}

/** Which side is the prompt; spaced-repetition progress is kept per direction. */
export function useDirection() {
  const [saved, set] = useSetting('direction');
  const dir: Direction = saved === 'enEs' ? 'enEs' : 'esEn';
  return [dir, (next: Direction) => set(next)] as const;
}

const pushSession = (profile: Profile, sessionKey: string, saved: Saved) =>
  supabase
    .from('study_sessions')
    .upsert({
      user_id: profile.id,
      session_key: sessionKey,
      data: saved,
      updated_at: saved.updatedAt,
    })
    .then(logError);

/** Keeps the newest of the local copy and `remote` on both sides. */
async function mergeSession(profile: Profile, sessionKey: string, remote: Saved | null) {
  const key = scoped(profile, sessionKey);
  const local = parseSaved(await loadPersisted(key));
  const keep = newestSaved(local, remote);
  if (keep === remote) {
    if (remote) save(key, JSON.stringify(remote));
  } else if (keep && keep.updatedAt !== remote?.updatedAt)
    await pushSession(profile, sessionKey, keep);
}

const PULL_TIMEOUT_MS = 3000;

/** Fetches one session's row; gives up after PULL_TIMEOUT_MS (offline) and the local copy is used. */
async function pullSession(profile: Profile, sessionKey: string) {
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), PULL_TIMEOUT_MS));
  const row = supabase
    .from('study_sessions')
    .select('data')
    .eq('session_key', sessionKey)
    .maybeSingle()
    .then(async result => {
      if (result.error) return logError(result);
      await mergeSession(profile, sessionKey, asSaved(result.data?.data));
    });
  await Promise.race([row, timeout]);
}

/**
 * The raw saved spaced-repetition session (or "Review all" state) for a deck and direction, in the
 * `Saved` envelope. Signed in, it's synced with `study_sessions`: pulled each time the deck opens
 * (undefined until then) and written through on every save.
 */
export function useSavedSession(deckKey: string, dir: Direction) {
  const profile = useProfile();
  const sessionKey = forDirection(`session/${deckKey}`, dir);
  const key = profile === undefined ? null : scoped(profile, sessionKey);
  const [pulled, setPulled] = useState<string | null>(null);
  useEffect(() => {
    if (!profile || key === null) return;
    let live = true;
    pullSession(profile, sessionKey)
      .catch(console.warn)
      .finally(() => live && setPulled(key));
    return () => {
      live = false;
    };
  }, [profile, key, sessionKey]);
  const raw = usePersisted(key);
  const set = useCallback(
    (session: Session | Review | null) => {
      if (key === null || sameSaved(parseSaved(cache.get(key)), session)) return;
      const saved = toSaved(session, new Date());
      save(key, JSON.stringify(saved));
      if (profile) pushSession(profile, sessionKey, saved);
    },
    [key, profile, sessionKey],
  );
  return [profile && pulled !== key ? undefined : raw, set] as const;
}

const progressKey = (profile: Profile | null, bookId: string) =>
  scoped(profile, `progress/${bookId}`);

const progressRow = (profile: Profile, wordId: string, { updatedAt, ...data }: Progress) => ({
  user_id: profile.id,
  word_id: wordId,
  data,
  updated_at: updatedAt,
});

/**
 * A book's per-word Leitner progress, keyed by `progressKey` (both directions); undefined while loading.
 * ponytail: one JSON blob per book, rewritten on every answer; split it if a book's progress gets to megabytes.
 */
export function useProgress(bookId: string) {
  const profile = useProfile();
  const key = profile === undefined ? null : progressKey(profile, bookId);
  const raw = usePersisted(key);
  const progress = useMemo(() => (raw === undefined ? undefined : parseProgress(raw)), [raw]);
  const set = (wordId: string, next: Progress) => {
    if (key === null) return;
    updatePersisted(key, prev => JSON.stringify({ ...parseProgress(prev), [wordId]: next }));
    if (profile)
      supabase
        .from('word_progress')
        .upsert(progressRow(profile, wordId, next))
        .then(logError);
  };
  return [progress, set] as const;
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
  // Imported books load after start-up, so their topics resolve once they're in.
  const books = useBooks();
  return useMemo(() => {
    void books;
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
  }, [raw, storageKey, profile, list, books]);
}

export const useStars = () => useTopicSet('stars');

/** Chapters marked as learned. */
export const useDone = () => useTopicSet('done');

const PRIVATE_BOOKS = 'privateBooks';

const validBooks = (list: unknown): Book[] =>
  Array.isArray(list) ? list.filter(b => typeof parseBook(b) !== 'string') : [];

const parseBooks = (raw: string | null | undefined) => {
  try {
    return validBooks(JSON.parse(raw ?? '[]'));
  } catch {
    return [];
  }
};

/**
 * Keeps the books registry in step with the books imported by the current profile (or this
 * device's guest). A profile's copy is a cache of `private_books`, so they work offline.
 */
export function useImportedBooksSync() {
  const profile = useProfile();
  const raw = usePersisted(profile === undefined ? null : scoped(profile, PRIVATE_BOOKS));
  const books = useMemo(() => (raw === undefined ? undefined : parseBooks(raw)), [raw]);
  useEffect(() => {
    if (books) setImportedBooks(books);
  }, [books]);
  return books;
}

/** Adds or replaces an imported book; a profile's goes to the server first. Returns an error message or null. */
export async function importBook(profile: Profile | null, book: Book) {
  if (profile) {
    const { error } = await supabase.from('private_books').upsert({
      user_id: profile.id,
      book_id: book.id,
      data: book,
      updated_at: new Date().toISOString(),
    });
    if (error) return `Couldn’t save the book: ${error.message}`;
  }
  await updatePersisted(scoped(profile, PRIVATE_BOOKS), prev =>
    JSON.stringify([...parseBooks(prev).filter(b => b.id !== book.id), book]),
  );
  return null;
}

/** Removes an imported book. Its stars and word progress stay, so importing it again restores them. */
export async function removeImportedBook(profile: Profile | null, bookId: string) {
  if (profile) {
    const { error } = await supabase
      .from('private_books')
      .delete()
      .match({ user_id: profile.id, book_id: bookId });
    if (error) return `Couldn’t remove the book: ${error.message}`;
  }
  await updatePersisted(scoped(profile, PRIVATE_BOOKS), prev =>
    JSON.stringify(parseBooks(prev).filter(b => b.id !== bookId)),
  );
  return null;
}

export function useCollapsed(section: string, byDefault = false) {
  const [saved, set] = useSetting(`collapsed/${section}`);
  const collapsed = saved ? saved === '1' : byDefault;
  return [collapsed, () => set(collapsed ? '0' : '1')] as const;
}

/** Pulls the profile's marks and settings into its local cache, keeping local order. */
async function loadProfile(profile: Profile, mergeGuest: boolean) {
  const [settings, marks, books] = await Promise.all([
    supabase.from('profiles').select('settings').eq('id', profile.id).maybeSingle(),
    supabase.from('topic_marks').select('kind, topic_key'),
    supabase.from('private_books').select('data').order('book_id'),
  ]);
  logError(settings);
  logError(marks);
  logError(books);
  if (books.data)
    save(scoped(profile, PRIVATE_BOOKS), JSON.stringify(validBooks(books.data.map(r => r.data))));
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
  await Promise.all([loadProgress(profile, mergeGuest), loadSessions(profile)]);
}

/** Merges every saved session of the profile with the local copies (decks also pull theirs on open). */
async function loadSessions(profile: Profile) {
  const { data, error } = await supabase.from('study_sessions').select('session_key, data');
  if (error) return logError({ error });
  await Promise.all(
    (data as { session_key: string; data: unknown }[]).map(row =>
      mergeSession(profile, row.session_key, asSaved(row.data)),
    ),
  );
}

const PAGE = 1000;

/** Merges the profile's word progress with the local copy, newest `updatedAt` per word winning both ways. */
async function loadProgress(profile: Profile, mergeGuest: boolean) {
  const remote = new Map<string, ProgressMap>();
  for (let from = 0; ; from += PAGE) {
    const page = await supabase
      .from('word_progress')
      .select('word_id, data, updated_at')
      .order('word_id')
      .range(from, from + PAGE - 1);
    if (page.error) return logError(page);
    for (const row of page.data as { word_id: string; data: unknown; updated_at: string }[]) {
      const parsed = { ...(row.data as object), updatedAt: new Date(row.updated_at).toISOString() };
      if (!isProgress(parsed)) continue;
      const bookId = row.word_id.split(':')[0];
      const book = remote.get(bookId) ?? {};
      book[row.word_id] = parsed;
      remote.set(bookId, book);
    }
    if (page.data.length < PAGE) break;
  }
  const upload = new Map<string, Progress>();
  const imported = parseBooks(await loadPersisted(scoped(profile, PRIVATE_BOOKS)));
  const bookIds = new Set([
    ...CATALOG.map(b => b.id),
    ...imported.map(b => b.id),
    ...remote.keys(),
  ]);
  for (const id of bookIds) {
    const key = progressKey(profile, id);
    const merged = { ...remote.get(id) };
    const local = [
      ...(mergeGuest
        ? Object.entries(parseProgress(await loadPersisted(progressKey(null, id))))
        : []),
      ...Object.entries(parseProgress(await loadPersisted(key))),
    ];
    for (const [wordId, p] of local) {
      if (merged[wordId] && merged[wordId].updatedAt >= p.updatedAt) continue;
      merged[wordId] = p;
      upload.set(wordId, p);
    }
    save(key, JSON.stringify(merged));
  }
  const rows = [...upload].map(([wordId, p]) => progressRow(profile, wordId, p));
  for (let i = 0; i < rows.length; i += PAGE)
    logError(await supabase.from('word_progress').upsert(rows.slice(i, i + PAGE)));
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
