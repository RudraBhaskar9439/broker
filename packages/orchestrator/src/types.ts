import type { OrderGraph } from '@broker/receipts';

/** What a hire returns to the orchestrator (a thin, testable view). */
export interface HireOutcome {
  orderId: string;
  payTxHash: string;
  priceUsdc: number;
  /** Text output used as context for dependent steps. */
  text: string;
  json?: unknown;
}

/** Injectable hire function - the real one wraps croo-client; tests pass a fake. */
export type HireFn = (req: {
  serviceId: string;
  requirements: string;
  agentId: string;
}) => Promise<HireOutcome>;

/** Lifecycle events for a live UI (Phase 7). */
export type StepEvent =
  | { type: 'step:start'; stepId: string; agentId: string }
  | { type: 'step:done'; stepId: string; agentId: string; payTxHash: string; priceUsdc: number }
  | { type: 'step:error'; stepId: string; agentId: string; error: string }
  | { type: 'step:skipped'; stepId: string; agentId: string; note: string };

export interface OrchestrateOptions {
  hire: HireFn;
  /**
   * Max total USDC Broker may spend on sub-hires. Steps that would exceed the
   * remaining budget are skipped (not hired), so Broker never spends more than
   * it was paid. Undefined = no cap.
   */
  budgetUsdc?: number;
  /** Optional progress callback for streaming UIs. */
  onEvent?: (event: StepEvent) => void;
}

export interface StepOutput {
  stepId: string;
  agentId: string;
  status: 'success' | 'failed' | 'skipped';
  text: string;
  json?: unknown;
}

export interface OrchestrationResult {
  goal: string;
  outputs: Record<string, StepOutput>;
  graph: OrderGraph;
  /** Composed final deliverable assembled from successful step outputs. */
  finalText: string;
}
