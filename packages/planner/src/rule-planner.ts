import type { AgentEntry, Registry } from '@maestro/registry';
import type { Plan, PlanStep, Planner } from './types';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'for',
  'in',
  'on',
  'is',
  'are',
  'me',
  'my',
  'i',
  'should',
  'do',
  'this',
  'that',
  'with',
  'about',
  'please',
  'can',
  'you',
  'get',
  'give',
  'find',
  'tell',
  'what',
  'how',
  'analyse',
  'analyze',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Split a capability tag like `wallet-analysis` into its words. */
function tagWords(tag: string): string[] {
  return tag
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreAgent(agent: AgentEntry, tokens: Set<string>): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;
  for (const cap of agent.capabilities) {
    if (tagWords(cap).some((w) => tokens.has(w))) {
      score += 2;
      matched.push(cap);
    }
  }
  for (const word of tagWords(`${agent.name} ${agent.description}`)) {
    if (tokens.has(word)) score += 1;
  }
  return { score, matched };
}

/**
 * Deterministic, zero-cost planner: scores each hireable agent by capability
 * and keyword overlap with the goal, then emits one independent hire step per
 * top-scoring agent. No LLM, fully reproducible — the safe default.
 */
export class RulePlanner implements Planner {
  readonly name = 'rule' as const;

  constructor(private readonly options: { maxAgents?: number } = {}) {}

  async plan(goal: string, registry: Registry): Promise<Plan> {
    const tokens = tokenize(goal);
    const ranked = registry
      .hireable()
      .map((agent) => ({ agent, ...scoreAgent(agent, tokens) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxAgents ?? 4);

    const steps: PlanStep[] = ranked.map((r, i) => ({
      id: `s${i + 1}`,
      agentId: r.agent.id,
      serviceId: r.agent.serviceId,
      requirements: goal,
      dependsOn: [],
      reason: r.matched.length ? `matched: ${r.matched.join(', ')}` : 'keyword match',
    }));

    const estCostUsdc = ranked.reduce((sum, r) => sum + r.agent.priceUsdc, 0);
    return { goal, strategy: 'rule', steps, estCostUsdc };
  }
}
