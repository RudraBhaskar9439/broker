# Maestro — Phase Tracker

Each phase ends at a **proof gate**: a runnable command that demonstrates the phase works.

| #   | Phase                                              | Proof gate                                        | Status  |
| --- | -------------------------------------------------- | ------------------------------------------------- | ------- |
| 0   | Foundation (monorepo, tooling, `config`, `logger`) | `pnpm check` all green                            | ✅      |
| 1   | `croo-client` (typed SDK wrapper, WS, events)      | `pnpm croo:ping` prints wallet + USDC balance     | ✅      |
| 2   | First real A2A hire                                | `pnpm croo:hire` returns result + on-chain txHash | 🟡 code |
| 3   | `registry` (curated agent roster)                  | `pnpm registry:verify` validates roster           | ✅      |
| 4   | `planner` (Claude goal → plan)                     | `pnpm plan "<goal>"` valid plan                   | ⬜      |
| 5   | `orchestrator` + `receipts`                        | `pnpm run:goal "<goal>"` answer + receipt trail   | ⬜      |
| 6   | Maestro provider + in-house specialists            | external requester hires Maestro                  | ⬜      |
| 7   | Demo surface (CLI / dashboard)                     | recorded ≤5-min run                               | ⬜      |
| 8   | Package & submit                                   | submission checklist green                        | ⬜      |

## Proof log

### Phase 0

- Command: `pnpm check`
- Expected: build, typecheck, lint, format, and tests all pass.

### Phase 1

- Package: `@maestro/croo-client` — typed boundary over `@croo-network/sdk`.
  - `createAgentClient(config)` — single place an SDK client is constructed.
  - `probeConnection(client)` — authenticates + opens the WebSocket stream.
  - `waitForEvent(stream, type, { match })` — event→promise primitive for the
    order lifecycle (`forOrder` / `forNegotiation` predicates).
  - `getUsdcBalance(addr)` — on-chain USDC balance on Base (via ethers).
- Command: `pnpm croo:ping`
- Expected (offline): validates env and prints actionable errors if `.env` is
  missing. With a funded `.env`: authenticates the SDK key, connects the
  WebSocket, and prints the wallet's USDC balance.
- Unit tests: `waitForEvent` resolve / predicate-filter / timeout paths.

### Phase 2

- Adds `hire(client, { serviceId, requirements })` to `@maestro/croo-client`:
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

- Package: `@maestro/registry` — curated, validated roster of hireable agents.
  - `agentEntrySchema` (zod): id, serviceId, category, capabilities, price,
    `source` (third-party | in-house), `enabled`.
  - `Registry.load()` with `hireable()`, `get()`, `byCapability()`,
    `byCategory()`, `bySource()`, `capabilities()`; dup id/serviceId guards.
  - Seeded with real store agents (`enabled: false` until a serviceId is wired,
    so nothing is hireable — and thus billable — until we choose).
- Command: `pnpm registry:verify` (static, $0) · `--live` probes serviceIds via
  free negotiations.
- Unit tests: schema defaults, dup id/serviceId, enabled-without-serviceId, and
  all query helpers.
