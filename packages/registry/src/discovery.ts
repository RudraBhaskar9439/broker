import { agentCategory, agentEntrySchema, type AgentEntry, type AgentCategory } from './schema';
import { defaultRoster } from './roster';
import { Registry } from './registry';

/** Default CROO store API base (public, no auth). */
export const STORE_API = 'https://api.croo.network/backend/v1';

interface StoreService {
  serviceId: string;
  name: string;
  price: string;
  description?: string;
  requirementText?: string;
  requirementSchema?: string;
}
interface StoreAgent {
  agentId: string;
  name: string;
  description?: string;
  skillTagSlugs?: string[];
  onlineStatus?: string;
  services?: StoreService[];
}

export interface DiscoveryOptions {
  /** Store API base URL. */
  baseUrl?: string;
  /** Max agents to fetch detail for (each is one request). */
  maxAgents?: number;
  /** Only include agents currently online. */
  onlineOnly?: boolean;
  /** Injected fetch (for tests). */
  fetchImpl?: typeof fetch;
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'your', 'from', 'that', 'this']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'agent'
  );
}

const CATEGORIES = agentCategory.options as readonly string[];

/** Map one store agent's services to validated registry entries. Pure — no I/O. */
export function storeAgentToEntries(agent: StoreAgent): AgentEntry[] {
  const category: AgentCategory = CATEGORIES.includes(agent.skillTagSlugs?.[0] ?? '')
    ? (agent.skillTagSlugs![0] as AgentCategory)
    : 'utility';

  return (agent.services ?? []).map((service) => {
    const caps = Array.from(
      new Set([...(agent.skillTagSlugs ?? []), ...words(service.name), ...words(agent.name)]),
    ).slice(0, 8);
    return agentEntrySchema.parse({
      id: `${slug(agent.name)}-${service.serviceId.slice(0, 6)}`,
      name: `${agent.name} · ${service.name}`,
      serviceId: service.serviceId,
      category,
      description: service.description || agent.description || service.name,
      capabilities: caps.length ? caps : ['general'],
      inputHint: service.requirementText || 'See the service requirements.',
      priceUsdc: Number(service.price) / 1e6,
      source: 'third-party',
      enabled: true,
    });
  });
}

/** Fetch hireable agents live from the CROO store's public API. */
export async function fetchStoreAgents(options: DiscoveryOptions = {}): Promise<AgentEntry[]> {
  const base = options.baseUrl ?? STORE_API;
  const max = options.maxAgents ?? 25;
  const doFetch = options.fetchImpl ?? fetch;

  const listRes = await doFetch(`${base}/public/agents?page=1&page_size=${max}`);
  if (!listRes.ok) throw new Error(`discovery list failed: HTTP ${listRes.status}`);
  const list = (await listRes.json()) as { agents?: StoreAgent[] };
  let agents = list.agents ?? [];
  if (options.onlineOnly) agents = agents.filter((a) => a.onlineStatus === 'online');

  const entries: AgentEntry[] = [];
  for (const summary of agents.slice(0, max)) {
    try {
      const res = await doFetch(`${base}/public/agents/${summary.agentId}`);
      if (!res.ok) continue;
      const detail = (await res.json()) as { agent?: StoreAgent };
      if (detail.agent) entries.push(...storeAgentToEntries(detail.agent));
    } catch {
      // skip agents that fail to load
    }
  }
  return entries;
}

/**
 * Build a Registry that merges the curated in-house roster with live agents
 * discovered from the store. In-house serviceIds win over discovered duplicates
 * (so Scout stays our reliable, controlled executor).
 */
export async function discoverRegistry(options: DiscoveryOptions = {}): Promise<Registry> {
  const discovered = await fetchStoreAgents(options);
  const staticServiceIds = new Set(
    defaultRoster.map((e) => e.serviceId).filter((id): id is string => Boolean(id)),
  );
  const merged = [
    ...defaultRoster,
    ...discovered.filter((d) => !staticServiceIds.has(d.serviceId)),
  ];
  return Registry.load(merged);
}
