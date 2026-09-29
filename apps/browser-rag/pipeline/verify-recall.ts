import { readFileSync } from 'node:fs';
import { createEmbedder } from './embedding.ts';
import type { Chunk } from './chunking.ts';
const index = JSON.parse(
  readFileSync(new URL('../public/rag-index.json', import.meta.url), 'utf8'),
) as { chunks: (Chunk & { embedding: number[] })[] };
const queries = JSON.parse(
  readFileSync(new URL('./eval-queries.json', import.meta.url), 'utf8'),
) as { query: string; entry: string }[];
const embed = await createEmbedder();
const vectors = await embed(
  queries.map((q) => q.query),
  'query: ',
);
let failed = false;
queries.forEach((query, i) => {
  const ranked = index.chunks
    .map((chunk) => ({
      chunk,
      score: chunk.embedding.reduce((sum, value, j) => sum + value * vectors[i][j], 0),
    }))
    .sort((a, b) => b.score - a.score);
  const rank = ranked.findIndex((hit) => hit.chunk.documentId === query.entry) + 1;
  console.log(`Expected ${query.entry}, rank ${rank}: ${query.query}`);
  console.log(
    ranked
      .slice(0, 3)
      .map((hit) => `${hit.chunk.documentId} (${hit.score.toFixed(3)})`)
      .join(', '),
  );
  if (rank < 1 || rank > 3) failed = true;
});
if (failed) process.exitCode = 1;
