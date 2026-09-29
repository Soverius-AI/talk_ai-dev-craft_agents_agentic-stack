/// <reference lib="webworker" />
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import type { DbRequest, DbResponse } from './protocol';
import type { IndexedChunk, RagIndex, Retrieved } from '../types';

// Bump this when the schema or bundled index changes.
const PRIMARY_IDB = 'idb://devcraft-optyma-v1';
const RECOVERY_IDB = 'idb://devcraft-optyma-v1-recovery';

interface ChunkRow {
  id: string;
  document_id: string;
  title: string;
  url: string;
  section_id: string;
  parent_section_id: string | null;
  section_path: string;
  depth: number;
  position: number;
  content: string;
  token_count: number;
  similarity: number;
}

let db: PGlite | null = null;

function post(message: DbResponse): void {
  postMessage(message);
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isFsBundleSizeError(error: unknown): boolean {
  return errorMessage(error).includes('Invalid FS bundle size');
}

async function openDatabase(): Promise<PGlite> {
  // PGlite's relative WASM URLs do not survive the Angular build, so the worker
  // loads the runtime bundles from /public explicitly.
  const root = location.origin;
  const [wasmModule, fsBundle] = await Promise.all([
    fetch(new URL('/pglite.wasm', root))
      .then((r) => r.arrayBuffer())
      .then((b) => WebAssembly.compile(b)),
    fetch(new URL('/pglite.data', root)).then((r) => r.blob()),
  ]);
  const vectorExt = {
    ...vector,
    setup: async (_pg: unknown, opts: unknown) => ({
      emscriptenOpts: opts,
      bundlePath: new URL('/vector.tar.gz', root),
    }),
  };
  const options = {
    wasmModule,
    fsBundle,
    extensions: { vector: vectorExt },
    relaxedDurability: true,
  };

  const open = async (dir?: string): Promise<PGlite> => {
    const opened = dir ? await PGlite.create(dir, options) : await PGlite.create(options);
    await opened.query('SELECT 1');
    return opened;
  };

  try {
    return await open(PRIMARY_IDB);
  } catch (e) {
    if (isFsBundleSizeError(e)) {
      try {
        const recovered = await open(RECOVERY_IDB);
        console.warn('PGlite: recovered from a corrupt cache via a fresh IndexedDB namespace.');
        return recovered;
      } catch {
        return open();
      }
    }
    return open();
  }
}

async function populate(pg: PGlite, chunks: IndexedChunk[]): Promise<void> {
  await pg.exec('TRUNCATE chunks');
  const COLS = 12;
  const BATCH = 100;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const values: string[] = [];
    const params: unknown[] = [];
    slice.forEach((c, j) => {
      const b = j * COLS;
      const ph = Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`);
      ph[COLS - 1] = `${ph[COLS - 1]}::vector`;
      values.push(`(${ph.join(', ')})`);
      params.push(
        c.id,
        c.documentId,
        c.title,
        c.url,
        c.sectionId,
        c.parentSectionId,
        c.sectionPath,
        c.depth,
        c.position,
        c.content,
        c.tokenCount,
        `[${c.embedding.join(',')}]`,
      );
    });
    await pg.query(
      `INSERT INTO chunks
         (id, document_id, title, url, section_id, parent_section_id,
          section_path, depth, position, content, token_count, embedding)
       VALUES ${values.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params,
    );
    const done = Math.min(i + BATCH, chunks.length);
    post({
      type: 'progress',
      percent: 10 + Math.round((done / chunks.length) * 80),
      key: 'db.importing',
      params: { done, total: chunks.length },
    });
  }
}

async function init(): Promise<void> {
  post({ type: 'progress', percent: 2, key: 'db.starting' });
  db = await openDatabase();

  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS chunks (
      id                TEXT PRIMARY KEY,
      document_id       TEXT NOT NULL,
      title             TEXT NOT NULL,
      url               TEXT NOT NULL,
      section_id        TEXT,
      parent_section_id TEXT,
      section_path      TEXT,
      depth             INTEGER,
      position          INTEGER,
      content           TEXT NOT NULL,
      token_count       INTEGER,
      embedding         vector(768)
    );
    -- Reconstructing a whole document means pulling all its chunks in reading
    -- order, so index the (document_id, position) lookup.
    CREATE INDEX IF NOT EXISTS chunks_doc ON chunks (document_id, position);
  `);

  post({ type: 'progress', percent: 6, key: 'db.loadingData' });
  const index: RagIndex = await fetch(new URL('/rag-index.json', location.origin), {
    cache: 'no-store',
  }).then((r) => r.json());
  await populate(db, index.chunks);

  post({ type: 'progress', percent: 92, key: 'db.buildingIndex' });
  await db.exec(
    `CREATE INDEX IF NOT EXISTS chunks_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);`,
  );
  await db.exec(`SET hnsw.ef_search = 100;`);

  post({ type: 'progress', percent: 100, key: 'db.ready' });
  post({ type: 'ready' });
}

async function search(queryVec: number[], topK: number): Promise<Retrieved[]> {
  if (!db) throw new Error('The local vector database is not loaded yet.');
  const emb = `[${queryVec.join(',')}]`;
  const { rows } = await db.query<ChunkRow>(
    `SELECT id, document_id, title, url, section_id, parent_section_id,
            section_path, depth, position, content, token_count,
            1 - (embedding <=> $1::vector) AS similarity
       FROM chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
    [emb, topK],
  );
  return rows.map((r) => ({
    chunk: {
      id: r.id,
      documentId: r.document_id,
      title: r.title,
      url: r.url,
      sectionId: r.section_id,
      parentSectionId: r.parent_section_id,
      sectionPath: r.section_path,
      depth: r.depth,
      position: r.position,
      content: r.content,
      tokenCount: r.token_count,
    },
    score: Number(r.similarity),
  }));
}

addEventListener('message', async (event: MessageEvent<DbRequest>) => {
  const msg = event.data;
  if (msg.type === 'init') {
    try {
      await init();
    } catch (e) {
      post({ type: 'init-error', error: errorMessage(e) });
    }
    return;
  }
  if (msg.type === 'search') {
    try {
      const hits = await search(msg.queryVec, msg.topK);
      post({ type: 'search-result', id: msg.id, hits });
    } catch (e) {
      post({ type: 'search-error', id: msg.id, error: errorMessage(e) });
    }
    return;
  }
});
