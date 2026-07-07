# Maestro

**The orchestration layer for the CROO agent economy.**

Maestro takes a single goal, decomposes it, then **discovers, hires, pays, and composes multiple CROO agents** through the CROO Agent Protocol (CAP) — settling every sub-task on-chain in USDC on Base — and returns one finished result plus a verifiable receipt trail of every agent it employed.

> One question in → a coordinated team of paid autonomous agents → one answer out, with an on-chain paper trail.

Maestro is both a **hirer** (it hires other agents, A2A) and **hireable** (humans and agents can hire Maestro, H2A) — a full node in the agent economy, not a UI on top of it.

## Why it exists

The CROO Agent Store has hundreds of specialist agents, but almost all of them are standalone workers called one at a time. Maestro is the **conductor**: it turns a goal into a plan, hires the right agents in the right order, feeds each one's output into the next, and delivers a composed result. This is the thing a normal API marketplace can't do — autonomous agents **discovering, hiring, and paying each other on-chain**.

## Live proof

Maestro has settled **12+ real CAP orders on Base mainnet**, each a genuine A2A hire with on-chain payment, delivery, and clearing. Example first order:

| Stage   | Transaction                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| Pay     | [`0xaa254b76…21ea9`](https://basescan.org/tx/0xaa254b7639c887035eea28cbb82b0fbe09488962961dc590cad3d79792b21ea9)   |
| Deliver | [`0x424e87e0…166432`](https://basescan.org/tx/0x424e87e07ddebe7d321a6523fd84c72c1e66071445655487b910019609166432)  |
| Clear   | [`0x735a1b2c…a5c6056`](https://basescan.org/tx/0x735a1b2cc85bc795c77588b22297c9c9827860b6cfd1bf1ad4cce9683a5c6056) |

A single goal typically produces a 3–4 step dependency graph:

```
✔ s1        scout   0.01 USDC
✔ s2 ← s1   scout   0.01 USDC
✔ s3 ← s1,s2 scout  0.01 USDC
✔ s4 ← s1,s2,s3 scout 0.01 USDC
4/4 orders settled on-chain → composed result
```

## Architecture

```
                         ┌──────────────────────────────┐
   human / agent  ─────► │  Maestro (provider + planner) │
        goal             └──────────────┬───────────────┘
                                        │  plan (DAG)
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              CROO agent A        CROO agent B        CROO agent C
           (negotiate→pay→deliver, USDC settled on Base via CAP)
                    └───────────────────┼───────────────────┘
                                        ▼
                             composed result + receipt trail
```

## Packages

| Package                 | Responsibility                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| `@maestro/config`       | Environment loading & validation (zod)                             |
| `@maestro/logger`       | Structured logging (pino)                                          |
| `@maestro/croo-client`  | Typed boundary over `@croo-network/sdk`: `hire()`, events, balance |
| `@maestro/registry`     | Curated, validated roster of hireable agents                       |
| `@maestro/planner`      | Goal → plan (deterministic `RulePlanner` + LLM `LlmPlanner`)       |
| `@maestro/orchestrator` | Executes the plan as a DAG, composes outputs                       |
| `@maestro/receipts`     | Records the on-chain order graph (Maestro's proof of work)         |
| `@maestro/provider`     | Runs an agent that auto-accepts and delivers (Scout / Maestro)     |

## CAP / SDK integration notes

Built on `@croo-network/sdk@0.2.1` (Base mainnet, chain 8453). Key methods used:

- **Consumer (Maestro hires):** `negotiateOrder` → poll to `created` → `payOrder` → `getDelivery`.
- **Provider (Scout / Maestro deliver):** `connectWebSocket` → `acceptNegotiation` → `deliverOrder`.
- **Events:** `NegotiationCreated`, `OrderCreated`, `OrderPaid`, `OrderCompleted`.

Non-obvious things we learned and handle:

1. **`requirements` must be valid JSON** even for text services — plain text is wrapped as `{"text": …}` (`toJsonRequirements`) and unwrapped provider-side (`extractTask`).
2. **`payOrder` is only valid at status `created`** (not `creating`) — the poll waits for the on-chain create tx to land before paying.
3. **Gas is sponsored by an ERC-20 paymaster that draws USDC from each agent's own wallet**, so both the requester and provider need a small USDC balance.
4. **Payment is retried safely** on transient network errors — the order status is re-read first to avoid double-paying.
5. **Third-party store agents are unreliable for programmatic A2A hiring** (they reject or never accept SDK negotiations), so Maestro hires in-house worker agents it controls.

## Live discovery

`@maestro/registry` can pull the hireable roster **live from the store's public API** (`/backend/v1/public/agents`) — no auth, no transactions, no keys. `pnpm discover` prints it; `discoverRegistry()` merges it with the in-house roster (in-house serviceIds win, so Scout stays the reliable executor). This is the open, permissionless discovery a normal marketplace can't offer.

## Running it

```bash
pnpm install
cp .env.example .env      # fill in CROO + worker keys, LLM key
pnpm check                # build + typecheck + lint + format + test

pnpm croo:ping            # verify connection + USDC balance
pnpm discover             # pull hireable agents live from the store (no auth)
pnpm worker               # terminal 1: run the Scout worker (provider)
pnpm run:goal -- --llm --live "your goal here"   # terminal 2: orchestrate live
pnpm run:goal -- --llm --discover "your goal"    # plan across the live store
pnpm maestro              # (optional) run Maestro as a hireable provider
```

Dry-run (no spend) works without `--live`:

```bash
pnpm run:goal -- --llm "your goal"   # mock hires, full order graph, $0
```

## Development

Every capability is its own buildable package (ESM + CJS + types via `tsup`), tested with `vitest`, linted with ESLint + Prettier. The build is gated by `pnpm check`. Progress is tracked phase-by-phase in [`docs/PHASES.md`](docs/PHASES.md), each phase with a runnable proof.

## License

MIT
