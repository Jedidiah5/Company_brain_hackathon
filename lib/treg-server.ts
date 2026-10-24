import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { record } from './linkedin.ts';
const execute = promisify(execFile);
export async function tregCall(endpoint: string, options: { query?: Record<string, string>; body?: unknown; maxCost?: number } = {}): Promise<{ body: unknown; costUsd: number | null }> {
  const cap = String(options.maxCost ?? 0.01);
  if (process.env.TREG_TOKEN) {
    const headers: Record<string, string> = { 'X-Treg-Token': process.env.TREG_TOKEN, 'X-Treg-Route-Max-Cost': cap };
    if (process.env.TREG_ORG) headers['X-Treg-Org'] = process.env.TREG_ORG;
    if (options.body) headers['Content-Type'] = 'application/json';
    const query = new URLSearchParams(options.query);
    const response = await fetch(`https://treg.to/call/${endpoint}${query.size ? '?' + query : ''}`, {
      method: options.body ? 'POST' : 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(45000), cache: 'no-store',
    });
    if (!response.ok) throw new Error(response.status === 402 ? 'Your treg balance is too low. Top up and try again.' : [401, 403].includes(response.status) ? 'Your treg session has expired. Reconnect your account.' : `The data provider could not complete the request (HTTP ${response.status}).`);
    const cost = response.headers.get('X-Treg-Cost-Micro');
    return { body: await response.json(), costUsd: cost !== null && Number.isFinite(Number(cost)) ? Number(cost) / 1e6 : null };
  }
  if (process.env.VERCEL) throw new Error('Connect treg on this deployment by setting the server-side TREG_TOKEN.');
  const args = ['--json', 'call', endpoint, '--header', `X-Treg-Route-Max-Cost: ${cap}`];
  for (const [key, value] of Object.entries(options.query || {})) args.push('--query', `${key}=${value}`);
  if (options.body) args.push('--data', JSON.stringify(options.body));
  let stdout: string;
  try { ({ stdout } = await execute('treg', args, { timeout: 50000, maxBuffer: 4 * 1024 * 1024 })); }
  catch { throw new Error('The data request failed. Check that treg is signed in with available credit, then retry.'); }
  const wrapper = record(JSON.parse(stdout)), meta = record(wrapper._treg);
  if (typeof meta.http_status === 'number' && meta.http_status >= 400) throw new Error('treg refused the request. Check account access and available credit.');
  return { body: wrapper.result, costUsd: typeof meta.charged_micro === 'number' ? meta.charged_micro / 1e6 : null };
}
