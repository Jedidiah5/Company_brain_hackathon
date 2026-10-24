export const statuses = ['new', 'claimed', 'contacted', 'replied', 'dead'] as const;
export type Status = typeof statuses[number];
export interface Claim { claimed_by: string; status: Status; notes: string }
export interface Lead {
  id: string; source: string; source_url: string; fetched_at: string; posted_at: string;
  author_handle: string; author_profile_url: string; context: string; title: string;
  quote: string; body_excerpt: string; scores: { intent: number; fit: number; urgency: number; total: number };
  reasoning: string; disqualified: boolean; disqualified_reason: string; draft_reply: string; claim: Claim;
}
export interface Dataset {
  demo?: boolean;
  company_name?: string;
  website_source?: { url: string; title: string; excerpt: string; fetched_at: string };
  generated_at: string; company_input: string;
  profile: { sells: string; icp: string; pains: string[]; tone: string; disqualify: string[] };
  queries: string[]; counts: { fetched: number; kept: number; dropped: number }; leads: Lead[];
}
export interface Workspace { claims: Record<string, Claim>; drafts: Record<string, string>; operator: string }

export type ConnectionStatus = "not_sent" | "requested" | "connected";
export interface Prospect { lead_id: string; added_at: string; connection_status: ConnectionStatus }
export interface Session { dataset: Dataset; workspace: Workspace; prospects: Record<string, Prospect>; connections: Record<string, ConnectionStatus>; pending: string }
