# Broker - Phase Tracker

Each phase ends at a **proof gate**: a runnable command that demonstrates the phase works.

| #   | Phase                                              | Proof gate                                        | Status  |
| --- | -------------------------------------------------- | ------------------------------------------------- | ------- |
| 0   | Foundation (monorepo, tooling, `config`, `logger`) | `pnpm check` all green                            | ✅      |
| 1   | `croo-client` (typed SDK wrapper, WS, events)      | `pnpm croo:ping` prints wallet + USDC balance     | ✅      |
| 2   | First real A2A hire                                | `pnpm croo:hire` returns result + on-chain txHash | ✅ LIVE |
| 3   | `registry` (curated agent roster)                  | `pnpm registry:verify` validates roster           | ✅      |
| 4   | `planner` (goal → plan; rule + Grok/LLM)           | `pnpm plan "<goal>"` valid plan                   | ✅      |
| 5   | `orchestrator` + `receipts`                        | `pnpm run:goal "<goal>"` answer + receipt trail   | ✅      |
| 6   | Provider (in-house worker Broker hires)            | `pnpm worker` accepts + delivers; Broker hires it | ✅ LIVE |
| 7   | Demo surface + live discovery                      | `pnpm discover` + presentation page               | ✅      |
| 8   | Package & submit                                   | submission checklist green                        | ⬜      |

## Proof log

### Phase 0

- Command: `pnpm check`
- Expected: build, typecheck, lint, format, and tests all pass.

### Phase 1

- Package: `@broker/croo-client` - typed boundary over `@croo-network/sdk`.
  - `createAgentClient(config)` - single place an SDK client is constructed.
  - `probeConnection(client)` - authenticates + opens the WebSocket stream.
  - `waitForEvent(stream, type, { match })` - event→promise primitive for the
    order lifecycle (`forOrder` / `forNegotiation` predicates).
  - `getUsdcBalance(addr)` - on-chain USDC balance on Base (via ethers).
- Command: `pnpm croo:ping`
- Expected (offline): validates env and prints actionable errors if `.env` is
  missing. With a funded `.env`: authenticates the SDK key, connects the
  WebSocket, and prints the wallet's USDC balance.
- Unit tests: `waitForEvent` resolve / predicate-filter / timeout paths.

### Phase 2

- Adds `hire(client, { serviceId, requirements })` to `@broker/croo-client`:
  negotiate → order created → pay (USDC escrow) → delivery, returning
  `{ orderId, payTxHash, price, text, json, contentHash, elapsedMs }`.
- Reliability is poll-based (REST status), so a dropped WebSocket event never
  strands a hire; terminal guards for negotiation/order rejection & expiry.
- Command: `pnpm croo:hire -- --service <serviceId> --req "<task>"`
  (service defaults to `CROO_TARGET_SERVICE_ID`).
- Unit tests: full lifecycle, multi-poll wait, rejection, timeout (fake client).
- 🟡 Code + tests green. Live proof (real on-chain tx) pending a funded wallet
  and a target `serviceId`. Wallet funded: AA wallet holds ~1.9 USDC on Base.

### Phase 3

- Package: `@broker/registry` - curated, validated roster of hireable agents.
  - `agentEntrySchema` (zod): id, serviceId, category, capabilities, price,
    `source` (third-party | in-house), `enabled`.
  - `Registry.load()` with `hireable()`, `get()`, `byCapability()`,
    `byCategory()`, `bySource()`, `capabilities()`; dup id/serviceId guards.
  - Seeded with real store agents (`enabled: false` until a serviceId is wired,
    so nothing is hireable - and thus billable - until we choose).
- Command: `pnpm registry:verify` (static, $0) · `--live` probes serviceIds via
  free negotiations.
- Unit tests: schema defaults, dup id/serviceId, enabled-without-serviceId, and
  all query helpers.

### Phase 4

- Package: `@broker/planner` - pluggable goal → plan.
  - `RulePlanner` (default, $0): deterministic capability/keyword matching →
    independent hire steps. Fully reproducible.
  - `LlmPlanner`: OpenAI-compatible endpoint (xAI/Grok by default) decomposes a
    fuzzy goal; output validated vs schema + registry (hallucinated agents
    dropped, agentId deps remapped to step ids). Chat fn is injectable.
  - `Plan`/`PlanStep` DAG with `dependsOn`, `estCostUsdc`.
