import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function blocks(raw) {
  return raw.replace(/\r\n/g, '\n').split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
}
function field(block, key) {
  const match = block.match(new RegExp(`^${key}:\\s*(.*)$`, 'im'));
  if (!match) return '';
  if (key === 'text' || key === 'title') {
    const start = block.search(new RegExp(`^${key}:\\s*`, 'im'));
    if (start < 0) return '';
    const after = block.slice(start).replace(new RegExp(`^${key}:\\s*`, 'i'), '');
    const next = after.search(/\n(?:subreddit|url|title|text|handle):/i);
    return (next < 0 ? after : after.slice(0, next)).trim();
  }
  return match[1].trim();
}
function idFor(source, url) {
  return `${source}_` + createHash('sha1').update(url).digest('hex').slice(0, 12);
}
function empty(partial) {
  return {
    ...partial,
    quote: '',
    scores: { intent: 0, fit: 0, urgency: 0, total: 0 },
    reasoning: '',
    disqualified: false,
    disqualified_reason: '',
    draft_reply: '',
    claim: { claimed_by: '', status: 'new', notes: '' },
  };
}
function parseReddit(raw, fetchedAt) {
  return blocks(raw).flatMap((block) => {
    const url = field(block, 'url');
    const title = field(block, 'title');
    const text = field(block, 'text');
    const subreddit = field(block, 'subreddit') || 'r/unknown';
    if (!url || !text) return [];
    return [empty({
      id: idFor('reddit', url),
      source: 'reddit',
      source_url: url,
      fetched_at: fetchedAt,
      posted_at: fetchedAt,
      author_handle: 'reddit',
      author_profile_url: '',
      context: subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`,
      title: title || text.split('\n').find((l) => l.trim())?.slice(0, 160) || 'Reddit conversation',
      body_excerpt: text.slice(0, 600),
    })];
  });
}

const fetchedAt = '2026-10-24T14:00:00Z';
const reddit = parseReddit(readFileSync('data/reddit_posts.txt', 'utf8'), fetchedAt);
const example = JSON.parse(readFileSync('data/example-leads.json', 'utf8'));

const meta = {
  [reddit[0].id]: {
    intent: 6, fit: 7, urgency: 8,
    quote: 'Wayy too many to be read by hand and the basic screening questins still left me with hundreds that technically pass',
    reasoning: 'High-volume screening pain matches Jumpstart buyers who lack a recruiting team, though they asked for software not talent.',
    disqualified: false, disqualified_reason: '',
    draft_reply: 'You mentioned "Wayy too many to be read by hand and the basic screening questins still left me with hundreds that technically pass". Jumpstart helps UK startups find early-career commercial people without drowning founders in applications. Is this hire for a UK commercial or ops role?',
  },
  [reddit[1].id]: {
    intent: 7, fit: 8, urgency: 6,
    quote: 'I would like to hire some developers to take the development burden off me so I can concentrate more on getting clients',
    reasoning: 'Solo founder planning first hires and shifting time to revenue - close to Jumpstart ICP, though the role skews engineering.',
    disqualified: false, disqualified_reason: '',
    draft_reply: 'You mentioned "I would like to hire some developers to take the development burden off me so I can concentrate more on getting clients". Jumpstart helps UK startups place early-career commercial talent so founders can stay on growth. Are you also planning a first sales or ops hire alongside engineering?',
  },
  [reddit[2].id]: {
    intent: 2, fit: 2, urgency: 3,
    quote: 'especially for blue collar, trades, etc.',
    reasoning: 'Hiring channel question for blue-collar roles sits outside Jumpstart early-career commercial ICP.',
    disqualified: true, disqualified_reason: 'Blue-collar / trades hiring; outside Jumpstart ICP.',
    draft_reply: '',
  },
};

function finish(lead, m) {
  let body = lead.body_excerpt;
  if (m.quote && !body.includes(m.quote)) body = (m.quote + ' - ' + body).slice(0, 600);
  return {
    ...lead,
    body_excerpt: body,
    quote: m.quote,
    scores: { intent: m.intent, fit: m.fit, urgency: m.urgency, total: m.intent + m.fit + m.urgency },
    reasoning: m.reasoning,
    disqualified: m.disqualified,
    disqualified_reason: m.disqualified_reason,
    draft_reply: m.draft_reply,
  };
}

const community = reddit.map((l) => finish(l, meta[l.id]));
const keepHn = example.leads.filter((l) => l.source === 'hackernews');
const leads = [...community, ...keepHn];
const dropped = leads.filter((l) => l.disqualified).length;

example.demo = true;
example.company_name = 'Jumpstart';
example.company_input = 'https://jumpstart-uk.com';
example.generated_at = fetchedAt;
example.leads = leads;
example.counts = { fetched: leads.length, kept: leads.length - dropped, dropped };

writeFileSync('data/example-leads.json', JSON.stringify(example, null, 2) + '\n');
console.log(JSON.stringify({
  total: leads.length,
  bySource: Object.fromEntries(['reddit', 'hackernews'].map((s) => [s, leads.filter((l) => l.source === s).length])),
}, null, 2));
