# AI DevCraft · Unit 4: Browser-local RAG

Branch `ai-devcraft/04-browser-rag` builds on branch 03 and adds the standalone browser manual assistant. Start with the [Unit 4 instructions](apps/browser-rag/README.md).

```sh
pnpm install --frozen-lockfile
pnpm build:rag
pnpm preview:rag
```

Open [localhost:4400](http://localhost:4400), prepare both local models while online, and rehearse before disconnecting. Presenter notes are on `ai-devcraft/00-start`.

---

# AI DevCraft: incident-management demos

Current checkpoint: **chapter 3**, `ai-devcraft/03-agentic-ui`.

The starting checkpoint is `ai-devcraft/02-backend-agents` (`db7d404`).
Derived from the Packt `06-sql-tool` checkpoint (`2115c3d`). This isolated demo uses the Angular incident-management app, Mastra, and the existing reviewed SQL historian. The starting branch has no CopilotKit or A2UI integration; this chapter adds CopilotKit but keeps A2UI out of scope. The original Packt repository and its React examples are unchanged.

## Run

```sh
pnpm install
cp .env.example .env # only if .env does not already exist
# Set OPENROUTER_API_KEY in .env.
pnpm dev
```

- Application: http://localhost:4300
- Facility service: http://127.0.0.1:3101
- Mastra Studio/API: http://localhost:4211

These ports are separate from the original Packt demo. `pnpm reset:demo` resets only this checkout's demo database to the last seven days. Stop this demo before switching branches and run `pnpm install` after switching.

## Chapter 2: backend agents

Ask **“Show the highest air temperature for each shift manager.”**

The ordinary request form calls `POST /api/investigate`. The facility service starts the Mastra `historianQueryWorkflow`. A generator proposes SQL, a deterministic preflight rejects prohibited statements, Jev reviews the meaning through OpenRouter’s Decisions API, and the facility service applies its full deterministic policy before executing against the read-only historian.

The workflow is **Generate SQL → Preflight SQL → Review SQL → Validate and execute**. Preflight uses the same SQL-aware lexical scanner as the execution boundary. It rejects write/schema operations and multiple statements, while distinguishing keywords from quoted text and comments. Rejection stops the workflow before the reviewer or database is called; the form explains that review was not run. The agentic check now uses Jev (`typesafe/jev-1.13`); SQL generation still uses `OPENROUTER_MODEL`.

Preflight is an early statement-policy check, not a proof against every possible SQL injection. SQLite authorization, read-only access, result-shape checks, and execution limits remain mandatory. Readings and aggregate results appear in the existing table. Open **Query and review** to inspect the SQL and reviewer verdict.

### Jev review

Jev receives the question and SQL, with three Noul questions:

- **Safety:** Is it a single read-only query against the historian?
- **Intent:** Does it answer the human's question?
- **Columns:** Does the result contain all and only the table columns? MAX, MIN, and AVG are allowed when aliased to an existing column, such as `numeric_value`.

The generator returns all table columns automatically. Highest/lowest reading queries retain the complete stored row. Aggregate queries retain metadata with a single value per group and return NULL where no single value applies; those cells remain blank. Missing or invented output columns are rejected.

Noul returns a yes-probability from 0 to 1. All three answers must satisfy `noul > 0.5`; a tie is rejected. There are no Choice options or separate confidence checks. This threshold is a simple demo decision rule, not an accuracy guarantee. Database access and result shape are still enforced by deterministic validation.

The reviewer takes only `apiKey` and calls `typesafe/jev-1.13` through OpenRouter. Invalid responses and API errors stop execution. For the talk, open `workflow.ts`, then `agents/jev-sql-reviewer.ts` to show the three questions and decision. **Query and review** displays failed checks; the review contains only `approved` and `concerns`, with no summary.

Reference: [TypeSafe Noul](https://docs.typesafe.ai/primitives/noul).

Try **“Show critical readings in the Cooling room”** next. Try **“Show the average air temperature for each shift manager.”** The aggregate appears in the existing Value column.

The application owns data validation and execution. Mastra agents do not receive a writable database handle. On branch 02, manual alarm buttons remain ordinary application operations. Branch 03 adds the human-approved proposal flow described below.

## Chapter 3: agentic UI

Branch 03 includes branch 02 at `db7d404`, including deterministic preflight, Jev and the complete-column result contract. The same reviewed SQL workflow is now a Mastra tool behind CopilotKit/AG-UI. The chat replaces the basic form. No A2UI or generated layouts are involved.

1. Ask **“Show the highest air temperature for each shift manager.”** The workflow emits generation, deterministic check, Jev review, execution and completion/rejection updates. CopilotKit updates one activity card and a 0 → 25 → 50 → 75 → 100% progress bar as steps succeed, and results populate the existing table. The deterministic and agentic checks each include an artificial two-second presentation pause.
2. Ask **“Switch to the reading log and filter to the Cooling room.”** Bounded frontend tools discover available options, change the view, and apply filters. This is the additional feature: the assistant operates the existing application.
3. Ask **“Raise an alarm for the Packaging hall air temperature because I want the operator to investigate.”** An approval card pauses the conversation. Reject it first, then ask again and approve. Use a metric without an existing active alarm. The card identifies the room from the facility catalog. Both valid decisions appear in the audit; approving creates an alarm only after the facility service validates and records the decision. Invalid proposals can be dismissed without a mutation. Retries use the same message/tool-call decision key, including after the card is recreated.

The approval card is an explicit demo operator interaction. This local workshop has a fixed operator identity, not production authentication. Existing manual alarm controls remain available. The model has no direct alarm mutation tool.

The chapter 3 presenter walkthrough is in the separate `ai-devcraft/00-start` presenter desk. It covers the chat connection, actual progress events, frontend tools, approval/rejection and the audit.

## Switch checkpoints

Stop the running demo, then use one of:

```sh
git switch ai-devcraft/02-backend-agents
git switch ai-devcraft/03-agentic-ui
```

Run `pnpm install` and `pnpm dev` after switching. `.env` and the local demo database are ignored and remain in place. Both branches use ports 4300/3101/4211; run one at a time. Use `pnpm reset:demo` before rehearsal when you want fresh seeded data.

## Validation

`pnpm build` builds shared contracts, facility service, Mastra and Angular. `pnpm format:check` checks formatting. `node --test apps/facility-service/test/demo.test.mjs` (after building) verifies progress outcomes and approval/rejection/idempotency. The historian policy and worker deadline are retained from the original implementation.

Earlier workshop documents under `docs/` are retained as source material; this README defines the AI DevCraft demo.

## Angular structure

The shared Angular refactor originates on this backend-only branch. It uses a facility domain, Signal Store, Signal Forms, single-file components, strict checking, and Sheriff boundaries. See [Architecture](apps/angular-host/ARCHITECTURE.md). Run `pnpm --filter angular-host lint` and `pnpm --filter angular-host test`.

Branch numbers match talk chapters: 01 Agentic Coding, 02 Backend Agents, 03 Agentic UI.

Preflight regression tests: `pnpm --filter @packt-workshop/agent-service test`. Execution-boundary tests: `node --test apps/facility-service/test/historian-policy.test.mjs` after building contracts and the facility service.
