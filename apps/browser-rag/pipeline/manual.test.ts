import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadChunks } from './chunking.ts';
import { buildContext } from '../src/app/domains/manual/data/context.ts';

const index = JSON.parse(
  readFileSync(new URL('../public/rag-index.json', import.meta.url), 'utf8'),
);
const chunks = loadChunks(new URL('./corpus', import.meta.url).pathname);

test('shipped vectors match the current corpus and E5 dimensions', () => {
  assert.equal(index.embeddingModel, 'Xenova/multilingual-e5-base');
  assert.equal(index.dim, 768);
  assert.equal(index.chunks.length, chunks.length);
  for (const [i, chunk] of chunks.entries()) {
    assert.equal(index.chunks[i].content, chunk.content);
    assert.equal(index.chunks[i].sectionPath, chunk.sectionPath);
    const vector: number[] = index.chunks[i].embedding;
    assert.equal(vector.length, 768);
    assert.ok(vector.every(Number.isFinite));
    assert.ok(Math.abs(vector.reduce((sum, value) => sum + value * value, 0) - 1) < 0.001);
  }
});

test('retrieved evidence carries its page and entry into the generation prompt', () => {
  const chunk = chunks.find((chunk) => chunk.documentId === '2.6');
  assert.ok(chunk);
  const input = buildContext('What should I check?', [
    {
      chunk,
      embedding: index.chunks.find((item: { id: string }) => item.id === chunk.id).embedding,
      score: 0.8,
    },
  ]);
  assert.match(input.prompt, /p\. 6 · entry 2\.6/);
  assert.match(input.prompt, /door seals/);
  assert.match(input.system, /not a diagnosis/);
});

test('RAG-off comparison never carries previous manual evidence', () => {
  const input = buildContext('What should I check?', []);
  assert.equal(input.context, '');
  assert.equal(input.prompt, 'What should I check?');
  assert.match(input.system, /No manual context/);
});
