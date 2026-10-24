import type { ConnectionStatus, Dataset, Lead, Prospect, Session } from './types.ts';
import { companyContext } from './company.ts';
import { readWorkspace } from './leads.ts';
const connectionStates: ConnectionStatus[] = ['not_sent', 'requested', 'connected'];
export function newSession(dataset: Dataset): Session {
  return { dataset, workspace: { claims: {}, drafts: {}, operator: '' }, prospects: {}, connections: {}, pending: '' };
}
function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false;
  const l = value as Lead;
  return ['id','source','source_url','title','quote','body_excerpt','author_handle','author_profile_url','context','reasoning','disqualified_reason','draft_reply','posted_at','fetched_at'].every(k => typeof (l as unknown as Record<string, unknown>)[k] === 'string')
    && typeof l.disqualified === 'boolean' && !!l.scores && ['intent','fit','urgency'].every(k => Number.isInteger(l.scores[k as 'intent']) && l.scores[k as 'intent'] >= 0 && l.scores[k as 'intent'] <= 10)
    && l.scores.total === l.scores.intent + l.scores.fit + l.scores.urgency;
}
export function readSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    companyContext(s.dataset);
    if (!Array.isArray(s.dataset.leads) || !s.dataset.leads.every(isLead)) return null;
    const ids = new Set(s.dataset.leads.map((l: Lead) => l.id));
    const session = newSession(s.dataset);
    session.workspace = readWorkspace(JSON.stringify(s.workspace));
    for (const [id, entry] of Object.entries(s.prospects || {})) {
      const p = entry as Prospect;
      if (ids.has(id) && p?.lead_id === id && typeof p.added_at === 'string' && connectionStates.includes(p.connection_status)) session.prospects[id] = p;
    }
    for (const [id, state] of Object.entries(s.connections || {})) if (ids.has(id) && connectionStates.includes(state as ConnectionStatus)) session.connections[id] = state as ConnectionStatus;
    session.pending = typeof s.pending === 'string' && ids.has(s.pending) ? s.pending : '';
    return session;
  } catch { return null; }
}
export function saveProspect(session: Session, id: string): Session {
  const lead = session.dataset.leads.find(l => l.id === id);
  if (!lead || lead.disqualified) return session;
  return { ...session, pending: session.pending === id ? '' : session.pending,
    prospects: { ...session.prospects, [id]: { lead_id: id, added_at: session.prospects[id]?.added_at || new Date().toISOString(), connection_status: session.connections[id] || 'not_sent' } } };
}
export function confirmConnection(session: Session, id: string, status: ConnectionStatus): Session {
  if (!session.dataset.leads.some(l => l.id === id)) return session;
  return { ...session, connections: { ...session.connections, [id]: status },
    prospects: session.prospects[id] ? { ...session.prospects, [id]: { ...session.prospects[id], connection_status: status } } : session.prospects };
}
