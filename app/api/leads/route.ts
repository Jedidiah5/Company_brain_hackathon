import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    let raw: string;
    try { raw=await readFile(path.join(process.cwd(),'leads.json'),'utf8'); }
    catch(error) {
      if ((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
      raw=await readFile(path.join(process.cwd(),'data/example-leads.json'),'utf8');
    }
    const data=JSON.parse(raw);
    if (!Array.isArray(data.leads) || !data.profile) throw new Error('Invalid dataset');
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({error:'The lead dataset could not be read. Check leads.json and refresh.'},{status:503});
  }
}
