import { createHash } from 'node:crypto';
import { record } from './linkedin.ts';
import type { Lead } from './types.ts';
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (/^#x/i.test(code)) { const point = parseInt(code.slice(2), 16); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole; }
    if (code.startsWith('#')) { const point = Number(code.slice(1)); return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole; }
    return entities[code.toLowerCase()] ?? whole;
  });
}
export function readable(value: unknown): string {
  if (typeof value !== 'string') return '';
  return decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
// The Hacker News index takes free text, so a LinkedIn Boolean string returns nothing.
// One quoted phrase plus a single narrowing term keeps the search both relevant and answerable.
export function hnQueries(queries: string[], limit = 3): string[] {
  const noise = new Set(['a', 'an', 'the', 'and', 'or', 'not', 'for', 'to', 'in', 'of', 'we']);
  const output: string[] = [];
  for (const original of queries) {
    if (typeof original !== 'string' || !original.trim()) continue;
    const phrases = [...original.matchAll(/"([^"]+)"/g)].map(match => readable(match[1]).trim()).filter(Boolean);
    const bare = original.replace(/"[^"]*"/g, ' ').replace(/\b(?:AND|OR|NOT)\b/gi, ' ').replace(/[()]/g, ' ')
      .split(/\s+/).map(term => term.trim()).filter(term => term && !noise.has(term.toLowerCase()));
    const groups = [...original.matchAll(/\(([^()]*)\)/g)].map(match => match[1]).filter(group => !group.includes('"'));
    const narrowing = readable(groups.at(-1)?.split(/\s+OR\s+/i)[0] || bare.at(-1) || '').trim();
    const multiword = phrases.filter(phrase => phrase.includes(' '));
    const cores = (multiword.length ? multiword : phrases).slice(0, 2);
    for (const core of cores.length ? cores : [bare.slice(0, 3).join(' ')]) {
      const extra = narrowing && !core.toLowerCase().includes(narrowing.toLowerCase()) ? narrowing : '';
      const query = [core, extra].filter(Boolean).join(' ').trim().slice(0, 120);
      if (query.length >= 3 && !output.some(existing => existing.toLowerCase() === query.toLowerCase())) output.push(query);
    }
  }
  return output.slice(0, limit);
}
export function normalizeHackerNews(payload: unknown, limit = 10, fetchedAt = new Date().toISOString()): Lead[] {
  const data = record(payload);
  if (!Array.isArray(data.hits)) throw new Error('Hacker News returned an unexpected response. Your previous dataset is unchanged.');
  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const item of data.hits) {
    const hit = record(item);
    const objectId = typeof hit.objectID === 'string' ? hit.objectID : '';
    if (!/^\d+$/.test(objectId)) continue;
    const body = readable(hit.comment_text) || readable(hit.story_text);
    const ownTitle = readable(hit.title), storyTitle = readable(hit.story_title);
    if (!body && !ownTitle && !storyTitle) continue;
    const id = 'hackernews_' + createHash('sha1').update(objectId).digest('hex').slice(0, 12);
    if (seen.has(id)) continue;
    seen.add(id);
    const author = typeof hit.author === 'string' ? hit.author : '';
    const date = typeof hit.created_at === 'string' ? hit.created_at : '';
    const headline = (ownTitle || body.split(/(?<=[.!?])\s/)[0] || storyTitle || 'Hacker News comment').slice(0, 160);
    leads.push({
      id, source: 'hackernews', source_url: `https://news.ycombinator.com/item?id=${objectId}`, fetched_at: fetchedAt,
      posted_at: date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : '',
      author_handle: author, author_profile_url: author ? `https://news.ycombinator.com/user?id=${encodeURIComponent(author)}` : '',
      context: storyTitle && storyTitle !== headline ? `Hacker News · ${storyTitle.slice(0, 180)}` : 'Hacker News',
      title: headline,
      quote: '', body_excerpt: (body || ownTitle || storyTitle).slice(0, 600), scores: { intent: 0, fit: 0, urgency: 0, total: 0 },
      reasoning: '', disqualified: false, disqualified_reason: '', draft_reply: '',
      claim: { claimed_by: '', status: 'new', notes: '' },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}
