import type { ConversationTurn, I18nParams, Retrieved } from '../types';

export type DbRequest =
  { type: 'init' } | { type: 'search'; id: number; queryVec: number[]; topK: number };

export type DbResponse =
  | { type: 'progress'; percent: number; key: string; params?: I18nParams }
  | { type: 'ready' }
  | { type: 'init-error'; error: string }
  | { type: 'search-result'; id: number; hits: Retrieved[] }
  | { type: 'search-error'; id: number; error: string };

export interface EmbeddingsRequest {
  id: number;
  text: string;
}

export type EmbeddingsResponse =
  { id: number; embedding: number[] } | { id: number; error: string };

export type LlmRequest =
  | { type: 'init' }
  | {
      type: 'generate';
      system: string;
      history: ConversationTurn[];
      prompt: string;
      maxNewTokens?: number;
    };

export type LlmResponse =
  | { type: 'status'; key: string; params?: I18nParams; progress?: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; error: string };
