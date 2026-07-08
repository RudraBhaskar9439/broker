import type { Plan, PlanStep } from '@maestro/planner';
import { ReceiptRecorder, type Receipt } from '@maestro/receipts';
import type { OrchestrateOptions, OrchestrationResult, StepOutput } from './types';

export class OrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

/** Order steps so every step appears after its dependencies. Throws on cycles. */
function topoSort(steps: PlanStep[]): PlanStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const state = new Map<string, 'visiting' | 'done'>();
  const ordered: PlanStep[] = [];

  const visit = (step: PlanStep): void => {
    const status = state.get(step.id);
    if (status === 'done') return;
    if (status === 'visiting') throw new OrchestrationError(`Dependency cycle at step ${step.id}`);
    state.set(step.id, 'visiting');
    for (const depId of step.dependsOn) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    state.set(step.id, 'done');
    ordered.push(step);
  };

  for (const step of steps) visit(step);
  return ordered;
}

/** Append upstream outputs to a step's requirements as context. */
function buildRequirements(step: PlanStep, deps: StepOutput[]): string {
  const context = deps
    .filter((d) => d.status === 'success' && d.text.trim())
    .map((d) => `From ${d.agentId}:\n${d.text}`)
    .join('\n\n');
  return context
    ? `${step.requirements}\n\n--- Context from prior agents ---\n${context}`
    : step.requirements;
}

/**
 * Execute a plan as a DAG: independent steps run concurrently, dependent steps
 * wait for and consume their upstream outputs, and every hire is recorded in
 * the order graph. A single step's failure is captured (not thrown) so the rest
 * of the plan still completes — resilience the demo depends on.
 */
export async function orchestrate(
  plan: Plan,
  options: OrchestrateOptions,
): Promise<OrchestrationResult> {
  const recorder = new ReceiptRecorder(plan.goal);
  const outputs: Record<string, StepOutput> = {};
  const running = new Map<string, Promise<StepOutput>>();
  let spent = 0; // cumulative reserved/hired USDC, for budget capping

  const runStep = async (step: PlanStep): Promise<StepOutput> => {
    const depOutputs = await Promise.all(step.dependsOn.map((id) => running.get(id)!));
    const requirements = buildRequirements(step, depOutputs);
    const startedMs = Date.now();

    // Budget cap — reserve atomically (no await between the check and `spent +=`)
    // so concurrent steps can't collectively overspend the budget.
    if (options.budgetUsdc !== undefined) {
      const price = step.priceUsdc ?? 0;
      if (spent + price > options.budgetUsdc + 1e-9) {
        const remaining = Math.max(0, options.budgetUsdc - spent);
        const note = `skipped: needs ${price.toFixed(2)} USDC, only ${remaining.toFixed(2)} left in budget`;
        recorder.record({
          stepId: step.id,
          agentId: step.agentId,
          serviceId: step.serviceId,
          status: 'skipped',
          dependsOn: step.dependsOn,
          priceUsdc: price,
          elapsedMs: 0,
          note,
        });
        options.onEvent?.({ type: 'step:skipped', stepId: step.id, agentId: step.agentId, note });
        const output: StepOutput = {
          stepId: step.id,
          agentId: step.agentId,
          status: 'skipped',
          text: '',
        };
        outputs[step.id] = output;
        return output;
      }
      spent += price;
    }

    options.onEvent?.({ type: 'step:start', stepId: step.id, agentId: step.agentId });

    try {
      const outcome = await options.hire({
        serviceId: step.serviceId,
        requirements,
        agentId: step.agentId,
      });
      const receipt: Receipt = {
        stepId: step.id,
        agentId: step.agentId,
        serviceId: step.serviceId,
        status: 'success',
        dependsOn: step.dependsOn,
        orderId: outcome.orderId,
        payTxHash: outcome.payTxHash,
        priceUsdc: outcome.priceUsdc,
        elapsedMs: Date.now() - startedMs,
      };
      recorder.record(receipt);
      options.onEvent?.({
        type: 'step:done',
        stepId: step.id,
        agentId: step.agentId,
        payTxHash: outcome.payTxHash,
        priceUsdc: outcome.priceUsdc,
      });
      const output: StepOutput = {
        stepId: step.id,
        agentId: step.agentId,
        status: 'success',
        text: outcome.text,
        json: outcome.json,
      };
      outputs[step.id] = output;
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recorder.record({
        stepId: step.id,
        agentId: step.agentId,
        serviceId: step.serviceId,
        status: 'failed',
        dependsOn: step.dependsOn,
        elapsedMs: Date.now() - startedMs,
        error: message,
      });
      options.onEvent?.({
        type: 'step:error',
        stepId: step.id,
        agentId: step.agentId,
        error: message,
      });
      const output: StepOutput = {
        stepId: step.id,
        agentId: step.agentId,
        status: 'failed',
        text: '',
      };
      outputs[step.id] = output;
      return output;
    }
  };

  // Kick off every step in dependency order; independent steps run concurrently
  // because their promises don't await anything before hiring.
  for (const step of topoSort(plan.steps)) {
    running.set(step.id, runStep(step));
  }
  await Promise.all(running.values());

  const finalText = composeFinal(plan, outputs);
  return { goal: plan.goal, outputs, graph: recorder.build(), finalText };
}

function composeFinal(plan: Plan, outputs: Record<string, StepOutput>): string {
  const sections = plan.steps
    .map((s) => outputs[s.id])
    .filter((o): o is StepOutput => o != null && o.status === 'success' && o.text.trim().length > 0)
    .map((o) => `## ${o.agentId}\n${o.text}`);
  if (sections.length === 0) return 'No agent produced a usable result.';
  return `# Result for: ${plan.goal}\n\n${sections.join('\n\n')}`;
}
