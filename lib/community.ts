import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Lead } from './types.ts';

function emptyLead(partial: Omit<Lead, 'scores' | 'quote' | 'reasoning' | 'disqualified' | 'disqualified_reason' | 'draft_reply' | 'claim'>): Lead {
  return {
    ...partial,
    quote: '',
    scores: { intent: 0, fit: 0, urgency: 0, total: 0 },
    reasoning: '',
    disqualified: false,
    disqualified_reason: '',
    draft_reply: '',
    claim: { claimed_by: '', status: 'new', notes: '' },
  };
}

function blocks(raw: string): string[] {
  return raw.replace(/\r\n/g, '\n').split(/\n---\n/).map(b => b.trim()).filter(Boolean);
}

function field(block: string, key: string): string {
  const match = block.match(new RegExp(`^${key}:\\s*(.*)$`, 'im'));
  if (!match) return '';
  if (key === 'text' || key === 'title') {
    const start = block.search(new RegExp(`^${key}:\\s*`, 'im'));
    if (start < 0) return '';
    const after = block.slice(start).replace(new RegExp(`^${key}:\\s*`, 'i'), '');
    const next = after.search(/\n(?:subreddit|url|title|text|handle):/i);
    return (next < 0 ? after : after.slice(0, next)).trim();
  }
  return match[1].trim();
}

function idFor(source: string, url: string): string {
  return `${source}_` + createHash('sha1').update(url || Math.random().toString()).digest('hex').slice(0, 12);
}

export function parseRedditFixture(raw: string, fetchedAt = new Date().toISOString()): Lead[] {
  const leads: Lead[] = [];
  for (const block of blocks(raw)) {
    const url = field(block, 'url');
    const title = field(block, 'title');
    const text = field(block, 'text');
    const subreddit = field(block, 'subreddit') || 'r/unknown';
    if (!url || !text) continue;
    leads.push(emptyLead({
      id: idFor('reddit', url),
      source: 'reddit',
      source_url: url,
      fetched_at: fetchedAt,
      posted_at: '',
      author_handle: 'reddit',
      author_profile_url: '',
      context: subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`,
      title: title || text.split('\n').find(l => l.trim())?.slice(0, 160) || 'Reddit conversation',
      body_excerpt: text.slice(0, 600),
    }));
  }
  return leads;
}

export async function loadCommunityPosts(): Promise<Lead[]> {
  const redditRaw = await readFile(path.join(process.cwd(), 'data/reddit_posts.txt'), 'utf8').catch(() => '');
  return parseRedditFixture(redditRaw);
}
