import { buildCompany } from '@/lib/company-server';
import { companyWebsite } from '@/lib/company';
import { sameOrigin } from '@/lib/request';
export const runtime = 'nodejs';
export const maxDuration = 300;
let busy = false;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Build your company brain from this app.' }, { status: 403 });
  if (busy) return Response.json({ error: 'A company brain is already being built. Please wait.' }, { status: 429 });
  let website: string;
  try { website = companyWebsite((await request.json()).website); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Enter a valid company website.' }, { status: 400 }); }
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Connect an OpenAI API key in the server environment first.' }, { status: 503 });
  busy = true;
  try { return Response.json(await buildCompany(website), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not build the company brain.' }, { status: 502 }); }
  finally { busy = false; }
}
