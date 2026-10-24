import { loadDataset, scorePosts, searchLinkedIn } from '@/lib/linkedin-server';
import { companyContext } from '@/lib/company';
import { validateSearchQuery } from '@/lib/search';
import { sameOrigin } from '@/lib/request';
import type { Dataset, Lead } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
let busy = false;

/** Live LinkedIn search only. Reddit fixtures are seeded on the Jumpstart workspace without this call. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open signal search from this app.' }, { status: 403 });
  if (busy) return Response.json({ error: 'A search is already running. Wait for it to finish.' }, { status: 429 });
  let queries: string[], context: Dataset | undefined;
  try {
    const input = await request.json();
    if (input.company) context = companyContext(input.company);
    const requested = typeof input.query === 'string' ? [input.query] : input.queries;
    if (!Array.isArray(requested) || !requested.length || requested.length > 2 || requested.some(q => typeof q !== 'string' || q.trim().length < 3 || q.length > 240)) {
      throw new Error('Choose one or two search queries of 3–240 characters.');
    }
    queries = [...new Set(requested.map(validateSearchQuery))];
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Enter a valid search.' }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Connect an OpenAI API key before searching.' }, { status: 503 });
  }
  busy = true;
  let searchCostUsd = 0;
  try {
    const dataset = context || await loadDataset();
    const found = new Map<string, Lead>();
    for (const query of queries) {
      const result = await searchLinkedIn(query);
      searchCostUsd += result.costUsd || 0;
      for (const post of result.posts) found.set(post.id, post);
    }
    const posts = [...found.values()];
    if (!posts.length) {
      return Response.json({ error: 'No LinkedIn posts found for these queries.', searchCostUsd }, { status: 502 });
    }
    const leads: Lead[] = [];
    for (let i = 0; i < posts.length; i += 10) {
      leads.push(...await scorePosts(posts.slice(i, i + 10), dataset));
    }
    return Response.json({
      leads,
      queries,
      searchCostUsd,
      scored: leads.length,
      bySource: { linkedin: leads.length, reddit: 0 },
      fetchedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'LinkedIn search failed.',
      searchCostUsd,
    }, { status: 502 });
  } finally {
    busy = false;
  }
}
