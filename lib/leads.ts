import { statuses, type Claim, type Lead, type Workspace, type Dataset } from './types.ts';
export function actionable(lead: Lead): boolean { return !lead.disqualified && lead.scores.intent >= 6; }
export function rank(leads: Lead[]): Lead[] { return [...leads].sort((a,b) => b.scores.intent-a.scores.intent || b.scores.total-a.scores.total || a.id.localeCompare(b.id)); }
export function safeUrl(value: string): string | undefined { try { const u=new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; } }
export function readWorkspace(raw: string | null): Workspace {
  const empty: Workspace = {claims:{}, drafts:{}, operator:''};
  if (!raw) return empty;
  try {
    const value: unknown=JSON.parse(raw); if (!value || typeof value !== 'object') return empty;
    const v=value as Record<string,unknown>;
    if (typeof v.operator==='string') empty.operator=v.operator.slice(0,100);
    if (v.claims && typeof v.claims==='object') for (const [id,c] of Object.entries(v.claims)) {
      if (!c || typeof c!=='object') continue;
      const x=c as Claim;
      if (statuses.includes(x.status) && typeof x.claimed_by==='string' && typeof x.notes==='string') empty.claims[id]=x;
    }
    if (v.drafts && typeof v.drafts==='object') for (const [id,d] of Object.entries(v.drafts)) if(typeof d==='string') empty.drafts[id]=d;
    return empty;
  } catch { return empty; }
}

export function mergeLinkedIn(dataset: Dataset, incoming: Lead[], query: string): Dataset {
  const rows = new Map((dataset.demo ? [] : dataset.leads).map(lead => [lead.id, lead]));
  for (const lead of incoming) {
    const previous = rows.get(lead.id);
    rows.set(lead.id, previous ? { ...lead, claim: previous.claim } : lead);
  }
  const leads = [...rows.values()];
  const dropped = leads.filter(l => l.disqualified).length;
  return { ...dataset, demo: false, generated_at: [dataset.demo ? "" : dataset.generated_at, ...incoming.map(l => l.fetched_at)].filter(Boolean).sort().at(-1) || dataset.generated_at,
    queries: [...new Set([...dataset.queries, query])],
    counts: { fetched: leads.length, kept: leads.length - dropped, dropped }, leads };
}

/** Merge Reddit fixtures into an existing workspace without clearing other sources. */
export function mergeReddit(dataset: Dataset, incoming: Lead[]): Dataset {
  if (!incoming.length) return dataset;
  const rows = new Map(dataset.leads.map(lead => [lead.id, lead]));
  for (const lead of incoming) {
    if (rows.has(lead.id)) continue;
    rows.set(lead.id, lead);
  }
  const leads = [...rows.values()];
  const dropped = leads.filter(l => l.disqualified).length;
  return {
    ...dataset,
    counts: { fetched: leads.length, kept: leads.length - dropped, dropped },
    leads,
  };
}

export function isJumpstartCompany(dataset: Dataset | null | undefined): boolean {
  if (!dataset?.company_input) return false;
  try {
    return new URL(dataset.company_input).hostname.replace(/^www\./, '').toLowerCase() === 'jumpstart-uk.com';
  } catch {
    return false;
  }
}
