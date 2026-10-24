import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { topicFromKey } from './books';

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

export function usePersisted(key: string) {
  const value = useSyncExternalStore(subscribe, () => cache.get(key));
  useEffect(() => {
    if (cache.has(key)) return;
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

export const ORDERS = { inOrder: 'In order', random: 'Random' } as const;
export type Order = keyof typeof ORDERS;

export function useDeckOrder() {
  const order: Order = usePersisted('deckOrder') === 'random' ? 'random' : 'inOrder';
  return [order, (next: Order) => save('deckOrder', next)] as const;
}

const parseKeys = (raw: string | null | undefined): string[] => {
  try {
    const keys: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

/** Topic keys in the order they were added. Keys that no longer resolve are dropped. */
function useTopicSet(storageKey: string) {
  const raw = usePersisted(storageKey);
  return useMemo(() => {
    const keys = new Set(parseKeys(raw));
    return {
      topics: [...keys].flatMap(k => topicFromKey(k) ?? []),
      has: (key: string) => keys.has(key),
      toggle: (key: string) => {
        if (!cache.has(storageKey)) return;
        const next = parseKeys(cache.get(storageKey));
        save(
          storageKey,
          JSON.stringify(next.includes(key) ? next.filter(k => k !== key) : [...next, key]),
        );
      },
    };
  }, [raw, storageKey]);
}

export const useStars = () => useTopicSet('stars');

/** Chapters marked as learned. */
export const useDone = () => useTopicSet('done');

export function useCollapsed(section: string, byDefault = false) {
  const key = `collapsed/${section}`;
  const saved = usePersisted(key);
  const collapsed = saved ? saved === '1' : byDefault;
  return [collapsed, () => save(key, collapsed ? '0' : '1')] as const;
}
