import type { AgentEntry, Registry } from '@maestro/registry';
import { llmPlanSchema, type Plan, type PlanStep, type Planner } from './types';
import { createChat, extractJson, type ChatFn, type LlmConfig } from './llm';

const SYSTEM_PROMPT = `You are Maestro's planner. You are given a user goal and a catalogue of
callable agents. Choose the minimal set of agents that together accomplish the goal, decide what
to send each as "requirements", and express ordering via "dependsOn" (list the agentIds whose
output is needed first). Only use agentIds from the catalogue. Respond with strict JSON:
{"steps":[{"agentId","requirements","dependsOn":[],"reason"}]}`;

function catalogue(agents: AgentEntry[]): string {
  return agents
    .map(
      (a) =>
        `- id: ${a.id} | ${a.name} | caps: ${a.capabilities.join(', ')} | input: ${a.inputHint} | ~$${a.priceUsdc}`,
    )
    .join('\n');
}

/**
 * LLM-backed planner (OpenAI-compatible; xAI/Grok by default). Decomposes fuzzy
 * goals into a plan, then validates it against the schema and the registry —
 * hallucinated agents are dropped and dependencies remapped to step ids.
 */
export class LlmPlanner implements Planner {
  readonly name = 'llm' as const;
  private readonly chat: ChatFn;

  constructor(config: LlmConfig, chat?: ChatFn) {
    this.chat = chat ?? createChat(config);
  }

  async plan(goal: string, registry: Registry): Promise<Plan> {
    const agents = registry.hireable();
    const user = `Goal: ${goal}\n\nAvailable agents:\n${catalogue(agents)}`;
    const raw = await this.chat(SYSTEM_PROMPT, user);
    const parsed = llmPlanSchema.parse(extractJson(raw));

    const byId = new Map(agents.map((a) => [a.id, a]));
    const valid = parsed.steps.filter((s) => byId.has(s.agentId));

    // Assign step ids and map agentId dependencies onto them.
    const stepIdByAgent = new Map<string, string>();
    valid.forEach((s, i) => stepIdByAgent.set(s.agentId, `s${i + 1}`));

    const steps: PlanStep[] = valid.map((s, i) => {
      const agent = byId.get(s.agentId)!;
      const dependsOn = s.dependsOn
        .map((dep) => stepIdByAgent.get(dep))
        .filter((id): id is string => Boolean(id));
      return {
        id: `s${i + 1}`,
        agentId: s.agentId,
        serviceId: agent.serviceId,
        requirements: s.requirements,
        dependsOn,
        reason: s.reason || 'selected by planner',
      };
    });

    const estCostUsdc = steps.reduce((sum, s) => sum + (byId.get(s.agentId)?.priceUsdc ?? 0), 0);
    return { goal, strategy: 'llm', steps, estCostUsdc };
  }
}