- config: replaced Anthropic key with generic `LLM_API_KEY` / `LLM_BASE_URL`
  (default `https://api.x.ai/v1`) / `LLM_MODEL` (default `grok-3`).
- Command: `pnpm plan "<goal>"` (rule) · `pnpm plan -- --llm "<goal>"` (Grok).
  Falls back to a demo roster while no agents are wired, so it runs with $0.
- Unit tests: rule matching/limits/empty, LLM step-building + dep remap +
  hallucination filtering (6 tests, LLM mocked).
- Live: Groq (llama-3.3-70b) produced a 2-step dependent plan.

### Phase 5

- Package: `@broker/receipts` - `ReceiptRecorder` + `OrderGraph` (per-hire
  receipt: agent, orderId, txHash, price, deps, latency) + `formatOrderGraph`.
  This graph is Broker's proof-of-work for the A2A-composability score.
- Package: `@broker/orchestrator` - executes a plan as a DAG:
  - topological order; independent steps run concurrently; dependent steps
    await upstream and receive their output as appended context.
  - a single step's failure is captured (not thrown) so the rest completes.
  - `makeCrooHire(client)` adapter wraps the real on-chain hire; core takes an
    injectable `HireFn` (tested with fakes).
  - emits `step:start|done|error` events for a live UI (Phase 7).
- Command: `pnpm run:goal "<goal>"` (dry-run, $0 mock hire) · `--llm` (Grok) ·
  `--live` (real on-chain hires).
- Unit tests: graph aggregation/format; orchestration order-graph, context
  passing, concurrency, failure resilience, events, cycle detection (8 tests).
- Live (dry-run): Grok plan → DAG orchestrated → order graph + composed result.
- ✅ **LIVE (real hires):** `pnpm run:goal --llm --live` - Broker decomposed one
  goal into a multi-step plan and hired Scout **4× on-chain**, chaining each
  result into the next, producing a composed Go/No-Go verdict. 5 real CAP orders
  settled on Base so far.
- Planner enhancement: LLM may hire the same agent for multiple sub-tasks;
  `dependsOn` uses 1-based step numbers (robust to dropped hallucinated steps).

### Phase 6

- **Finding:** third-party store agents are unreliable for programmatic A2A
  hiring - tested Polymarket (never accepts SDK negotiations), croocred
  (rejects: provider out of gas), skeptis (rejects). So Broker hires **our own
  worker agents** instead: reliable, recycles USDC, still proves A2A on-chain.
- Also learned: the store has a **public API** (`/backend/v1/public/agents/{id}`)
  exposing serviceIds - enables real discovery (no login needed).
- Package: `@broker/provider` - `runProvider()` auto-accepts negotiations and,
  on payment, delivers a result via a `ProviderHandler`. `llmHandler` (Groq)
  makes the worker genuinely useful; `echoHandler` for offline/tests.
- config: `WORKER_SDK_KEY`. Command: `pnpm worker` runs the worker agent.
- Unit tests: auto-accept + deliver-on-payment (fake client/stream).
- ✅ **LIVE:** Broker hired Scout (in-house worker) end-to-end on Base:
  - pay tx `0xaa254b76…21ea9` · deliver tx `0x424e87e0…166432` · clear tx
    `0x735a1b2c…a5c6056`
  - Scout delivered a real Groq-generated brief; price 0.01 + fee 0.01 USDC.
  - Requester `0xEc51…D319` (Broker agent wallet) → provider `0xC232…46bD`.
- Integration notes learned & handled:
  - `requirements` must be valid JSON → `toJsonRequirements` wraps text as
    `{"text":…}`; worker `extractTask` unwraps it.
  - `payOrder` only valid at status `created` (not `creating`) → poll waits.
  - Each agent pays gas from its **own** wallet via an ERC-20 paymaster, so both
    Broker and the worker need a small USDC balance.
  - `payWithRetry` tolerates transient network errors without double-paying.
