import { loadDataset, scorePosts, searchLinkedIn } from '@/lib/linkedin-server';
import { loadCommunityPosts } from '@/lib/community';
import { companyContext } from '@/lib/company';
import { validateSearchQuery } from '@/lib/search';
import { sameOrigin } from '@/lib/request';
import type { Dataset, Lead } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
let busy = false;

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
  const warnings: string[] = [];
  try {
    const dataset = context || await loadDataset();
    const found = new Map<string, Lead>();

    try {
      for (const query of queries) {
        const result = await searchLinkedIn(query);
        searchCostUsd += result.costUsd || 0;
        for (const post of result.posts) found.set(post.id, post);
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'LinkedIn search failed.');
    }

    try {
      for (const post of await loadCommunityPosts()) found.set(post.id, post);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Could not load Reddit / X fixtures.');
    }

    const posts = [...found.values()];
    if (!posts.length) {
      return Response.json({
        error: warnings[0] || 'No posts found across LinkedIn, Reddit, or X.',
        searchCostUsd,
        warnings,
      }, { status: 502 });
    }

    const leads: Lead[] = [];
    for (let i = 0; i < posts.length; i += 10) {
      leads.push(...await scorePosts(posts.slice(i, i + 10), dataset));
    }

    const bySource = {
      linkedin: leads.filter(l => l.source === 'linkedin').length,
      reddit: leads.filter(l => l.source === 'reddit').length,
      x: leads.filter(l => l.source === 'x').length,
    };

    return Response.json({
      leads,
      queries,
      searchCostUsd,
      scored: leads.length,
      bySource,
      warnings,
      fetchedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Signal search failed.',
      searchCostUsd,
      warnings,
    }, { status: 502 });
  } finally {
    busy = false;
  }
}
