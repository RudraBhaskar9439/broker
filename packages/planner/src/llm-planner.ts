import type { AgentEntry, Registry } from '@broker/registry';
import { llmPlanSchema, type Plan, type PlanOptions, type PlanStep, type Planner } from './types';
import { createChat, extractJson, type ChatFn, type LlmConfig } from './llm';

const SYSTEM_PROMPT = `You are Broker's planner. You are given a user goal, a catalogue of callable
agents, and a step budget. Break the goal into focused steps, each hiring one agent for a specific
sub-task. Use MORE steps (deeper, cross-checked analysis from multiple angles) when the step budget
is larger, and fewer when it is small. You MAY hire the same agent multiple times for different
sub-tasks. Express ordering with "dependsOn": a list of step numbers (1-based, referring to EARLIER
steps in your list) whose output this step needs.

CRITICAL: set each step's "requirements" to EXACTLY the format that agent expects — shown after
"input:" in the catalogue. If the input format is a JSON object (e.g. {"address": "..."}), output
that exact JSON with the real value filled in. Otherwise use plain descriptive text.

Only use agentIds from the catalogue. Respond with strict JSON:
{"steps":[{"agentId","requirements","dependsOn":[<step numbers>],"reason"}]}`;

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

  async plan(goal: string, registry: Registry, options: PlanOptions = {}): Promise<Plan> {
    const agents = registry.hireable();
    const maxSteps = options.maxSteps ?? 4;
    const user =
      `Goal: ${goal}\n\nStep budget: aim for up to ${maxSteps} step(s) ` +
      `(fewer is fine for a simple goal).\n\nAvailable agents:\n${catalogue(agents)}`;
    const raw = await this.chat(SYSTEM_PROMPT, user);
    const parsed = llmPlanSchema.parse(extractJson(raw));

    const byId = new Map(agents.map((a) => [a.id, a]));
    // Keep hireable steps with their original index so 1-based dependsOn numbers
    // still resolve after hallucinated steps are dropped; cap at the step budget.
    const kept = parsed.steps
      .slice(0, maxSteps)
      .map((step, origIndex) => ({ step, origIndex }))
      .filter(({ step }) => byId.has(step.agentId));

    const finalIdByOrigIndex = new Map<number, string>();
    kept.forEach(({ origIndex }, i) => finalIdByOrigIndex.set(origIndex, `s${i + 1}`));

    const steps: PlanStep[] = kept.map(({ step }, i) => {
      const agent = byId.get(step.agentId)!;
      const dependsOn = step.dependsOn
        .map((n) => finalIdByOrigIndex.get(n - 1)) // 1-based → original index
        .filter((id): id is string => Boolean(id) && id !== `s${i + 1}`); // no self-deps
      return {
        id: `s${i + 1}`,
        agentId: step.agentId,
        serviceId: agent.serviceId,
        requirements: step.requirements,
        dependsOn,
        reason: step.reason || 'selected by planner',
        priceUsdc: agent.priceUsdc,
      };
    });

    const estCostUsdc = steps.reduce((sum, s) => sum + (byId.get(s.agentId)?.priceUsdc ?? 0), 0);
    return { goal, strategy: 'llm', steps, estCostUsdc };
  }
}
