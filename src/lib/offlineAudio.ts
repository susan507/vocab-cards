import { Directory, File, Paths } from 'expo-file-system';
import type { Book } from './types';

const CONCURRENCY = 6;
const audioDir = new Directory(Paths.document, 'audio');

// ponytail: keyed by URL basename, so two books sharing a filename would collide.
const localFile = (url: string) => new File(audioDir, url.split('/').pop() ?? url);

const bookAudio = (book: Book) =>
  book.chapters.flatMap(c => c.sections.flatMap(s => s.words.flatMap(w => w.audio ?? [])));

export function resolveAudio(url: string): string {
  const file = localFile(url);
  return file.exists ? file.uri : url;
}

export const isBookDownloaded = (book: Book) => bookAudio(book).every(u => localFile(u).exists);

export type DownloadProgress = { done: number; total: number; failed: number };

/** Skips files already on disk, so re-running retries only the failures. */
export async function downloadBookAudio(
  book: Book,
  onProgress: (p: DownloadProgress) => void,
): Promise<DownloadProgress> {
  audioDir.create({ idempotent: true, intermediates: true });
  const urls = bookAudio(book);
  const progress = { done: 0, total: urls.length, failed: 0 };
  const queue = urls.filter(u => {
    if (!localFile(u).exists) return true;
    progress.done++;
    return false;
  });
  onProgress({ ...progress });

  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const file = localFile(url);
      try {
        await File.downloadFileAsync(url, file, { idempotent: true });
        progress.done++;
      } catch {
        progress.failed++;
        if (file.exists) file.delete();
      }
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return progress;
}
