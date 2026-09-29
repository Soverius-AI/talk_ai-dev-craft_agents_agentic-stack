import { pipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-base';
export const EMBEDDING_DIM = 768;

export type Embedder = (texts: string[], prefix: string) => Promise<number[][]>;

export async function createEmbedder(): Promise<Embedder> {
  const extract = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' });
  return async (texts, prefix) => {
    const output = await extract(
      texts.map((t) => prefix + t),
      { pooling: 'mean', normalize: true },
    );
    return output.tolist() as number[][];
  };
}
