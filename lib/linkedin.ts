import { createHash } from 'node:crypto';
import type { Dataset, Lead } from './types.ts';

type RecordValue = Record<string, unknown>;
export function record(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function linkedinUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    if (url.protocol !== 'https:' || !(url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))) return '';
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return ''; }
}
export function normalizeLinkedIn(payload: unknown, limit = 10, fetchedAt = new Date().toISOString()): Lead[] {
  const data = record(payload);
  if (data.error || (typeof data.status === 'number' && data.status >= 400)) throw new Error(typeof data.error === 'string' ? `LinkedIn search could not run: ${data.error.slice(0, 240)}` : 'LinkedIn provider refused the search. Check your account and try again.');
  if (!Array.isArray(data.elements)) throw new Error('LinkedIn returned an unexpected response. Your previous dataset is unchanged.');
  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const item of data.elements) {
    const post = record(item), author = record(post.author), posted = record(post.postedAt);
    const url = linkedinUrl(post.linkedinUrl) || linkedinUrl(post.shareLinkedinUrl);
    const content = text(post.content).trim();
    if (!url || !content) continue;
    const id = 'linkedin_' + createHash('sha1').update(url).digest('hex').slice(0, 12);
    if (seen.has(id)) continue;
    seen.add(id);
    const authorUrl = linkedinUrl(author.linkedinUrl);
    const date = text(posted.date);
    const validDate = date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : '';
    const headline = text(author.info);
    leads.push({
      id, source: 'linkedin', source_url: url, fetched_at: fetchedAt, posted_at: validDate,
      author_handle: text(author.publicIdentifier) || text(author.name), author_profile_url: authorUrl,
      context: headline ? `LinkedIn · ${headline.slice(0, 180)}` : 'LinkedIn',
      title: content.split('\n').find(line => line.trim())?.slice(0, 160) || 'LinkedIn conversation',
      quote: '', body_excerpt: content.slice(0, 600), scores: { intent: 0, fit: 0, urgency: 0, total: 0 },
      reasoning: '', disqualified: false, disqualified_reason: '', draft_reply: '',
      claim: { claimed_by: '', status: 'new', notes: '' },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}
function scoreNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) throw new Error('The scorer returned an invalid score. No results were added.');
  return value;
}
export function applyScores(posts: Lead[], response: unknown): Lead[] {
  const output = record(response);
  if (!Array.isArray(output.leads)) throw new Error('The scoring response was incomplete. No results were added.');
  const byId = new Map<string, RecordValue>();
  for (const item of output.leads) {
    const row = record(item), id = text(row.id);
    if (!posts.some(p => p.id === id) || byId.has(id)) throw new Error('The scorer returned mismatched records. No results were added.');
    byId.set(id, row);
  }
  return posts.map(post => {
    const row = byId.get(post.id);
    if (!row) throw new Error('The scorer omitted a post. No results were added.');
    const intent = scoreNumber(row.intent), fit = scoreNumber(row.fit), urgency = scoreNumber(row.urgency);
    if (typeof row.disqualified !== 'boolean') throw new Error('The scorer returned an invalid qualification.');
    const quote = text(row.quote).trim();
    if (quote && !post.body_excerpt.includes(quote)) throw new Error('A quote could not be verified against the original post. No results were added.');
    const reasoning = text(row.reasoning).trim(), reason = text(row.disqualified_reason).trim();
    if (!reasoning || (row.disqualified && !reason)) throw new Error('The scorer returned an incomplete explanation.');
    const eligible = !row.disqualified && intent >= 6;
    const draft = eligible ? text(row.draft_reply).trim() : '';
    if (eligible && (!quote || !draft || !draft.includes(quote))) throw new Error('An actionable post is missing a verified quote or reply. No results were added.');
    return { ...post, quote, scores: { intent, fit, urgency, total: intent + fit + urgency }, reasoning,
      disqualified: row.disqualified, disqualified_reason: row.disqualified ? reason : '', draft_reply: draft };
  });
}
