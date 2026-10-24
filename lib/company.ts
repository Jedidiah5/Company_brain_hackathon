import type { Dataset } from './types.ts';
export function companyWebsite(input: unknown): string {
  if (typeof input !== 'string' || input.length > 500) throw new Error('Enter your public company website.');
  let url: URL;
  try { url = new URL(input.includes('://') ? input.trim() : `https://${input.trim()}`); } catch { throw new Error('Enter a valid company website, such as https://jumpstart-uk.com.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(host) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) throw new Error('Use a public HTTPS company website.');
  if (host === 'jumpstart.me' || host === 'www.jumpstart.me') throw new Error('Use https://jumpstart-uk.com for Jumpstart.');
  url.hash = ''; return url.href;
}
function sentence(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error(`The company profile is missing ${key}. Try building it again.`);
  return value.trim();
}
function phrases(value: unknown, key: string, maximum = 8): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) throw new Error(`The company profile is missing ${key}. Try building it again.`);
  return value.map(v => sentence(v, key));
}
export function companyContext(value: unknown): Dataset {
  if (!value || typeof value !== 'object') throw new Error('Build your company brain before finding signals.');
  const v = value as Record<string, unknown>, p = v.profile as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object') throw new Error('Build your company brain before finding signals.');
  const website = companyWebsite(v.company_input);
  return { company_input: website, company_name: typeof v.company_name === 'string' ? v.company_name.slice(0, 100) : new URL(website).hostname,
    generated_at: typeof v.generated_at === 'string' ? v.generated_at : new Date().toISOString(),
    profile: { sells: sentence(p.sells, 'what the company sells'), icp: sentence(p.icp, 'ideal customer'), tone: sentence(p.tone, 'tone'), pains: phrases(p.pains, 'pain points'), disqualify: phrases(p.disqualify, 'disqualification rules') },
    queries: phrases(v.queries, 'search queries').map(q => q.slice(0, 240)), counts: { fetched: 0, kept: 0, dropped: 0 }, leads: [],
  };
}

export function employerPage(home: string, links: unknown): string | undefined {
  if (!Array.isArray(links)) return undefined;
  const origin = new URL(home).origin;
  for (const link of links) {
    try {
      if (typeof link !== 'string') continue;
      const url = new URL(link, home);
      if (url.origin === origin && /\/(for-(startups|employers|companies|business)|employers|hire|hiring|recruitment|business)(\/|$)/i.test(url.pathname)) return companyWebsite(url.href);
    } catch { /* Ignore malformed website links. */ }
  }
  return undefined;
}
