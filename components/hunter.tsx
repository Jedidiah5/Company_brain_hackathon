'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  Radar,
  Layers3,
  BrainCircuit,
  Settings2,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  X,
  FileDown,
  Crosshair,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { actionable, rank, readWorkspace, safeUrl } from '@/lib/leads';
import { statuses, type Claim, type Dataset, type Lead, type Workspace } from '@/lib/types';

const SignalMap = dynamic(() => import('./signal-map'), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});

const STORAGE = 'signal-hunter.workspace.v1';
const SIDEBAR_STORAGE = 'signal-hunter.sidebar.v1';
type View = 'queue' | 'brain';
type Filter = 'all' | 'actionable' | 'claimed' | 'dropped';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export default function Hunter() {
  const reduce = useReducedMotion();
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace>({ claims: {}, drafts: {}, operator: '' });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [view, setView] = useState<View>('queue');
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('intent');
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/leads', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load signals');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load signals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    try {
      setWorkspace(readWorkspace(localStorage.getItem(STORAGE)));
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE) === '1');
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(workspace));
    } catch {
      setStorageError(true);
    }
  }, [workspace, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(SIDEBAR_STORAGE, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed, ready]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!selected && !settings) return;
    const previous = document.activeElement as HTMLElement | null;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected('');
        setSettings(false);
      }
      if (event.key === 'Tab') {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
        const dialog = dialogs[dialogs.length - 1];
        if (!dialog) return;
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, textarea, summary',
          ),
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [selected, settings]);

  const leads = useMemo(() => data?.leads || [], [data]);
  const claimFor = (l: Lead): Claim =>
    workspace.claims[l.id] || l.claim || { claimed_by: '', status: 'new', notes: '' };
  const counts = {
    kept: leads.filter((l) => !l.disqualified).length,
    hot: leads.filter(actionable).length,
    dropped: leads.filter((l) => l.disqualified).length,
    claimed: leads.filter((l) => !l.disqualified && claimFor(l).status !== 'new').length,
  };

  const visible = useMemo(() => {
    let rows = leads.filter((l) =>
      filter === 'dropped'
        ? l.disqualified
        : filter === 'actionable'
          ? actionable(l)
          : filter === 'claimed'
            ? !l.disqualified && (workspace.claims[l.id] || l.claim)?.status !== 'new'
            : !l.disqualified,
    );
    rows = rows.filter(
      (l) =>
        (source === 'all' || l.source === source) &&
        (!query ||
          [l.title, l.quote, l.author_handle, l.context, l.reasoning]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    return sort === 'recent'
      ? [...rows].sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at))
      : sort === 'fit'
        ? [...rows].sort((a, b) => b.scores.fit - a.scores.fit)
        : rank(rows);
  }, [leads, filter, source, query, sort, workspace.claims]);

  const active = leads.find((l) => l.id === selected);

  function updateClaim(lead: Lead, patch: Partial<Claim>) {
    setWorkspace((w) => ({
      ...w,
      claims: {
        ...w.claims,
        [lead.id]: {
          ...(w.claims[lead.id] || lead.claim || { claimed_by: '', status: 'new', notes: '' }),
          ...patch,
        },
      },
    }));
  }

  function claim(lead: Lead) {
    if (!workspace.operator.trim()) {
      setSettings(true);
      setNotice('Add your name before claiming a lead.');
      return;
    }
    updateClaim(lead, { status: 'claimed', claimed_by: workspace.operator.trim() });
    setNotice('Lead claimed on this device.');
  }

  function exportLeads() {
    if (!data) return;
    const file = {
      ...data,
      leads: leads.map((l) => ({
        ...l,
        claim: claimFor(l),
        draft_reply: workspace.drafts[l.id] ?? l.draft_reply,
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signal-hunter-workspace.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function jumpToFilter(next: Filter) {
    setView('queue');
    setFilter(next);
    setNotice(
      next === 'actionable'
        ? 'Showing high-intent signals'
        : next === 'dropped'
          ? 'Showing filtered noise'
          : next === 'claimed'
            ? 'Showing your workspace'
            : 'Showing all qualified leads',
    );
  }

  const metrics = data
    ? [
        {
          label: 'Posts swept',
          value: data.counts.fetched,
          sub: 'Public conversations',
          icon: '↗',
          onClick: () => jumpToFilter('all'),
        },
        {
          label: 'Qualified leads',
          value: counts.kept,
          sub: 'Match your company profile',
          icon: '◎',
          onClick: () => jumpToFilter('all'),
        },
        {
          label: 'Ready for a reply',
          value: counts.hot,
          sub: 'Buying intent of 6 or more',
          icon: '✳',
          hot: true,
          onClick: () => jumpToFilter('actionable'),
        },
        {
          label: 'Noise filtered',
          value: counts.dropped,
          sub: 'Excluded with a reason',
          icon: '⌁',
          onClick: () => jumpToFilter('dropped'),
        },
      ]
    : [];

  return (
    <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
      <aside className={'sidebar' + (collapsed ? ' is-collapsed' : '')} aria-label="Workspace navigation">
        <div className="sidebar-top">
          <a className="brand" href="/" aria-label="Signal Hunter home">
            <span className="brand-mark">
              <Crosshair size={22} />
            </span>
            <span className="brand-copy">
              <span className="brand-name">
                SIGNAL<span className="brand-light">HUNTER</span>
              </span>
              <small>FIND THE INTENT.</small>
            </span>
          </a>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="workspace-label">
          <span>WORKSPACE</span>
          <span>01</span>
        </div>

        <button
          className="company-switch"
          onClick={() => setView('brain')}
          title="Jumpstart · Company brain"
        >
          <span className="company-avatar">j.</span>
          <span className="company-copy">
            Jumpstart<small>UK startup talent</small>
          </span>
          <ChevronRight size={15} className="company-chevron" />
        </button>

        <div className="nav-caption">DISCOVER</div>
        <nav>
          <button
            className={view === 'queue' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('queue')}
            title="Signal inbox"
          >
            <Radar size={18} />
            <span className="nav-label">Signal inbox</span>
            <span className="nav-count">{counts.hot}</span>
          </button>
          <button
            className={view === 'brain' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('brain')}
            title="Company brain"
          >
            <BrainCircuit size={18} />
            <span className="nav-label">Company brain</span>
          </button>
          <button
            className={'nav-item' + (view === 'queue' && filter === 'claimed' ? ' active' : '')}
            onClick={() => {
              setView('queue');
              setFilter('claimed');
            }}
            title="My workspace"
          >
            <Layers3 size={18} />
            <span className="nav-label">My workspace</span>
            <span className="nav-count">{counts.claimed}</span>
          </button>
        </nav>

        <div className="source-status">
          <div className="nav-caption">DATA IN THIS RUN</div>
          {['reddit', 'hn'].map((s) => {
            const n = leads.filter((l) => l.source === s).length;
            const live = leads.some((l) => l.source === s);
            return (
              <div key={s} className="source-row" title={(s === 'hn' ? 'Hacker News' : 'Reddit') + ` · ${n} posts`}>
                <i className={live ? 'dot green' : 'dot'} />
                <span className="source-name">{s === 'hn' ? 'Hacker News' : 'Reddit'}</span>
                <small>{n}</small>
              </div>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="review-note" title="You review. You send.">
            <CircleHelp size={17} />
            <span>
              Built for a human touch.
              <small>You review. You send.</small>
            </span>
          </div>
          <button className="operator" onClick={() => setSettings(true)} title="Workspace settings">
            <span className="avatar">{workspace.operator.trim().slice(0, 2).toUpperCase() || 'YOU'}</span>
            <span className="operator-copy">
              {workspace.operator || 'Set your name'}
              <small>Local workspace</small>
            </span>
            <Settings2 size={16} className="operator-gear" />
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              type="button"
              className="sidebar-toggle topbar-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <span>{view === 'brain' ? 'Company brain' : 'Signal inbox'}</span>
          </div>
          <span className="review-badge">
            <i className="dot green" /> Human review required
          </span>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR NEXT CONVERSATION STARTS HERE</div>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={view}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  {view === 'brain' ? 'A brain for your business.' : 'Less noise. More intent.'}
                </motion.h1>
              </AnimatePresence>
              <p>
                {view === 'brain'
                  ? 'The context behind every search, score, and reply.'
                  : 'Find the people already asking for what you do.'}
              </p>
            </div>
            <button className="primary-button" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              {loading ? 'Loading signals' : 'Refresh signals'}
            </button>
          </div>

          {data?.demo && (
            <div className="demo-banner">
              <span>SAMPLE WORKSPACE</span>
              Illustrative conversations for trying the interface. These are not real prospects.
            </div>
          )}
          {storageError && (
            <div className="warning">
              Browser storage is unavailable. Your edits will last only until this page closes.
            </div>
          )}
          {error && (
            <div className="warning">
              {error}
              <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {!data && !error && <div className="empty">Loading your latest signal run…</div>}

          {data && (
            <AnimatePresence mode="wait">
              {view === 'brain' ? (
                <motion.section
                  key="brain"
                  className="brain-grid"
                  initial={reduce ? false : 'hidden'}
                  animate="show"
                  exit={reduce ? undefined : { opacity: 0, y: 8 }}
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
                  }}
                >
                  <motion.article className="panel brain-card" variants={fadeUp}>
                    <span className="eyebrow">COMPANY PROFILE</span>
                    <h2>Meet Jumpstart.</h2>
                    <p>{data.profile.sells}</p>
                    <h3>Ideal customer</h3>
                    <p>{data.profile.icp}</p>
                    <h3>Voice</h3>
                    <p>{data.profile.tone}</p>
                    <a href={safeUrl(data.company_input)} target="_blank" rel="noreferrer">
                      Company source <ArrowUpRight size={14} />
                    </a>
                  </motion.article>
                  <motion.article className="panel brain-card" variants={fadeUp}>
                    <span className="eyebrow">WHAT WE LISTEN FOR</span>
                    <h2>Pain, in their words.</h2>
                    <ul>
                      {data.profile.pains.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                    <h3>Who we filter out</h3>
                    <ul>
                      {data.profile.disqualify.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </motion.article>
                  <motion.article className="panel brain-card wide" variants={fadeUp}>
                    <span className="eyebrow">SEARCH STRATEGY</span>
                    <h2>From pain to public signals.</h2>
                    <div className="query-tags">
                      {data.queries.map((q, i) => (
                        <span key={i}>{q}</span>
                      ))}
                    </div>
                  </motion.article>
                </motion.section>
              ) : (
                <motion.div
                  key="queue"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <section className="overview">
                    <div className="metrics-grid">
                      {metrics.map((m, i) => (
                        <motion.button
                          type="button"
                          key={m.label}
                          className={
                            'metric metric-button' +
                            (m.hot ? ' metric-hot' : '') +
                            ((m.hot && filter === 'actionable') ||
                            (m.label === 'Noise filtered' && filter === 'dropped') ||
                            (m.label === 'Qualified leads' && filter === 'all')
                              ? ' metric-active'
                              : '')
                          }
                          onClick={m.onClick}
                          initial={reduce ? false : { opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.05 }}
                          whileHover={reduce ? undefined : { y: -2 }}
                          whileTap={reduce ? undefined : { scale: 0.985 }}
                        >
                          <span>
                            {m.label}
                            <span className="metric-symbol">{m.icon}</span>
                          </span>
                          <strong>{m.value.toString().padStart(2, '0')}</strong>
                          <small>{m.sub}</small>
                          <span className="metric-hint">Click to filter</span>
                        </motion.button>
                      ))}
                      <div className="run-caption">
                        <i className="dot green" />
                        Latest dataset ·{' '}
                        {new Date(data.generated_at).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/London',
                        })}{' '}
                        London <span>No messages sent automatically</span>
                      </div>
                    </div>
                    <motion.div
                      className="signal-panel"
                      initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: reduce ? 0 : 0.1 }}
                    >
                      <div className="signal-panel-title">
                        <span>
                          <i className="dot green" />
                          THE SIGNAL FIELD
                        </span>
                        <span>{leads.length} NODES</span>
                      </div>
                      <SignalMap leads={leads} selected={selected} onSelect={setSelected} />
                      <div className="signal-legend">
                        <span>
                          <i className="dot lime" />
                          High intent
                        </span>
                        <span>
                          <i className="dot green" />
                          Qualified
                        </span>
                        <span>
                          <i className="dot muted" />
                          Filtered
                        </span>
                      </div>
                    </motion.div>
                  </section>

                  <section className="queue panel">
                    <div className="queue-title">
                      <div>
                        <h2>
                          Your signal inbox <span>{counts.kept}</span>
                        </h2>
                        <p>Real conversations. A reason to reach out.</p>
                      </div>
                      <button className="text-button" onClick={exportLeads}>
                        <FileDown size={15} />
                        Export
                      </button>
                    </div>
                    <div className="queue-toolbar">
                      <div className="tabs">
                        {(
                          [
                            { id: 'all', label: 'All leads', n: counts.kept },
                            { id: 'actionable', label: 'High intent', n: counts.hot },
                            { id: 'claimed', label: 'In progress', n: counts.claimed },
                            { id: 'dropped', label: 'Filtered', n: counts.dropped },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setFilter(t.id)}
                            className={filter === t.id ? 'selected' : ''}
                          >
                            {t.label}
                            <span>{t.n}</span>
                          </button>
                        ))}
                      </div>
                      <div className="search-box">
                        <Search size={15} />
                        <input
                          aria-label="Search leads"
                          placeholder="Search signals…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="list-controls">
                      <span>
                        {visible.length}{' '}
                        {filter === 'dropped' ? 'filtered signals' : 'conversations'}
                        <span className="divider">/</span>{' '}
                        {filter === 'actionable' ? 'Ready for human review' : 'Sorted for relevance'}
                      </span>
                      <div>
                        <label>
                          <span className="sr-only">Source</span>
                          <select value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="all">All sources</option>
                            <option value="reddit">Reddit</option>
                            <option value="hn">Hacker News</option>
                          </select>
                        </label>
                        <SlidersHorizontal size={13} />
                        <select
                          aria-label="Sort leads"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="intent">Highest intent</option>
                          <option value="fit">Best fit</option>
                          <option value="recent">Most recent</option>
                        </select>
                      </div>
                    </div>
                    <div className="table-heading">
                      <span>CONVERSATION / SIGNAL</span>
                      <span>INTENT</span>
                      <span>FIT</span>
                      <span>STATUS</span>
                      <span />
                    </div>
                    <div className="lead-list">
                      <AnimatePresence mode="popLayout">
                        {visible.map((l, i) => {
                          const c = claimFor(l);
                          return (
                            <motion.button
                              layout={!reduce}
                              className={
                                'lead-row' +
                                (selected === l.id ? ' row-selected' : '') +
                                (actionable(l) ? ' lead-hot' : '')
                              }
                              key={l.id}
                              onClick={() => setSelected(l.id)}
                              initial={reduce ? false : { opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={reduce ? undefined : { opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(i, 8) * 0.03 }}
                              whileHover={reduce ? undefined : { x: 3 }}
                            >
                              <div className="lead-main">
                                <div className="lead-meta">
                                  <span className={'source-icon ' + l.source}>
                                    {l.source === 'reddit' ? 'r' : 'Y'}
                                  </span>
                                  <span>{l.context || l.source}</span>
                                  <span>·</span>
                                  <span>@{l.author_handle}</span>
                                  {actionable(l) && <span className="intent-tag">HIGH INTENT</span>}
                                </div>
                                <h3>{l.title || 'Untitled conversation'}</h3>
                                <p>
                                  {l.disqualified
                                    ? l.disqualified_reason
                                    : l.quote || l.reasoning || l.body_excerpt}
                                </p>
                              </div>
                              <div className={'score' + (l.scores.intent >= 6 ? ' score-high' : '')}>
                                {l.scores.intent}
                                <small>/10</small>
                              </div>
                              <div className="fit-score">
                                {l.scores.fit}
                                <small>/10</small>
                              </div>
                              <span
                                className={
                                  'status status-' + (l.disqualified ? 'filtered' : c.status)
                                }
                              >
                                {l.disqualified
                                  ? 'Filtered'
                                  : c.status === 'new'
                                    ? 'New signal'
                                    : c.status}
                              </span>
                              <ChevronRight size={17} />
                            </motion.button>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                    {visible.length === 0 && (
                      <div className="empty">
                        <Radar size={28} />
                        <h3>No signals in this view</h3>
                        <p>Try another filter or refresh after running the pipeline.</p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setFilter('all');
                            setSource('all');
                            setQuery('');
                          }}
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                    <footer className="queue-footer">
                      <span>
                        <i className="dot green" />
                        Evidence first. Outreach second.
                      </span>
                      <span>Claims saved on this device</span>
                    </footer>
                  </section>
                  <div className="bottom-caption">
                    <span>
                      SIGNAL HUNTER <span className="divider">/</span> BUILT TO FIND THE RIGHT MOMENT
                    </span>
                    <span>
                      Powered by context, guided by you <ArrowUpRight size={12} />
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="drawer-backdrop"
            onClick={() => setSelected('')}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.section
              className="detail-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Lead details"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSelected('');
              }}
              initial={reduce ? false : { x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? undefined : { x: 32, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <div className="drawer-heading">
                <span className="eyebrow">SIGNAL DETAILS</span>
                <button
                  className="icon-button"
                  aria-label="Close details"
                  autoFocus
                  onClick={() => setSelected('')}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="lead-meta">
                {active.context} · @{active.author_handle}
              </div>
              <h2>{active.title}</h2>
              {safeUrl(active.source_url) ? (
                <a
                  className="source-link"
                  href={safeUrl(active.source_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read original conversation <ExternalLink size={14} />
                </a>
              ) : (
                <p className="field-hint">Illustrative conversation · no source post</p>
              )}
              <div className="detail-scores">
                {(['intent', 'fit', 'urgency'] as const).map((s) => (
                  <div key={s}>
                    <span>{s}</span>
                    <strong>
                      {active.scores[s]}
                      <small>/10</small>
                    </strong>
                    <div className="score-bar" aria-hidden>
                      <motion.span
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${active.scores[s] * 10}%` }}
                        transition={{ duration: 0.45, delay: 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <h3>The evidence</h3>
              <blockquote>{active.quote || 'No qualifying quote identified.'}</blockquote>
              <p className="reasoning">{active.reasoning}</p>
              {active.disqualified && (
                <div className="warning">Filtered: {active.disqualified_reason}</div>
              )}
              <details>
                <summary>Source excerpt</summary>
                <p className="excerpt">{active.body_excerpt}</p>
              </details>
              {actionable(active) && (
                <>
                  <div className="section-label">
                    <h3>Your reply draft</h3>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            workspace.drafts[active.id] ?? active.draft_reply,
                          );
                          setNotice('Draft copied. Review it before sending.');
                        } catch {
                          setNotice('Clipboard unavailable. Select the draft text to copy.');
                        }
                      }}
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  <textarea
                    aria-label="Reply draft"
                    className="draft-editor"
                    value={workspace.drafts[active.id] ?? active.draft_reply}
                    onChange={(e) =>
                      setWorkspace((w) => ({
                        ...w,
                        drafts: { ...w.drafts, [active.id]: e.target.value },
                      }))
                    }
                  />
                  <p className="field-hint">
                    Only saved on this device. Review, then send on the original post.
                  </p>
                </>
              )}
              <h3>Workspace</h3>
              <label className="field-label">
                Owner
                <input
                  value={claimFor(active).claimed_by}
                  onChange={(e) => updateClaim(active, { claimed_by: e.target.value })}
                  placeholder="Unassigned"
                />
              </label>
              <label className="field-label">
                Status
                <select
                  value={claimFor(active).status}
                  onChange={(e) =>
                    updateClaim(active, { status: e.target.value as Claim['status'] })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Notes
                <textarea
                  value={claimFor(active).notes}
                  onChange={(e) => updateClaim(active, { notes: e.target.value })}
                  placeholder="Add context for your next conversation…"
                />
              </label>
              <div className="drawer-actions">
                <button className="secondary-button" onClick={() => claim(active)}>
                  Claim lead
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    updateClaim(active, { status: 'contacted' });
                    setNotice('Marked contacted. No message was sent.');
                  }}
                >
                  <Check size={15} />
                  Mark contacted
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settings && (
          <motion.div
            className="modal-backdrop"
            onClick={() => setSettings(false)}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
          >
            <motion.section
              className="settings-modal panel"
              role="dialog"
              aria-modal="true"
              aria-label="Workspace settings"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSettings(false);
              }}
              initial={reduce ? false : { scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div className="drawer-heading">
                <h2>Your workspace</h2>
                <button
                  className="icon-button"
                  aria-label="Close settings"
                  onClick={() => setSettings(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <p>Give your claims a name. Changes are saved in this browser.</p>
              <label className="field-label">
                Your name
                <input
                  autoFocus
                  maxLength={100}
                  value={workspace.operator}
                  placeholder="e.g. Aditya"
                  onChange={(e) => setWorkspace((w) => ({ ...w, operator: e.target.value }))}
                />
              </label>
              <button className="primary-button" onClick={() => setSettings(false)}>
                Save name <Check size={15} />
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.div
            className="toast"
            role="status"
            initial={reduce ? false : { y: 24, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={reduce ? undefined : { y: 16, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
