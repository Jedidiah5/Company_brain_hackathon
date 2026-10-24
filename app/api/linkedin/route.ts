import { loadDataset, scoreLinkedIn, searchLinkedIn } from '@/lib/linkedin-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
let busy = false;
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || '');
    sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === request.headers.get('host');
  } catch { /* Invalid or missing origin. */ }
  if (!sameOrigin) return Response.json({ error: 'Open LinkedIn search from this app.' }, { status: 403 });
  if (busy) return Response.json({ error: 'A search is already running. Wait for it to finish.' }, { status: 429 });
  let query: string;
  try {
    const input = await request.json();
    if (typeof input.query !== 'string' || input.query.trim().length < 3 || input.query.length > 240) throw new Error();
    query = input.query.trim();
  } catch { return Response.json({ error: 'Enter a LinkedIn search of 3–240 characters.' }, { status: 400 }); }
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Add OPENAI_API_KEY to the server environment before searching.' }, { status: 503 });
  busy = true;
  let searchCostUsd: number | null = null;
  try {
    const dataset = await loadDataset();
    const result = await searchLinkedIn(query);
    searchCostUsd = result.costUsd;
    const leads = await scoreLinkedIn(result.posts, dataset);
    return Response.json({ leads, query, searchCostUsd, scored: leads.length, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LinkedIn search failed.';
    return Response.json({ error: message, searchCostUsd }, { status: 502 });
  } finally { busy = false; }
}
