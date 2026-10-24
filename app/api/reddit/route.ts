import { jumpstartCommunityLeads } from '@/lib/jumpstart-seed';
import { sameOrigin } from '@/lib/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pre-scored Reddit fixtures for the Jumpstart demo workspace. No search required. */
export async function GET(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open Reddit fixtures from this app.' }, { status: 403 });
  try {
    const leads = await jumpstartCommunityLeads();
    return Response.json({ leads, scored: leads.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Reddit fixtures could not be read.' }, { status: 503 });
  }
}
