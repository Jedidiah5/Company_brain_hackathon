import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Dataset, Lead } from './types.ts';

/** Pre-scored Reddit fixtures baked into the Jumpstart sample workspace. */
export async function jumpstartCommunityLeads(): Promise<Lead[]> {
  const raw = await readFile(path.join(process.cwd(), 'data/example-leads.json'), 'utf8');
  const data = JSON.parse(raw) as Dataset;
  if (!Array.isArray(data.leads)) return [];
  return data.leads.filter((lead) => lead.source === 'reddit');
}

export function withCommunityLeads(dataset: Dataset, community: Lead[]): Dataset {
  if (!community.length) return dataset;
  const byId = new Map(dataset.leads.map((lead) => [lead.id, lead]));
  for (const lead of community) byId.set(lead.id, lead);
  const leads = [...byId.values()];
  const dropped = leads.filter((lead) => lead.disqualified).length;
  return {
    ...dataset,
    counts: { fetched: leads.length, kept: leads.length - dropped, dropped },
    leads,
  };
}

export function isJumpstartSite(website: string): boolean {
  try {
    const host = new URL(website).hostname.replace(/^www\./, '').toLowerCase();
    return host === 'jumpstart-uk.com';
  } catch {
    return false;
  }
}
