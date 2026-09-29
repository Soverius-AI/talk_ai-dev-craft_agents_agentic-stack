import { computed, inject, Service, signal } from '@angular/core';
import { buildContext } from './context';
import { EmbeddingsService } from './embeddings.service';
import { LlmService } from './llm.service';
import { VectorDbService } from './vector-db.service';
import type { Retrieved } from './types';

@Service()
export class ManualStore {
  private readonly db = inject(VectorDbService);
  private readonly embeddings = inject(EmbeddingsService);
  private readonly llm = inject(LlmService);

  readonly loading = signal(false);
  readonly searching = signal(false);
  readonly generating = signal(false);
  readonly searchReady = signal(false);
  readonly modelReady = signal(false);
  readonly device = signal('Not loaded');
  readonly status = signal('Prepare the models before going offline.');
  readonly error = signal('');
  readonly progress = signal<number | null>(null);
  readonly answer = signal('');
  readonly hits = signal<Retrieved[]>([]);
  readonly context = signal('');
  readonly useManual = signal(true);
  readonly busy = computed(() => this.loading() || this.searching() || this.generating());

  async prepare(): Promise<void> {
    if (this.busy() || this.modelReady()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      if (!this.searchReady()) await this.prepareRetrieval();
      await this.prepareModel();
      this.status.set('Both models ready · all inference stays in this browser');
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
      this.progress.set(null);
    }
  }

  async ask(question: string): Promise<void> {
    if (!question.trim() || !this.modelReady() || this.busy()) return;
    this.answer.set('');
    this.context.set('');
    this.hits.set([]);
    this.error.set('');
    this.searching.set(true);
    try {
      const hits = this.useManual() ? await this.retrieve(question) : [];
      this.hits.set(hits);
      const input = buildContext(question, hits);
      this.context.set(input.context);
      this.searching.set(false);
      this.generating.set(true);
      this.status.set(`Gemma 4 is generating locally · ${this.device()}`);
      await this.llm.generate(input.system, [], input.prompt, (token) =>
        this.answer.update((text) => text + token),
      );
      this.status.set('Finished · try another phrasing or disconnect and ask a fresh question');
    } catch (error) {
      this.fail(error);
    } finally {
      this.searching.set(false);
      this.generating.set(false);
    }
  }

  async findPassages(question: string): Promise<void> {
    if (!question.trim() || !this.searchReady() || this.busy()) return;
    this.searching.set(true);
    this.answer.set('');
    this.context.set('');
    this.hits.set([]);
    this.error.set('');
    try {
      const hits = await this.retrieve(question);
      this.hits.set(hits);
      this.context.set(buildContext(question, hits).context);
      this.status.set('Passages retrieved · no generation was needed');
    } catch (error) {
      this.fail(error);
    } finally {
      this.searching.set(false);
    }
  }

  private async prepareRetrieval(): Promise<void> {
    this.status.set('Opening the manual index in PGlite');
    await this.db.init((percent) => this.progress.set(percent));
    this.status.set('Loading E5 · local embedding model');
    this.progress.set(null);
    await this.embeddings.embed('Warm up the local embedding model');
    this.searchReady.set(true);
  }

  private async prepareModel(): Promise<void> {
    this.status.set('Loading Gemma 4 · the first download is several GB');
    const device = await this.llm.load((key, params, progress) => {
      this.progress.set(progress);
      this.status.set(
        key === 'llm.downloading'
          ? `Gemma 4 · ${params?.['file']} · ${params?.['percent']}%`
          : 'WebGPU unavailable · trying local WASM',
      );
    });
    this.device.set(device === 'webgpu' ? 'WebGPU' : 'WASM');
    this.modelReady.set(true);
  }

  private async retrieve(question: string): Promise<Retrieved[]> {
    this.status.set('Embedding the question · searching the local manual');
    const vector = await this.embeddings.embed(question);
    return this.db.search(vector, 3);
  }

  private fail(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : String(error));
    this.status.set('Stopped · no cloud fallback');
  }
}
