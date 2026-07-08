<div align="center">

# 🎼 Broker

### The orchestration layer for the CROO agent economy

**Give Broker a goal — it hires, pays, and composes a team of specialist agents to answer it, settling every sub-task on-chain in USDC on Base.**

`@croo-network/sdk` · Base mainnet (8453) · TypeScript · MIT

</div>

---

Almost every agent on the CROO Agent Store is a standalone worker you call one at a time. **Broker is the conductor.** It takes one goal, breaks it into a dependency graph of sub-tasks, hires the right agent for each — _including other people's agents_ — pays them over the CROO Agent Protocol (CAP), chains each result into the next, and returns one composed answer with a verifiable on-chain receipt trail.

Broker is **both hireable and a hirer** — a full node in the agent economy, not a UI on top of it:

- **Hire it (H2A):** anyone can hire Broker's `orchestrate` service from the CROO website like any other agent.
- **It hires others (A2A):** to fulfil a hire, Broker autonomously hires and pays sub-agents on-chain.

## Highlights

- 🤝 **Multi-owner orchestration** — Broker hires _independent, different-owner_ agents (verified live with `agentstools`) alongside its own, formatting each agent's input to its exact schema.
- ⛓️ **Real on-chain settlement** — full CAP lifecycle (`negotiate → pay → deliver → clear`) in USDC on Base, with safe payment retry.
- 🧠 **LLM planning** — decomposes a goal into a dependency DAG (via an OpenAI-compatible model; deterministic rule-based fallback included).
- 🔎 **Live discovery** — pulls the hireable roster straight from the store's public API, no keys or transactions.
- 💰 **Budget-aware** — Broker treats the payment it receives as a hard budget and never spends more on sub-agents than it was paid; steps that don't fit are skipped, shown in the graph.
- 🧩 **Clean monorepo** — 8 focused packages, 45 tests, every capability its own buildable module.

## See it live

Broker is **online and hireable** on the CROO store. As of writing:

| Agent                    | Role                         | Completed                         | Completion rate |
| ------------------------ | ---------------------------- | --------------------------------- | --------------- |
| **Broker** `0xEc51…D319` | orchestrator (hireable)      | 3 as provider · **27 hires made** | 100%            |
| **Scout** `0xC232…46bD`  | in-house analyst (sub-agent) | 22                                | 100%            |

**A real multi-owner order graph** — one goal, two independent agents, both settled on-chain:

```
Goal: "Analyse the on-chain code of contract 0x8335…2913 and explain it."

✔ s1        agentstools · Onchain Code   0.05 USDC   ← independent owner
✔ s2 ← s1   scout                        0.01 USDC   ← in-house
2/2 orders settled on-chain → one composed answer
```

Delivered result:

> **## agentstools-onchain** → `{"is_contract": true, "code_size": 1852, "code_hash": "0xa670…", "chain": "eip155:8453"}`
> **## scout** → _"The contract is confirmed to be a smart contract of 1852 bytes on eip155:8453; the code hash verifies integrity; next steps: retrieve the ABI, run static analysis…"_

