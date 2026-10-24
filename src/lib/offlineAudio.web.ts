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
