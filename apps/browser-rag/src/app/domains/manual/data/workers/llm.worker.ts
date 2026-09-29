import { env } from '@huggingface/transformers';
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = '/onnx/';
/// <reference lib="webworker" />
import {
  AutoTokenizer,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  type Message,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type ProgressInfo,
} from '@huggingface/transformers';
import type { LlmRequest, LlmResponse } from './protocol';

const MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX';

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;
let device: 'webgpu' | 'wasm' = 'webgpu';

function post(message: LlmResponse): void {
  postMessage(message);
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function load(): Promise<void> {
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

  const progress = (info: ProgressInfo): void => {
    if (info.status === 'progress') {
      post({
        type: 'status',
        key: 'llm.downloading',
        params: { file: info.file, percent: info.progress.toFixed(0) },
        progress: info.progress,
      });
    }
  };

  try {
    model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: progress,
    });
    device = 'webgpu';
  } catch (e) {
    post({ type: 'status', key: 'llm.webgpuFallback', params: { error: errorMessage(e) } });
    model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
      dtype: 'q4',
      device: 'wasm',
      progress_callback: progress,
    });
    device = 'wasm';
  }
}

addEventListener('message', async (event: MessageEvent<LlmRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      if (!model) await load();
      post({ type: 'ready', device });
      return;
    }

    if (msg.type === 'generate') {
      if (!model || !tokenizer) throw new Error('Gemma 4 is not loaded yet.');

      const messages: Message[] = [
        { role: 'system', content: msg.system },
        ...msg.history,
        { role: 'user', content: msg.prompt },
      ];
      // Chat-template variable; keep separate until the library type exposes it.
      const templateVars = { enable_thinking: false };
      const inputs = tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        ...templateVars,
      });

      const streamer = new TextStreamer(tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token: string) => {
          if (token) post({ type: 'token', token });
        },
      });

      await model.generate({
        ...inputs,
        max_new_tokens: msg.maxNewTokens ?? 512,
        do_sample: false,
        streamer,
      });

      post({ type: 'done' });
      return;
    }
  } catch (error) {
    post({ type: 'error', error: errorMessage(error) });
  }
});
