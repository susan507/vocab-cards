import type { Book } from './types';
import type { DownloadJob, DownloadProgress, OfflineStatus } from './offlineAudio';

export type { DownloadJob, DownloadProgress, OfflineStatus };

export const resolveAudio = (url: string) => url;

const NONE: OfflineStatus = {
  chapterCount: 0,
  downloaded: new Set(),
  chapter: () => undefined,
  downloadBook: () => {},
  downloadChapter: () => {},
};

export const useOfflineStatus = (_bookId: string) => NONE;

export const isBookDownloaded = (_book: Book) => false;

export const downloadBookAudio = async (
  _book: Book,
  _onProgress: (p: DownloadProgress) => void,
): Promise<DownloadProgress> => ({ done: 0, total: 0, failed: 0 });
