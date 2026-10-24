import { Directory, File, Paths } from 'expo-file-system';
import { useMemo, useSyncExternalStore } from 'react';
import { chapterAudio, getCatalogBook, loadBook } from './books';
import { loadPersisted, updatePersisted, usePersisted } from './prefs';

const CONCURRENCY = 6;
const audioDir = new Directory(Paths.document, 'audio');

// ponytail: keyed by URL basename, so two books sharing a filename would collide.
const localFile = (url: string) => new File(audioDir, url.split('/').pop() ?? url);

/** The one file check at play time: a deleted file just falls back to streaming. */
export function resolveAudio(url: string): string {
  const file = localFile(url);
  return file.exists ? file.uri : url;
}

const inflight = new Map<string, Promise<boolean>>();

/** Shared across jobs so a book and a chapter download never fetch the same file twice. */
function fetchOnce(url: string): Promise<boolean> {
  const pending = inflight.get(url);
  if (pending) return pending;
  const file = localFile(url);
  if (file.exists) return Promise.resolve(true);
  const p = File.downloadFileAsync(url, file, { idempotent: true })
    .then(
      () => true,
      () => {
        if (file.exists) file.delete();
        return false;
      },
    )
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Skips files already on disk, so re-running retries only the failures. */
async function downloadUrls(urls: string[], onDone: (url: string, ok: boolean) => void) {
  audioDir.create({ idempotent: true, intermediates: true });
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) onDone(url, await fetchOnce(url));
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

export type DownloadProgress = { done: number; total: number; failed: number };
export type DownloadJob = DownloadProgress & { running: boolean };

const jobs = new Map<string, Record<string, DownloadJob>>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function setJob(bookId: string, key: string, job: DownloadJob) {
  jobs.set(bookId, { ...jobs.get(bookId), [key]: job });
  listeners.forEach(l => l());
}

const storageKey = (bookId: string) => `offline/${bookId}`;

const parseChapters = (raw: string | null | undefined) => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(c => typeof c === 'number') : []);
  } catch {
    return new Set<number>();
  }
};

const markDownloaded = (bookId: string, chapter: number) =>
  updatePersisted(storageKey(bookId), raw =>
    JSON.stringify([...parseChapters(raw).add(chapter)].sort((a, b) => a - b)),
  );

/** A chapter is recorded as downloaded the moment its last file lands, if none of its files failed. */
async function runJob(bookId: string, key: string, chapters: number[]) {
  if (jobs.get(bookId)?.[key]?.running) return;
  const progress = { done: 0, total: 0, failed: 0 };
  setJob(bookId, key, { ...progress, running: true });
  try {
    const [book, raw] = await Promise.all([loadBook(bookId), loadPersisted(storageKey(bookId))]);
    if (!book) throw new Error(`Unknown book ${bookId}`);
    const saved = parseChapters(raw);
    const remaining = new Map<number, number>();
    const chaptersOf = new Map<string, number[]>();
    for (const c of chapters) {
      if (saved.has(c)) continue;
      const urls = chapterAudio(book, c);
      remaining.set(c, urls.length);
      if (!urls.length) markDownloaded(bookId, c);
      for (const u of urls) chaptersOf.set(u, [...(chaptersOf.get(u) ?? []), c]);
    }
    progress.total = chaptersOf.size;
    setJob(bookId, key, { ...progress, running: true });
    await downloadUrls([...chaptersOf.keys()], (url, ok) => {
      if (ok) progress.done++;
      else progress.failed++;
      for (const c of ok ? (chaptersOf.get(url) ?? []) : []) {
        const left = (remaining.get(c) ?? 0) - 1;
        remaining.set(c, left);
        if (left === 0) markDownloaded(bookId, c);
      }
      setJob(bookId, key, { ...progress, running: true });
    });
  } catch {
    progress.failed = Math.max(1, progress.total - progress.done);
  }
  setJob(bookId, key, { ...progress, running: false });
}

export type OfflineStatus = {
  chapterCount: number;
  /** Undefined until the saved state has loaded. */
  downloaded?: ReadonlySet<number>;
  book?: DownloadJob;
  chapter: (index: number) => DownloadJob | undefined;
  downloadBook: () => void;
  downloadChapter: (index: number) => void;
};

export function useOfflineStatus(bookId: string): OfflineStatus {
  const raw = usePersisted(storageKey(bookId));
  const bookJobs = useSyncExternalStore(subscribe, () => jobs.get(bookId));
  return useMemo(() => {
    const chapterCount = getCatalogBook(bookId)?.chapters.length ?? 0;
    return {
      chapterCount,
      downloaded: raw === undefined ? undefined : parseChapters(raw),
      book: bookJobs?.book,
      chapter: index => bookJobs?.[index],
      downloadBook: () =>
        runJob(
          bookId,
          'book',
          Array.from({ length: chapterCount }, (_, i) => i),
        ),
      downloadChapter: index => runJob(bookId, String(index), [index]),
    };
  }, [bookId, raw, bookJobs]);
}
