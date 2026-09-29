# Unit 4 · Browser-local RAG

This branch derives from `ai-devcraft/03-agentic-ui`. Unit 4 adds an independent Angular app in `apps/browser-rag`. The existing incident-management demo stays available for Units 2 and 3.

## Run the presentation demo

Use Node.js 24.15 or newer and pnpm. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:rag
pnpm preview:rag
```

Open [localhost:4400](http://localhost:4400). Click **Prepare local models** while online. E5 and Gemma download into this browser profile’s cache; the initial download is several GB and can take many minutes. Wait for both model indicators to be ready, then rehearse a full question. Use a recent desktop Chromium browser with WebGPU and sufficient memory/storage. The generation worker can fall back to local WASM; this may be too slow for the talk.

No API key, Mastra service, facility service or cloud inference is needed for this app. Model downloads come from Hugging Face. The weights are not committed to Git.

The production build includes the offline app shell and local runtime binaries. Keep the same browser profile and `http://localhost:4400` origin. Models cached at a different origin/profile do not prepare this one. For editing, use `pnpm dev:rag`; rehearse offline behavior using the production preview above.

## Demo sequence · 15 minutes

1. **Find the passage (4 min).** Enter the first prompt and click **Find passages**. Show the three retrieved entries. Ask a paraphrase and show that meaning, not exact wording, drives retrieval. Walk through `manual-store.ts` → `retrieve`, the E5 worker and the parameterized vector search in `db.worker.ts`.
2. **Let Gemma explain (6 min).** Click **Ask locally**. Show the streaming explanation and its page/entry reference beside the evidence. Expand **Context sent to Gemma**, then show `context.ts` and `llm.worker.ts`. Turn off **Use manual context** for a fresh comparison and run the same question. The model may know a general answer; the distinction is supplied manual evidence, not guaranteed failure.
3. **Run a fresh question offline (5 min).** With both models prepared and a rehearsed run complete, switch the browser’s Network panel to Offline. Ask the third prompt and show newly retrieved passages and newly generated text. An offline reload is a separate rehearsal check: reload, prepare from cache and ask again. If that has not passed on the presentation machine, claim only operation in an already-loaded tab. Restore networking after the demonstration.

Each question starts with no conversation history. Toggling RAG therefore does not leak an earlier manual answer into the comparison.

### Copyable prompts

**First retrieval:**

> The cold room warms up when staff keep walking in and out. What does the manual suggest?

**Paraphrase:**

> Warm air keeps getting into the refrigerated room during deliveries. What should we check?

**Fresh offline question:**

> What should we check around the doorway when the cold room stays too warm?

Expected evidence: Optyma Cooler, p. 6, §13, entry 2.6 — air entering through open doors; inspect seals and keep doors closed. Other plausible causes also appear. Explain these as possible causes, not a diagnosis.

## Code walkthrough

All application paths below are relative to `apps/browser-rag/`.

| Show                                                           | File                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Composition: prepare → retrieve → build context → generate     | `src/app/domains/manual/data/manual-store.ts`              |
| Same embedding model and `passage:` prefix at preparation time | `pipeline/embedding.ts` and `pipeline/build-index.ts`      |
| Local question embedding with the `query:` prefix              | `src/app/domains/manual/data/workers/embeddings.worker.ts` |
| Local PGlite/pgvector search                                   | `src/app/domains/manual/data/workers/db.worker.ts`         |
| Short grounding prompt with source labels                      | `src/app/domains/manual/data/context.ts`                   |
| Gemma 4 via Transformers.js, WebGPU and streaming              | `src/app/domains/manual/data/workers/llm.worker.ts`        |
| Single-file Angular view and signals                           | `src/app/domains/manual/feat-manual/manual-assistant.ts`   |
| Offline shell and bundled runtime preparation                  | `scripts/prepare-offline.mjs`                              |

## Corpus and verification

The shipped index contains 13 short teaching paraphrases of selected entries from the Danfoss manual. It is not the whole manual. See [attribution](ATTRIBUTION.md). Source links open the original online PDF; the retrieved passage text remains available offline.

The index is already committed. Only rebuild when the corpus changes:

```sh
pnpm index:rag
pnpm verify:rag
pnpm --filter browser-rag test
pnpm --filter browser-rag typecheck:pipeline
pnpm build:rag
```

The five retrieval checks require the expected entry within the top three. The tests also check that shipped vectors match current passage text and that the RAG-off prompt contains no manual context. Record browser generation and offline rehearsal separately; these checks do not substitute for those runs.

Presenter instructions and code snapshots live only on `ai-devcraft/00-start`, under the Unit 4 menu.