On-chain proof (Base): [first pay tx](https://basescan.org/tx/0xaa254b7639c887035eea28cbb82b0fbe09488962961dc590cad3d79792b21ea9) ·
[agentstools hire](https://basescan.org/tx/0x4f7a239b2746279c8982897a469fd52a5e78099a5d06677af313cff884f2ba9a) ·
[scout hire](https://basescan.org/tx/0xea1e667537263092e00a7d6afe4152d8bb658eaaaef1ba2770efa6514274e75b)

## How it works

```
                          ┌───────────────────────────────┐
    human / agent  ─────► │  Broker  (provider + planner)  │
         goal             └───────────────┬─────────────────┘
                                          │  1. plan → dependency DAG
                          ┌───────────────┼───────────────────┐
                          ▼               ▼                   ▼
                   agentstools         Scout             (any agent)
                 (someone else's)   (in-house)          2. negotiate
                          │               │                   3. pay (USDC escrow, Base)
                          │               │                   4. deliver + clear
                          └───────────────┼───────────────────┘
                                          ▼
                       5. compose outputs → one answer + on-chain receipt trail
```

1. **Plan** — an LLM decomposes the goal into ordered steps with dependencies.
2. **Hire** — for each step, Broker negotiates a CAP order and locks USDC into on-chain escrow, formatting the input to that agent's schema.
3. **Chain** — each agent's output feeds the steps that depend on it.
4. **Settle** — delivery is verified and escrow clears on-chain.
5. **Compose** — successful outputs are assembled into one result with a full order graph.

## Architecture

Every capability is an independent, buildable package (ESM + CJS + types via `tsup`).

| Package                | Responsibility                                                     |
| ---------------------- | ------------------------------------------------------------------ |
| `@broker/config`       | Environment loading & validation (zod)                             |
| `@broker/logger`       | Structured logging (pino)                                          |
| `@broker/croo-client`  | Typed boundary over `@croo-network/sdk`: `hire()`, events, balance |
| `@broker/registry`     | Curated + **live-discovered** roster of hireable agents            |
| `@broker/planner`      | Goal → plan DAG (`RulePlanner` + LLM `LlmPlanner`)                 |
| `@broker/orchestrator` | Executes the plan, composes outputs, records the graph             |
| `@broker/receipts`     | The on-chain order graph — Broker's proof of work                  |
| `@broker/provider`     | Runs an agent that auto-accepts & delivers (Scout, Broker)         |

## Quickstart

Requires Node 18+ and pnpm.

```bash
pnpm install
cp .env.example .env      # add CROO + worker SDK keys and an LLM key
pnpm check                # build + typecheck + lint + format + test
pnpm croo:ping            # verify connection + on-chain USDC balance
```

## Using Broker

**From the CROO website (H2A)** — find Broker on the store, open its `orchestrate` service, type a goal, and Confirm & Pay. It delivers a composed answer to your order. (Requires `pnpm broker` + `pnpm worker` running.)

**From code (A2A / local)** — two terminals:

```bash
pnpm worker                                       # 1. run the Scout worker (provider)
pnpm broker                                      # 2. run Broker as a hireable provider
pnpm run:goal -- --llm --live "your goal here"    #    or drive an orchestration directly
```

**Other commands**

```bash
pnpm discover                                     # pull the hireable roster live from the store
pnpm run:goal -- --llm "your goal"                # dry-run: full plan + order graph, $0 (mock hires)
pnpm run:goal -- --llm --discover "your goal"     # plan across the live store
pnpm croo:hire -- --service <id> --req "<task>"   # hire any one agent directly
```

## Economics & tiers

Broker sells **value-based tiers** — you pay for the depth of the team it assembles, and both the **budget** and the **number of sub-tasks** scale with the tier:

| Tier         | Price | Team depth                                      |
| ------------ | ----- | ----------------------------------------------- |
| **Quick**    | $0.10 | 1–2 agents · a fast, focused answer             |
| **Standard** | $0.30 | 3–5 agents · researched, multi-angle            |
| **Pro**      | $1.00 | up to ~8–10 agents · deep, cross-checked report |

When hired, Broker treats `payment − reserve` as a **hard budget** and hires sub-agents only while they fit — so it **can never spend more than it was paid** (steps that don't fit are skipped and shown in the graph). The reserve is `max($0.05, 20%)`, so Broker keeps a **guaranteed margin** on every tier. One provider process serves all tiers — the price of the service hired sets the depth automatically.

## CAP / SDK integration notes

Built on `@croo-network/sdk@0.2.1`. What we learned and handle:

1. **`requirements` must be valid JSON** — plain text is wrapped as `{"text": …}`; schema agents (e.g. `{"address": …}`) get their exact shape, produced by the planner and validated before sending.
2. **`payOrder` is only valid at status `created`** (not `creating`) — the poll waits for the on-chain create tx to land.
3. **Gas is sponsored by an ERC-20 paymaster drawing USDC from each agent's own wallet** — both requester and provider need a small balance.
4. **Safe pay-retry** — transient network errors re-read the order status first, to never double-pay.
5. **Third-party reliability varies** — some agents reject or never accept SDK hires; Broker verifies acceptance, formats inputs to schema, and stays resilient (a failed step never aborts the run).

## Live discovery

`@broker/registry` pulls the hireable roster **live from the store's public API** (`/backend/v1/public/agents`) — no auth, no transactions. `pnpm discover` prints it; `discoverRegistry()` merges it with the in-house roster (in-house serviceIds win). This is the open, permissionless discovery a normal marketplace can't offer.

## Development

```bash
pnpm check          # build + typecheck + lint + format + test (the gate)
pnpm test           # 44 unit tests (vitest)
```

Strict TypeScript, ESLint flat config + Prettier, pnpm workspaces. Progress is tracked phase-by-phase in [`docs/PHASES.md`](docs/PHASES.md); submission details in [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

## License

[MIT](LICENSE)
