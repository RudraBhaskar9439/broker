import {
  agentEntrySchema,
  type AgentCategory,
  type AgentEntry,
  type AgentEntryInput,
} from './schema';
import { defaultRoster } from './roster';

/** Thrown when the roster is structurally invalid (dupes, bad entries). */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/** Validate raw entries and enforce cross-entry invariants. */
export function loadRegistry(entries: AgentEntryInput[] = defaultRoster): AgentEntry[] {
  const parsed = entries.map((entry, i) => {
    const result = agentEntrySchema.safeParse(entry);
    if (!result.success) {
      throw new RegistryError(`Invalid roster entry at index ${i}: ${result.error.message}`);
    }
    return result.data;
  });

  assertUniqueBy(parsed, (e) => e.id, 'id');
  // Only wired service ids must be unique (many entries share the empty string).
  const wired = parsed.filter((e) => e.serviceId.length > 0);
  assertUniqueBy(wired, (e) => e.serviceId, 'serviceId');

  return parsed;
}

function assertUniqueBy<T>(items: T[], key: (item: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) throw new RegistryError(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

/** Queryable view over the validated agent roster. */
export class Registry {
  private constructor(private readonly entries: AgentEntry[]) {}

  static load(entries?: AgentEntryInput[]): Registry {
    return new Registry(loadRegistry(entries));
  }

  /** Every entry, enabled or not. */
  all(): AgentEntry[] {
    return [...this.entries];
  }

  /** Hireable entries (enabled + service-wired). */
  hireable(): AgentEntry[] {
    return this.entries.filter((e) => e.enabled && e.serviceId.length > 0);
  }

  get(id: string): AgentEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  byCapability(tag: string): AgentEntry[] {
    return this.hireable().filter((e) => e.capabilities.includes(tag));
  }

  byCategory(category: AgentCategory): AgentEntry[] {
    return this.hireable().filter((e) => e.category === category);
  }

  bySource(source: AgentEntry['source']): AgentEntry[] {
    return this.entries.filter((e) => e.source === source);
  }

  /** Sorted union of all capability tags across hireable agents. */
  capabilities(): string[] {
    const tags = new Set<string>();
    for (const e of this.hireable()) for (const c of e.capabilities) tags.add(c);
    return [...tags].sort();
  }
}
