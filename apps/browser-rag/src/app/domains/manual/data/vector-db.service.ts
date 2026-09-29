import { Service } from '@angular/core';
import type { I18nParams, Retrieved } from './types';
import type { DbRequest, DbResponse } from './workers/protocol';

export type DbProgress = (percent: number, key: string, params?: I18nParams) => void;

@Service()
export class VectorDbService {
  private worker!: Worker;
  private nextRequestId = 0;
  private pendingSearches = new Map<
    number,
    { resolve: (hits: Retrieved[]) => void; reject: (e: Error) => void }
  >();

  init(onProgress: DbProgress): Promise<void> {
    this.worker?.terminate();
    this.worker = new Worker(new URL('./workers/db.worker', import.meta.url), { type: 'module' });

    return new Promise<void>((resolve, reject) => {
      this.worker.addEventListener('error', (event) => {
        const error = new Error(event.message || 'Local database worker stopped.');
        reject(error);
        for (const pending of this.pendingSearches.values()) pending.reject(error);
        this.pendingSearches.clear();
      });
      this.worker.addEventListener('message', (e: MessageEvent<DbResponse>) => {
        const msg = e.data;
        switch (msg.type) {
          case 'progress':
            onProgress(msg.percent, msg.key, msg.params);
            break;
          case 'ready':
            resolve();
            break;
          case 'init-error':
            reject(new Error(msg.error));
            break;
          case 'search-result': {
            const pending = this.pendingSearches.get(msg.id);
            if (pending) {
              this.pendingSearches.delete(msg.id);
              pending.resolve(msg.hits);
            }
            break;
          }
          case 'search-error': {
            const pending = this.pendingSearches.get(msg.id);
            if (pending) {
              this.pendingSearches.delete(msg.id);
              pending.reject(new Error(msg.error));
            }
            break;
          }
        }
      });

      const request: DbRequest = { type: 'init' };
      this.worker.postMessage(request);
    });
  }

  search(queryVec: number[], topK: number): Promise<Retrieved[]> {
    const id = this.nextRequestId++;
    return new Promise<Retrieved[]>((resolve, reject) => {
      this.pendingSearches.set(id, { resolve, reject });
      const request: DbRequest = { type: 'search', id, queryVec, topK };
      this.worker.postMessage(request);
    });
  }
}
