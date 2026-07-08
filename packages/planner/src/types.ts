import { z } from 'zod';
import type { Registry } from '@maestro/registry';

/** One node in the plan: hire a single agent, possibly using upstream output. */
export interface PlanStep {
  /** Stable step id (`s1`, `s2`, …). */
  id: string;
  /** Registry agent id to hire. */
  agentId: string;
  /** Resolved CROO service id. */
  serviceId: string;
  /** Requirements string to send the agent. */
  requirements: string;
  /** Step ids whose output feeds this step (empty = independent). */
  dependsOn: string[];
  /** Why this agent was chosen. */
  reason: string;
  /** The agent's price in USDC — used for budget-aware orchestration. */
  priceUsdc: number;
}

export interface Plan {
  goal: string;
  strategy: 'rule' | 'llm';
  steps: PlanStep[];
  /** Sum of chosen agents' approximate USDC prices. */
  estCostUsdc: number;
}

export interface Planner {
  readonly name: 'rule' | 'llm';
  plan(goal: string, registry: Registry): Promise<Plan>;
}

/** Schema for the LLM's raw JSON output. Dependencies are expressed as 1-based
 * step numbers; the planner remaps them to step ids. */
export const llmPlanSchema = z.object({
  steps: z
    .array(
      z.object({
        agentId: z.string().min(1),
        // The LLM may return requirements as plain text OR a JSON object (for
        // schema agents); normalise objects to a JSON string.
        requirements: z.preprocess(
          (v) => (typeof v === 'string' ? v : JSON.stringify(v)),
          z.string().min(1),
        ),
        dependsOn: z.array(z.coerce.number().int().positive()).default([]),
        reason: z.string().default(''),
      }),
    )
    .default([]),
});
export type LlmPlan = z.infer<typeof llmPlanSchema>;
