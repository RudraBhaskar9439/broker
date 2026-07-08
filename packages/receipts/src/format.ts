import type { OrderGraph } from './types';

/** Render an order graph as a human-readable receipt trail for the demo. */
export function formatOrderGraph(graph: OrderGraph): string {
  const lines: string[] = [];
  lines.push('Order graph');
  lines.push('───────────');
  for (const r of graph.receipts) {
    const mark = r.status === 'success' ? '✔' : r.status === 'skipped' ? '⊘' : '✖';
    const deps = r.dependsOn.length ? ` ← ${r.dependsOn.join(', ')}` : '';
    const price = r.priceUsdc !== undefined ? `${r.priceUsdc.toFixed(2)} USDC` : '—';
    lines.push(
      `${mark} ${r.stepId}${deps}  ${r.agentId}  ${price}  ${(r.elapsedMs / 1000).toFixed(1)}s`,
    );
    if (r.payTxHash) lines.push(`     tx: ${r.payTxHash}`);
    if (r.error) lines.push(`     error: ${r.error}`);
    if (r.note) lines.push(`     note: ${r.note}`);
  }
  lines.push('───────────');
  lines.push(
    `${graph.successfulOrders}/${graph.totalOrders} orders · ${graph.totalSpentUsdc.toFixed(
      2,
    )} USDC · ${(graph.totalElapsedMs / 1000).toFixed(1)}s`,
  );
  return lines.join('\n');
}
