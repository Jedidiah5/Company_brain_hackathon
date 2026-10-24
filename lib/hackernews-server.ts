import { normalizeHackerNews } from './hackernews.ts';
import type { Lead } from './types.ts';
export const HN_ENDPOINT = 'https://hn.algolia.com/api/v1/search';
export const HN_WINDOW_DAYS = 180;
export async function searchHackerNews(query: string, limit = 4): Promise<{ posts: Lead[]; costUsd: number }> {
  const since = Math.floor(Date.now() / 1000) - HN_WINDOW_DAYS * 86400;
  const search = new URLSearchParams({ query, tags: '(story,comment)', hitsPerPage: String(Math.min(50, limit * 3)), numericFilters: `created_at_i>${since}` });
  let response: Response;
  try { response = await fetch(`${HN_ENDPOINT}?${search}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000), cache: 'no-store' }); }
  catch { throw new Error('Hacker News did not answer in time. Your saved work is unchanged.'); }
  if (!response.ok) throw new Error(`Hacker News search could not complete (HTTP ${response.status}).`);
  return { posts: normalizeHackerNews(await response.json(), limit), costUsd: 0 };
}
