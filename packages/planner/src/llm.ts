export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Minimal chat function: (system, user) → raw assistant text. */
export type ChatFn = (system: string, user: string) => Promise<string>;

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * Create a chat function against any OpenAI-compatible endpoint (xAI/Grok by
 * default). Requests JSON output at temperature 0 for reproducible plans.
 */
export function createChat(config: LlmConfig): ChatFn {
  return async (system, user) => {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as ChatCompletion;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned no content');
    return content;
  };
}

/** Parse JSON from an assistant message, tolerating prose around a JSON block. */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('No JSON object found in LLM response');
  }
}
