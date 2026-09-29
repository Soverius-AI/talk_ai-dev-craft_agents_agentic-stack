import { Service } from '@angular/core';
import type { ConversationTurn, I18nParams } from './types';
import type { LlmRequest, LlmResponse } from './workers/protocol';

export type LlmProgress = (
  key: string,
  params: I18nParams | undefined,
  percent: number | null,
) => void;

@Service()
export class LlmService {
  private readonly worker = new Worker(new URL('./workers/llm.worker', import.meta.url), {
    type: 'module',
  });

  load(onProgress: LlmProgress): Promise<'webgpu' | 'wasm'> {
    return new Promise<'webgpu' | 'wasm'>((resolve, reject) => {
      const onMessage = (e: MessageEvent<LlmResponse>) => {
        const msg = e.data;
        if (msg.type === 'status') {
          onProgress(msg.key, msg.params, msg.progress ?? null);
        } else if (msg.type === 'ready') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          resolve(msg.device);
        } else if (msg.type === 'error') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          reject(new Error(msg.error));
        }
      };
      const onError = (event: ErrorEvent) => {
        this.worker.removeEventListener('message', onMessage);
        this.worker.removeEventListener('error', onError);
        reject(new Error(event.message || 'Local model worker stopped.'));
      };
      this.worker.addEventListener('error', onError, { once: true });
      this.worker.addEventListener('message', onMessage);
      const request: LlmRequest = { type: 'init' };
      this.worker.postMessage(request);
    });
  }

  generate(
    system: string,
    history: ConversationTurn[],
    prompt: string,
    onToken: (token: string) => void,
  ): Promise<void> {
    return this.run(system, history, prompt, 384, onToken);
  }

  private run(
    system: string,
    history: ConversationTurn[],
    prompt: string,
    maxNewTokens: number,
    onToken: (token: string) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent<LlmResponse>) => {
        const msg = e.data;
        if (msg.type === 'token') onToken(msg.token);
        else if (msg.type === 'done') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          resolve();
        } else if (msg.type === 'error') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          reject(new Error(msg.error));
        }
      };
      const onError = (event: ErrorEvent) => {
        this.worker.removeEventListener('message', onMessage);
        this.worker.removeEventListener('error', onError);
        reject(new Error(event.message || 'Local model worker stopped.'));
      };
      this.worker.addEventListener('error', onError, { once: true });
      this.worker.addEventListener('message', onMessage);
      const request: LlmRequest = { type: 'generate', system, history, prompt, maxNewTokens };
      this.worker.postMessage(request);
    });
  }
}
