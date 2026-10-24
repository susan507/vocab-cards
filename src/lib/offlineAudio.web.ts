import type { Book } from './types';
import type { DownloadProgress } from './offlineAudio';

export type { DownloadProgress };

export const resolveAudio = (url: string) => url;

export const isBookDownloaded = (_book: Book) => false;

export const downloadBookAudio = async (
  _book: Book,
  _onProgress: (p: DownloadProgress) => void,
): Promise<DownloadProgress> => ({ done: 0, total: 0, failed: 0 });
