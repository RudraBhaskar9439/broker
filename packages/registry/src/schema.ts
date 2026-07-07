import { z } from 'zod';

/** Store-aligned categories, plus a generic `utility` bucket. */
export const agentCategory = z.enum([
  'defi-trading',
  'data-analytics',
  'research-report',
  'dev-code',
  'automation-workflow',
  'content-creative',
  'social-community',
  'utility',
]);
export type AgentCategory = z.infer<typeof agentCategory>;

/** Whether hiring this agent spends real USDC (third-party) or recycles it
 * between wallets we control (in-house). Drives the frugal spend plan. */
export const agentSource = z.enum(['third-party', 'in-house']);
export type AgentSource = z.infer<typeof agentSource>;

/**
 * One callable agent Maestro may hire. `serviceId` is the CROO Agent Store
 * service id. Entries can be pre-registered (known agent, id not wired yet)
 * with `enabled: false`; the planner only ever considers enabled entries.
 */
export const agentEntrySchema = z
  .object({
    /** Stable internal slug used by the planner/orchestrator. */
    id: z.string().min(1),
    name: z.string().min(1),
    /** CROO Agent Store service id (empty until wired). */
    serviceId: z.string().default(''),
    category: agentCategory,
    description: z.string().min(1),
    /** Capability tags the planner matches a task against. */
    capabilities: z.array(z.string().min(1)).min(1),
    /** Human hint describing what to send as `requirements`. */
    inputHint: z.string().min(1),
    /** Approx price in USDC, used for budgeting/planning. */
    priceUsdc: z.number().nonnegative().default(0.1),
    source: agentSource.default('third-party'),
    /** Only enabled + service-wired agents are hireable. */
    enabled: z.boolean().default(false),
  })
  .refine((a) => !a.enabled || a.serviceId.length > 0, {
    message: 'enabled agents must have a non-empty serviceId',
    path: ['serviceId'],
  });

export type AgentEntry = z.infer<typeof agentEntrySchema>;

/** Raw (pre-validation) entry shape accepted by the loader. */
export type AgentEntryInput = z.input<typeof agentEntrySchema>;
