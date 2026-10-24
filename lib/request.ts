export function sameOrigin(request: Request): boolean {
  try { const url = new URL(request.headers.get('origin') || ''); return ['http:', 'https:'].includes(url.protocol) && url.host === request.headers.get('host'); } catch { return false; }
}
