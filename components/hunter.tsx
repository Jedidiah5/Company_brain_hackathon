'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Radar, BrainCircuit, Settings2, Search, RefreshCw, ChevronRight, Check, Copy, ExternalLink, X, FileDown, Crosshair, CircleHelp, Globe, UserPlus, ArrowRight, Bookmark, ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { actionable, rank, safeUrl, mergeLinkedIn, mergeReddit, isJumpstartCompany } from '@/lib/leads';
import { newSession, readSession, saveProspect, confirmConnection } from '@/lib/session';
import { statuses, type Claim, type ConnectionStatus, type Dataset, type Lead, type Session, type Workspace } from '@/lib/types';
const SignalMap = dynamic(() => import('./signal-map'), { ssr: false, loading: () => <div className="map-canvas" /> });
const STORAGE = 'signal-hunter.session.v2';
const SIDEBAR_STORAGE = 'signal-hunter.sidebar.v1';
const EMPTY_WORKSPACE: Workspace = { claims: {}, drafts: {}, operator: '' };
type View = 'start' | 'queue' | 'brain' | 'prospects';
type Filter = 'all' | 'actionable' | 'claimed' | 'dropped';
const connectionLabel = (status: ConnectionStatus) => status === 'requested' ? 'Request sent' : status === 'connected' ? 'Connected' : 'Not connected yet';
const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
export default function Hunter() {
  const hydrated = useHydrated();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(false);
  const [view, setView] = useState<View>('start'), [filter, setFilter] = useState<Filter>('all');
  const [website, setWebsite] = useState('https://jumpstart-uk.com'), [busy, setBusy] = useState<'company' | 'search' | 'previous' | ''>('');
  const [error, setError] = useState(''), [resultMessage, setResultMessage] = useState('');
  const [customSearch, setCustomSearch] = useState(false), [customQuery, setCustomQuery] = useState('');
  const [source, setSource] = useState('all'), [query, setQuery] = useState(''), [sort, setSort] = useState('intent');
  const [selected, setSelected] = useState(''), [notice, setNotice] = useState(''), [settings, setSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const data = session?.dataset;
  const workspace = session?.workspace || EMPTY_WORKSPACE;
  const leads = useMemo(() => data?.leads || [], [data]);
  const companyName = data?.company_name || (data ? new URL(data.company_input).hostname.replace(/^www\./, '') : 'Your company');
  const savedCount = Object.keys(session?.prospects || {}).length;
  function setWorkspace(update: (previous: Workspace) => Workspace) { setSession(s => s ? { ...s, workspace: update(s.workspace) } : s); }
  useEffect(() => {
    if (!hydrated || ready) return;
    try {
      const saved = readSession(localStorage.getItem(STORAGE));
      if (saved) { setSession(saved); setWebsite(saved.dataset.company_input); setView('queue'); if (saved.pending) setSelected(saved.pending); }
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE) === '1');
    } catch { setStorageError(true); }
    setReady(true);
  }, [hydrated, ready]);
  useEffect(() => { if (ready && session) { try { localStorage.setItem(STORAGE, JSON.stringify(session)); } catch { setStorageError(true); } } }, [session, ready]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(SIDEBAR_STORAGE, collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed, ready]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  // Jumpstart: Reddit fixtures appear on their own — no Find buying signals / source load required.
  useEffect(() => {
    if (!ready || !session || !isJumpstartCompany(session.dataset)) return;
    if (session.dataset.leads.some(l => l.source === 'reddit')) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/reddit', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || cancelled || !Array.isArray(result.leads) || !result.leads.length) return;
        setSession(s => s && isJumpstartCompany(s.dataset) && !s.dataset.leads.some(l => l.source === 'reddit')
          ? { ...s, dataset: mergeReddit(s.dataset, result.leads) }
          : s);
        setSource('all'); setFilter('all');
      } catch { /* Reddit seed is optional for a broken fixture read. */ }
    })();
    return () => { cancelled = true; };
  }, [ready, session?.dataset.company_input, session?.dataset.leads]);
  useEffect(() => {
    const returned = () => { if (session?.pending) { setSelected(session.pending); setNotice('Back from LinkedIn? Confirm the connection status, then save your prospect.'); } };
    window.addEventListener('focus', returned); return () => window.removeEventListener('focus', returned);
  }, [session?.pending]);
  useEffect(() => {
    if (!selected && !settings) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(''); setSettings(false); }
      if (event.key === 'Tab') {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]'), dialog = dialogs[dialogs.length - 1];
        const items = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, summary') || []);
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [selected, settings]);
  const claimFor = (l: Lead): Claim => workspace.claims[l.id] || l.claim || { claimed_by: '', status: 'new', notes: '' };
  const counts = { kept: leads.filter(l => !l.disqualified).length, hot: leads.filter(actionable).length, dropped: leads.filter(l => l.disqualified).length, claimed: leads.filter(l => !l.disqualified && claimFor(l).status !== 'new').length };
  const visible = useMemo(() => {
    const rows = leads.filter(l => view === 'prospects' ? !!session?.prospects[l.id] : filter === 'dropped' ? l.disqualified : filter === 'actionable' ? actionable(l) : filter === 'claimed' ? !l.disqualified && (workspace.claims[l.id] || l.claim)?.status !== 'new' : !l.disqualified)
      .filter(l => (source === 'all' || l.source === source) && (!query || [l.title, l.quote, l.author_handle, l.context, l.reasoning].join(' ').toLowerCase().includes(query.toLowerCase())));
    return sort === 'recent' ? [...rows].sort((a, b) => (Date.parse(b.posted_at) || 0) - (Date.parse(a.posted_at) || 0)) : sort === 'fit' ? [...rows].sort((a, b) => b.scores.fit - a.scores.fit) : rank(rows);
  }, [leads, filter, source, query, sort, workspace.claims, view, session?.prospects]);
  const active = leads.find(l => l.id === selected);
  const activeConnection = session?.connections[selected] || 'not_sent';
  function updateClaim(lead: Lead, patch: Partial<Claim>) { setWorkspace(w => ({ ...w, claims: { ...w.claims, [lead.id]: { ...(w.claims[lead.id] || lead.claim || { claimed_by: '', status: 'new', notes: '' }), ...patch } } })); }
  async function buildBrain(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy('company'); setError(''); setResultMessage('');
    try {
      const response = await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website }) });
      const dataset = await response.json(); if (!response.ok) throw new Error(dataset.error || 'Could not build the company brain.');
      setSession(newSession(dataset)); setView(dataset.leads?.length ? 'queue' : 'brain'); setSelected(''); setSource('all'); setFilter('all'); setQuery(''); setCustomSearch(false); setCustomQuery(dataset.queries[0] || '');
      setNotice(dataset.leads?.length
        ? `Company brain ready with ${dataset.leads.filter((l: Lead) => l.source === 'reddit').length} Reddit signals loaded.`
        : 'Company brain ready. Review it, then find buying signals.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not build the company brain.'); }
    finally { setBusy(''); }
  }
  async function openPrevious() {
    if (busy) return; setBusy('previous'); setError('');
    try { const response = await fetch('/api/leads', { cache: 'no-store' }), dataset = await response.json(); if (!response.ok) throw new Error(dataset.error); setSession(newSession(dataset)); setView('queue'); setFilter('all'); setSource('all'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open the previous run.'); } finally { setBusy(''); }
  }
  async function findSignals() {
    if (!data || busy) return; setBusy('search'); setError(''); setResultMessage('');
    try {
      const requested = customSearch ? [customQuery.trim()] : data.queries.slice(0, 2);
      const response = await fetch('/api/signals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: data, queries: requested }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not find buying signals.');
      let merged = data;
      for (const q of result.queries) merged = mergeLinkedIn(merged, result.leads, q);
      setSession(s => s ? { ...s, dataset: merged } : s);
      const hot = result.leads.filter(actionable).length, kept = result.leads.filter((l: Lead) => !l.disqualified).length;
      setView('queue'); setSource('all'); setQuery(''); setFilter(hot ? 'actionable' : kept ? 'all' : 'dropped');
      setResultMessage(`${result.scored} LinkedIn posts reviewed · ${hot} ready for a reply · ${result.scored - kept} filtered. ${hot ? 'Open a signal to review the evidence.' : 'No strong buyer signal in this batch. Review the results or try a different query.'}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not find signals.'); } finally { setBusy(''); }
  }
  function saveLead(lead: Lead) {
    setSession(s => s ? saveProspect(s, lead.id) : s); setSelected(''); setView('prospects'); setSource('all'); setQuery(''); setNotice('Added to your prospects. Your notes and connection status are saved.');
  }
  function exportWorkspace() {
    if (!session) return;
    const output = { ...session.dataset, leads: leads.map(l => ({ ...l, claim: claimFor(l), draft_reply: workspace.drafts[l.id] ?? l.draft_reply })), prospects: Object.values(session.prospects) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = 'signal-hunter-prospects.json'; link.click(); URL.revokeObjectURL(url);
  }
  function navigate(next: View) { setView(next); setError(''); setQuery(''); setSource('all'); }
  if (!ready) return <div className="boot-screen"><Crosshair size={30} /><p>Opening your workspace…</p></div>;

  if (view === 'start' || !data) {
    return (
      <div className="onboarding-page">
        <header className="onboarding-top">
          <a className="brand" href="/" aria-label="Signal Hunter home">
            <span className="brand-mark"><Crosshair size={22} /></span>
            <span className="brand-copy">
              <span className="brand-name">SIGNAL<span className="brand-light">HUNTER</span></span>
              <small>FIND THE INTENT.</small>
            </span>
          </a>
          <span className="review-badge"><i className="dot green" />Nothing auto-sends</span>
        </header>
        <main className="onboarding-main">
          {storageError && <div className="warning">Device storage is unavailable. Export your workspace before closing this page.</div>}
          {error && <div role="alert" className="warning">{error}</div>}
          <section className="onboarding">
            <div className="eyebrow">A LITTLE CONTEXT. A MUCH BETTER CONVERSATION.</div>
            <div className="onboard-icon"><Crosshair size={36} /></div>
            <h1>Who are you finding<br />buyers for?</h1>
            <p>Give us your company website. We’ll learn what you sell,<br className="desktop-break" /> then find people describing the problem you solve.</p>
            <form onSubmit={buildBrain}>
              <label htmlFor="company-website">YOUR COMPANY WEBSITE</label>
              <div className="website-input">
                <Globe size={19} />
                <input autoFocus id="company-website" inputMode="url" autoComplete="url" required maxLength={500} value={website} onChange={e => setWebsite(e.target.value)} disabled={!!busy} placeholder="https://jumpstart-uk.com" />
              </div>
              <button className="primary-button" disabled={!!busy} type="submit">
                {busy === 'company' ? <RefreshCw className="spin" size={16} /> : <BrainCircuit size={16} />}
                {busy === 'company' ? 'Reading website & building your brain…' : 'Build my company brain'}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
            <div className="onboarding-points">
              <span><Check size={13} />Your ideal customer</span>
              <span><Check size={13} />Their buying signals</span>
              <span><Check size={13} />A reply worth sending</span>
            </div>
            <div className="onboarding-footer">
              {data ? (
                <button className="text-button" onClick={() => navigate('queue')}><ArrowLeft size={13} />Back to your workspace</button>
              ) : (
                <button className="text-button" disabled={!!busy} onClick={() => void openPrevious()}>
                  {busy === 'previous' ? 'Opening…' : 'Open the previous run instead'}
                  <ArrowUpRight size={13} />
                </button>
              )}
              <small>Nothing is posted or sent automatically.</small>
            </div>
          </section>
        </main>
        {notice && <div className="toast" role="status">{notice}</div>}
      </div>
    );
  }

  return <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
    <aside className={'sidebar' + (collapsed ? ' is-collapsed' : '')} aria-label="Workspace navigation">
      <div className="sidebar-top">
        <a className="brand" href="/" aria-label="Signal Hunter home">
          <span className="brand-mark"><Crosshair size={22} /></span>
          <span className="brand-copy">
            <span className="brand-name">SIGNAL<span className="brand-light">HUNTER</span></span>
            <small>FIND THE INTENT.</small>
          </span>
        </a>
        <button type="button" className="sidebar-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <div className="workspace-label"><span>WORKSPACE</span><span>01</span></div>
      <button className="company-switch" onClick={() => navigate('brain')} title={companyName}>
        <span className="company-avatar">{companyName.slice(0, 1).toLowerCase() + '.'}</span>
        <span className="company-copy">{companyName}<small>Company brain ready</small></span>
        <ChevronRight size={15} className="company-chevron" />
      </button>
      <div className="nav-caption">YOUR WORKFLOW</div>
      <nav>
        <button className="nav-item" onClick={() => navigate('start')} title="Company website"><Globe size={18} /><span className="nav-label">Company website</span></button>
        <button className={'nav-item ' + (view === 'brain' ? 'active' : '')} onClick={() => navigate('brain')} title="Company brain"><BrainCircuit size={18} /><span className="nav-label">Company brain</span></button>
        <button className={'nav-item ' + (view === 'queue' ? 'active' : '')} onClick={() => navigate('queue')} title="Buying signals"><Radar size={18} /><span className="nav-label">Buying signals</span><span className="nav-count">{counts.hot}</span></button>
        <button className={'nav-item ' + (view === 'prospects' ? 'active' : '')} onClick={() => navigate('prospects')} title="My prospects"><UserPlus size={18} /><span className="nav-label">My prospects</span><span className="nav-count">{savedCount}</span></button>
      </nav>
      <div className="source-status"><div className="nav-caption">DATA IN THIS WORKSPACE</div>{(['linkedin', 'reddit', 'hackernews'] as const).map(s => { const label = s === 'hackernews' ? 'Hacker News' : s === 'linkedin' ? 'LinkedIn' : 'Reddit'; return <div className="source-row" key={s} title={`${label} · ${leads.filter(l => l.source === s).length}`}><i className={leads.some(l => l.source === s) ? 'dot green' : 'dot'} /><span className="source-name">{label}</span><small>{leads.filter(l => l.source === s).length}</small></div>; })}</div>
      <div className="sidebar-bottom">
        <div className="review-note" title="You review. You connect."><CircleHelp size={17} /><span>Built for a human touch.<small>You review. You connect.</small></span></div>
        <button className="operator" onClick={() => setSettings(true)} title="Workspace settings">
          <span className="avatar">{workspace.operator.trim().slice(0, 2).toUpperCase() || 'YOU'}</span>
          <span className="operator-copy">{workspace.operator || 'Your workspace'}<small>Saved on this device</small></span>
          <Settings2 size={16} className="operator-gear" />
        </button>
      </div>
    </aside>
    <div className="main-shell"><header className="topbar"><div><button type="button" className="sidebar-toggle topbar-toggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(c => !c)}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button><span className="breadcrumb">Workspace</span><ChevronRight size={13} /><span>{view === 'brain' ? 'Company brain' : view === 'prospects' ? 'My prospects' : 'Buying signals'}</span></div><span className="review-badge"><i className="dot green" />You review. Nothing auto-sends.</span></header>
      <main className="main-content">
        <div className="journey-steps"><button onClick={() => navigate('start')}><span><Check size={12} /></span>Your company</button><ChevronRight size={13} /><button onClick={() => navigate('queue')} className={view === 'queue' || view === 'brain' ? 'current' : ''}><span>02</span>Find the intent</button><ChevronRight size={13} /><button onClick={() => navigate('prospects')} className={view === 'prospects' ? 'current' : ''}><span>03</span>Start a conversation</button></div>
        {storageError && <div className="warning">Device storage is unavailable. Export your workspace before closing this page.</div>}
        {error && <div role="alert" className="warning">{error}</div>}
        <>
          <div className="page-heading"><div><div className="eyebrow">{companyName.toUpperCase()} / {view === 'brain' ? 'THE COMPANY BRAIN' : view === 'prospects' ? 'YOUR RELATIONSHIPS' : 'PUBLIC BUYING SIGNALS'}</div><h1>{view === 'brain' ? 'Good context changes everything.' : view === 'prospects' ? 'From signal to conversation.' : 'Less noise. More intent.'}</h1><p>{view === 'brain' ? 'We read your website. Here’s what we’ll look for.' : view === 'prospects' ? 'The people you chose to follow up with, all in one place.' : 'Find the people already asking for what you do.'}</p></div>{view === 'brain' ? <button className="primary-button" disabled={!!busy} onClick={() => void findSignals()}>{busy === 'search' ? <RefreshCw className="spin" size={15} /> : <Radar size={15} />}{busy === 'search' ? 'Finding & scoring signals…' : 'Find LinkedIn signals'}</button> : <button className="secondary-button" onClick={exportWorkspace}><FileDown size={15} />Export workspace</button>}</div>
          {view === 'brain' ? <section className="brain-grid"><article className="panel brain-card"><span className="eyebrow">WHAT YOU DO</span><h2>Meet {companyName}.</h2><p>{data.profile.sells}</p><h3>Who buys from you</h3><p>{data.profile.icp}</p><h3>Your voice</h3><p>{data.profile.tone}</p><a href={safeUrl(data.company_input)} target="_blank" rel="noreferrer">Read company website<ArrowUpRight size={14} /></a></article><article className="panel brain-card"><span className="eyebrow">WHAT WE LISTEN FOR</span><h2>Pain, in their words.</h2><ul>{data.profile.pains.map((p, i) => <li key={i}>{p}</li>)}</ul><h3>Who we filter out</h3><ul>{data.profile.disqualify.map((p, i) => <li key={i}>{p}</li>)}</ul></article><article className="panel brain-card wide"><span className="eyebrow">SEARCH STRATEGY</span><h2>From your website to their words.</h2><p>We’ll search the first two queries. You can refine the search from the signals inbox.</p><div className="query-tags">{data.queries.map((q, i) => <span key={i}>{q}</span>)}</div>{data.website_source && <details className="website-evidence"><summary>What we read from your website</summary><p>{data.website_source.excerpt}</p><a href={safeUrl(data.website_source.url)} target="_blank" rel="noreferrer">Open the page we read<ExternalLink size={12} /></a><small>Read {new Date(data.website_source.fetched_at).toLocaleString()}</small></details>}<button className="primary-button brain-find" disabled={!!busy} onClick={() => void findSignals()}>{busy === 'search' ? 'Searching LinkedIn…' : 'Find LinkedIn signals'}<ArrowRight size={15} /></button><p className="field-hint">{isJumpstartCompany(data) ? 'Reddit signals are already in your inbox. This button runs a live LinkedIn search.' : 'Runs a live LinkedIn search against your ICP.'} Nothing auto-sends.</p></article></section> : <>
            {view === 'queue' && <><section className="linkedin-search panel"><div><div className="source-logos" aria-hidden="true"><span className="linkedin-logo">in</span>{isJumpstartCompany(data) && <span className="reddit-logo">r/</span>}</div><div><h2>Your company brain is ready. Find the intent.</h2><p>{isJumpstartCompany(data) ? `Reddit is already in your inbox. Run LinkedIn for a live sweep against ${companyName}’s ideal customer.` : `Public LinkedIn posts from the last month, checked against ${companyName}’s ideal customer.`}</p></div></div><div className="search-launch"><button className="primary-button" onClick={() => void findSignals()} disabled={!!busy}>{busy === 'search' ? <RefreshCw className="spin" size={15} /> : <Search size={15} />}{busy === 'search' ? 'Finding & scoring LinkedIn…' : 'Find LinkedIn signals'}</button><button className="text-button" onClick={() => setCustomSearch(v => !v)}>{customSearch ? 'Use company searches' : 'Refine search'}</button></div>{customSearch && <label className="field-label">Your search<input aria-label="LinkedIn search query" value={customQuery} maxLength={240} onChange={e => setCustomQuery(e.target.value)} placeholder='e.g. "first sales hire" London' /></label>}<div className="linkedin-search-hint">LinkedIn: up to {customSearch ? '10 posts · one search' : '20 posts · two searches'}.{isJumpstartCompany(data) ? ' Reddit shows automatically — no search needed.' : ''} Nothing auto-sends.</div>{resultMessage && <p className="linkedin-result" role="status">{resultMessage}</p>}</section><section className="overview"><div className="metrics-grid">{[{ label: 'Posts reviewed', value: leads.length, sub: 'Public conversations', icon: '↗' }, { label: 'Qualified leads', value: counts.kept, sub: 'Match your company profile', icon: '◎' }, { label: 'Ready for a reply', value: counts.hot, sub: 'Buying intent of 6 or more', icon: '✳', hot: true }, { label: 'Noise filtered', value: counts.dropped, sub: 'Excluded with a reason', icon: '⌁' }].map(m => <div className={'metric ' + (m.hot ? 'metric-hot' : '')} key={m.label}><span>{m.label}<span className="metric-symbol">{m.icon}</span></span><strong>{String(m.value).padStart(2, '0')}</strong><small>{m.sub}</small></div>)}<div className="run-caption"><i className="dot green" />{leads.length ? 'Last run · ' + new Date(data.generated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Company brain ready · no searches run yet'}<span>Evidence first. Outreach second.</span></div></div><div className="signal-panel"><div className="signal-panel-title"><span><i className="dot green" />THE SIGNAL FIELD</span><span>{leads.length} NODES</span></div><SignalMap leads={leads} selected={selected} onSelect={setSelected} /><div className="signal-legend"><span><i className="dot lime" />High intent</span><span><i className="dot green" />Qualified</span><span><i className="dot muted" />Filtered</span></div></div></section></>}
            {view === 'prospects' && <div className="prospect-summary panel"><Bookmark size={24} /><div><strong>{savedCount} saved {savedCount === 1 ? 'prospect' : 'prospects'}</strong><p>Connection status is confirmed by you. Notes and follow-ups stay on this device.</p></div><button className="text-button" onClick={() => navigate('queue')}>Find more signals<ArrowRight size={14} /></button></div>}
            <section className="queue panel"><div className="queue-title"><div><h2>{view === 'prospects' ? 'My prospects' : 'Your signal inbox'}<span>{view === 'prospects' ? savedCount : counts.kept}</span></h2><p>{view === 'prospects' ? 'Review a prospect, update the connection, plan your next step.' : 'Open a conversation to see the evidence and its source.'}</p></div><div className="search-box"><Search size={15} /><input aria-label="Search leads" placeholder="Search people or signals…" value={query} onChange={e => setQuery(e.target.value)} /></div></div>{view === 'queue' && <div className="queue-toolbar"><div className="tabs">{([{ id: 'all', label: 'All leads', n: counts.kept }, { id: 'actionable', label: 'High intent', n: counts.hot }, { id: 'claimed', label: 'In progress', n: counts.claimed }, { id: 'dropped', label: 'Filtered', n: counts.dropped }] as const).map(t => <button key={t.id} onClick={() => setFilter(t.id)} className={filter === t.id ? 'selected' : ''}>{t.label}<span>{t.n}</span></button>)}</div></div>}<div className="list-controls"><span>{visible.length} {view === 'prospects' ? 'saved prospects' : 'conversations'}</span><div><select aria-label="Source" value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option><option value="linkedin">LinkedIn</option><option value="reddit">Reddit</option><option value="hackernews">Hacker News</option></select><select aria-label="Sort leads" value={sort} onChange={e => setSort(e.target.value)}><option value="intent">Highest intent</option><option value="fit">Best fit</option><option value="recent">Most recent</option></select></div></div><div className="table-heading"><span>CONVERSATION / SIGNAL</span><span>INTENT</span><span>FIT</span><span>{view === 'prospects' ? 'CONNECTION' : 'STATUS'}</span><span /></div><div className="lead-list">{visible.map(l => <button className={'lead-row ' + (selected === l.id ? 'row-selected' : '')} key={l.id} onClick={() => setSelected(l.id)}><div className="lead-main"><div className="lead-meta"><span className={'source-icon ' + l.source}>{l.source === 'reddit' ? 'r' : l.source === 'linkedin' ? 'in' : 'Y'}</span><span>{l.author_handle}</span><span>·</span><span>{l.source === 'linkedin' ? 'LinkedIn' : l.context}</span>{actionable(l) && <span className="intent-tag">HIGH INTENT</span>}{session?.prospects[l.id] && <Bookmark size={10} />}</div><h3>{l.title || 'Untitled conversation'}</h3><p>{l.disqualified ? l.disqualified_reason : l.quote || l.reasoning || l.body_excerpt}</p></div><div className={'score ' + (l.scores.intent >= 6 ? 'score-high' : '')}>{l.scores.intent}<small>/10</small></div><div className="fit-score">{l.scores.fit}<small>/10</small></div><span className={'status status-' + (l.disqualified ? 'filtered' : claimFor(l).status)}>{view === 'prospects' ? connectionLabel(session?.connections[l.id] || 'not_sent') : l.disqualified ? 'Filtered' : claimFor(l).status === 'new' ? 'New signal' : claimFor(l).status}</span><ChevronRight size={17} /></button>)}</div>{visible.length === 0 && <div className="empty"><Radar size={28} /><h3>{view === 'prospects' ? 'Your next conversation starts with a signal.' : busy === 'search' ? 'Searching for the right conversations…' : 'No signals in this view yet.'}</h3><p>{view === 'prospects' ? 'Open a qualified signal, connect on LinkedIn, then add the person here.' : leads.length ? 'Try another filter, or refine your search. We keep intent scoring strict.' : 'Reddit loads automatically on Jumpstart. Use Find LinkedIn signals for a live LinkedIn sweep.'}</p><button className="text-button" onClick={() => { if (view === 'prospects') navigate('queue'); else { setFilter('all'); setSource('all'); setQuery(''); } }}>{view === 'prospects' ? 'Explore buying signals' : 'Reset filters'}<ArrowRight size={13} /></button></div>}<footer className="queue-footer"><span><i className="dot green" />A human reviews and sends every message.</span><span>Workspace saved on this device</span></footer></section>
          </>}
          <div className="bottom-caption"><span>SIGNAL HUNTER <span className="divider">/</span> BUILT TO FIND THE RIGHT MOMENT</span><span>Powered by context, guided by you<ArrowUpRight size={12} /></span></div>
        </>
      </main>
    </div>
    {active && session && <div className="drawer-backdrop" onClick={() => setSelected('')}><section className="detail-drawer" role="dialog" aria-modal="true" aria-label="Lead details" onClick={e => e.stopPropagation()}><div className="drawer-heading"><span className="eyebrow">FROM SIGNAL TO CONVERSATION</span><button className="icon-button" aria-label="Close details" autoFocus onClick={() => setSelected('')}><X size={20} /></button></div><div className="lead-meta">{active.context} · {active.author_handle}</div><h2>{active.title}</h2><div className="detail-scores">{(['intent', 'fit', 'urgency'] as const).map(s => <div key={s}><span>{s}</span><strong>{active.scores[s]}<small>/10</small></strong></div>)}</div><div className="step-label"><span>1</span><h3>Read the evidence</h3></div><blockquote>{active.quote || 'No qualifying quote identified.'}</blockquote><p className="reasoning">{active.reasoning}</p>{active.disqualified && <div className="warning">Filtered: {active.disqualified_reason}</div>}<section className="suggested-message" aria-label="Suggested message"><div className="section-label"><h3>Suggested message</h3>{actionable(active) && !!(workspace.drafts[active.id] ?? active.draft_reply).trim() && <button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(workspace.drafts[active.id] ?? active.draft_reply); setNotice('Suggested message copied. Review it before sending.'); } catch { setNotice('Select the suggested message text to copy it.'); } }}><Copy size={14} />Copy message</button>}</div>{actionable(active) ? <><textarea aria-label="Suggested message" className="draft-editor" placeholder="No message was saved. Run the search again to generate a draft, or write your own." value={workspace.drafts[active.id] ?? active.draft_reply} onChange={e => setWorkspace(w => ({ ...w, drafts: { ...w.drafts, [active.id]: e.target.value } }))} />{Object.prototype.hasOwnProperty.call(workspace.drafts, active.id) && <button className="text-button" onClick={() => setWorkspace(w => { const drafts = { ...w.drafts }; delete drafts[active.id]; return { ...w, drafts }; })}>Restore original suggestion</button>}<p className="field-hint">Edit this in your own voice, then copy it to LinkedIn. Nothing sends automatically.</p></> : <p className="message-unavailable">{active.disqualified ? 'No message suggested because this lead was filtered out. Review the qualification reason above.' : `No message suggested: intent is ${active.scores.intent}/10. Suggestions are created for qualified leads scoring 6/10 or higher. Open a lead in the High intent tab to see one.`}</p>}</section><details><summary>Read the source excerpt</summary><p className="excerpt">{active.body_excerpt}</p></details>{safeUrl(active.source_url) && <a className="secondary-button source-button" href={safeUrl(active.source_url)} target="_blank" rel="noreferrer">Open original {active.source === 'linkedin' ? 'LinkedIn post' : 'conversation'}<ExternalLink size={14} /></a>}
      {!active.disqualified && <><div className="step-label"><span>2</span><h3>Connect on {active.source === 'linkedin' ? 'LinkedIn' : 'the original platform'}</h3></div><p className="field-hint">Open their profile in a new tab and send a connection request yourself. Your place here stays saved.</p>{safeUrl(active.author_profile_url) && <a className="primary-button profile-button" href={safeUrl(active.author_profile_url)} target="_blank" rel="noreferrer" onClick={() => setSession(s => s ? { ...s, pending: active.id } : s)}><UserPlus size={15} />{active.source === 'linkedin' ? 'Open LinkedIn profile to connect' : 'Open author profile'}<ArrowUpRight size={15} /></a>}<div className="connection-confirm"><span>Back from LinkedIn? Confirm what you did.</span><div>{([{ state: 'not_sent', label: 'Not sent yet' }, { state: 'requested', label: 'I sent a request' }, { state: 'connected', label: 'Already connected' }] as const).map(c => <button key={c.state} className={activeConnection === c.state ? 'chosen' : ''} onClick={() => setSession(s => s ? confirmConnection(s, active.id, c.state) : s)}>{activeConnection === c.state && <Check size={12} />}{c.label}</button>)}</div><small>We don’t send requests or verify connection status.</small></div><div className="step-label"><span>3</span><h3>{session.prospects[active.id] ? 'Your saved prospect' : 'Add them to your prospects'}</h3></div></>}
      <label className="field-label">Notes for your next conversation<textarea value={claimFor(active).notes} onChange={e => updateClaim(active, { notes: e.target.value })} placeholder="What did you learn? When should you follow up?" /></label>

      <details className="ownership"><summary>Owner and follow-up status</summary><label className="field-label">Owner<input value={claimFor(active).claimed_by} onChange={e => updateClaim(active, { claimed_by: e.target.value })} placeholder={workspace.operator || 'Assign an owner'} /></label><label className="field-label">Status<select value={claimFor(active).status} onChange={e => updateClaim(active, { status: e.target.value as Claim['status'] })}>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label><button className="secondary-button" onClick={() => { if (!workspace.operator.trim()) { setSettings(true); return; } updateClaim(active, { status: 'claimed', claimed_by: workspace.operator.trim() }); setNotice('Lead claimed on this device.'); }}>Claim this lead</button></details>
      <div className="drawer-actions">{session.prospects[active.id] ? <><button className="text-button" onClick={() => { setSession(s => { if (!s) return s; const prospects = { ...s.prospects }; delete prospects[active.id]; return { ...s, prospects }; }); setNotice('Removed from saved prospects. The original signal is kept.'); }}>Remove from prospects</button><button className="primary-button" onClick={() => { setSelected(''); navigate('prospects'); }}>View my prospects<ArrowRight size={15} /></button></> : <button className="primary-button add-prospect" disabled={active.disqualified || !!data?.demo} onClick={() => saveLead(active)}><Bookmark size={15} />Add to my prospects<ArrowRight size={15} /></button>}</div>{active.disqualified && <p className="field-hint">This signal was filtered out and cannot be added as a prospect.</p>}</section></div>}
    {settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><section className="settings-modal panel" role="dialog" aria-modal="true" aria-label="Workspace settings" onClick={e => e.stopPropagation()}><div className="drawer-heading"><h2>Your workspace</h2><button className="icon-button" aria-label="Close settings" onClick={() => setSettings(false)}><X size={18} /></button></div><p>Give your claims a name. Everything is saved in this browser.</p><label className="field-label">Your name<input autoFocus maxLength={100} value={workspace.operator} placeholder="e.g. Aditya" onChange={e => setWorkspace(w => ({ ...w, operator: e.target.value }))} /></label><button className="primary-button" onClick={() => setSettings(false)}>Save name<Check size={15} /></button></section></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}
