import { createChat, type ChatFn, type LlmConfig } from '@broker/planner';
import type { ProviderHandler } from './types';

const DEFAULT_SYSTEM =
  'You are a specialist analysis agent hired via an autonomous agent marketplace. ' +
  'Given a task, produce a concise, well-structured, useful answer (a few short paragraphs ' +
  'or bullet points). Do not ask questions - deliver your best analysis from the input given.';

/**
 * LLM-backed handler: answers the order's requirements as free text using an
 * OpenAI-compatible model (Groq by default). This is what makes the worker a
 * genuinely useful agent rather than a stub.
 */
export function llmHandler(config: LlmConfig, systemPrompt = DEFAULT_SYSTEM): ProviderHandler {
  const chat: ChatFn = createChat(config, { json: false });
  return ({ requirements }) =>
    chat(systemPrompt, extractTask(requirements) || 'Provide a brief status report.');
}

/** Requirements arrive as JSON (CROO requires it). Pull out the human task from
 * common shapes ({"text"|"input"|"question"|"prompt": …}), else use as-is. */
export function extractTask(requirements: string): string {
  try {
    const parsed: unknown = JSON.parse(requirements);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      for (const key of ['text', 'input', 'question', 'prompt', 'task']) {
        if (typeof o[key] === 'string') return o[key] as string;
      }
      return JSON.stringify(parsed);
    }
  } catch {
    // not JSON - fall through
  }
  return requirements;
}

/** Deterministic handler for tests/offline demos - echoes the task. */
export function echoHandler(label = 'worker'): ProviderHandler {
  return async ({ requirements, serviceId }) =>
    `[${label}:${serviceId}] processed request:\n${requirements || '(no input)'}`;
}
