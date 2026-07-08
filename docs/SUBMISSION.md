# Broker - Submission Runbook

Everything needed to submit to the CROO Agent Hackathon.

## Requirements checklist

| #   | Requirement                                          | Status                                                                                 |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Listed on CROO Agent Store (discoverable & callable) | ✅ Broker online with `orchestrate` service (3 orders, 100%); Scout online (22 orders) |
| 2   | Integrated with CAP - callable, settles on-chain     | ✅ 27 on-chain hires; full negotiate→pay→deliver→clear                                 |
| 3   | Open source, permissive license                      | ✅ MIT - **make the GitHub repo public before submitting**                             |
| 4   | Demo (≤5 min) + README                               | ✅ README + presentation page · demo video ⏳                                          |
| 5   | BUIDL filed on DoraHacks                             | ⏳ (writeup below)                                                                     |
| ★   | Bonus: 10+ real CAP orders                           | ✅ 27                                                                                  |

## On-chain proof (Base mainnet, 8453)

- First order: [pay](https://basescan.org/tx/0xaa254b7639c887035eea28cbb82b0fbe09488962961dc590cad3d79792b21ea9) · [deliver](https://basescan.org/tx/0x424e87e07ddebe7d321a6523fd84c72c1e66071445655487b910019609166432) · [clear](https://basescan.org/tx/0x735a1b2cc85bc795c77588b22297c9c9827860b6cfd1bf1ad4cce9683a5c6056)
- Multi-owner: [agentstools hire](https://basescan.org/tx/0x4f7a239b2746279c8982897a469fd52a5e78099a5d06677af313cff884f2ba9a) · [scout hire](https://basescan.org/tx/0xea1e667537263092e00a7d6afe4152d8bb658eaaaef1ba2770efa6514274e75b)
- Agents: Broker `0xEc51e28044EBCD2382b522147f3DC01525A5D319` · Scout `0xC23238C500FE88C5Ab34e7Cdb40D1655523246bD`

## Demo video script (~3 min)

1. **Presentation page** - value prop + settled order graph (nodes link to Basescan).
2. **Hire Broker on the CROO website** - open its `orchestrate` service, type:
   _"Analyse the on-chain code of contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 and explain it."_
3. **Show the delivered result** in My Orders - two sections: `agentstools-onchain` (another owner's agent) + `scout` (in-house). Emphasise: Broker hired and paid _someone else's_ agent on-chain.
4. **Show Basescan** for one hire tx - real USDC settlement.
5. Optional: `pnpm discover` (live roster) and a dry-run `pnpm run:goal --llm` (the DAG + graph).

## BUIDL writeup (paste into DoraHacks)

**Broker - the orchestration layer for the CROO agent economy.**

Broker takes one goal and autonomously **hires, pays, and composes multiple CROO agents - including other owners' agents** - over CAP, settling every sub-task on-chain in USDC on Base. It decomposes a goal into a dependency graph, negotiates and pays each sub-agent (formatting inputs to each agent's schema), chains outputs, and returns one composed answer with a verifiable on-chain receipt trail. Broker is both **hireable** (H2A, from the store) and a **hirer** (A2A): a full node in the agent economy.

Live-verified: 27 on-chain hires, a real multi-owner order graph (Broker hiring an independent `agentstools` agent + its own `scout`), 100% completion. Includes permissionless live discovery of the whole store via the public API. Open source (MIT), TypeScript monorepo, 44 tests, built on `@croo-network/sdk`.

## Final user steps

1. `gh repo edit --visibility public` (or GitHub settings) - the repo must be public.
2. Record the demo video per the script above.
3. File the BUIDL on DoraHacks with the writeup + repo link + the presentation page.
4. Keep `pnpm broker` + `pnpm worker` running during judging (or note it's run on-demand; on-chain orders are permanent proof either way).
5. Rotate the SDK/LLM keys (they passed through development).
