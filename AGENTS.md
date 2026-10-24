# Signal Hunter, for an agent picking this up

Hackathon project, GTM track, sponsored by Jumpstart. Build stops at 15:00 on 24 October 2026, the Loom is
recorded by 15:30 and submitted by 15:45. Read `README.md` for the pitch and `data-shape.md` for the lead
record. Those two are the contract; do not change key names in the lead record.

## What works right now

`signal_hunter.py` runs the whole loop: brain, queries, fetch, score, `leads.json`.

- **brain** takes a website, a GitHub repo (`owner/repo` or a full URL, using the `gh` CLI so private repos
  work), a local directory, or a one-line description. For a repo it reads the README plus CANON.md,
  CLAUDE.md, PRODUCT.md, STATUS.md and AGENTS.md.
- **score** gives each post intent, fit and urgency out of 10, the quote that qualified the person, a one
  sentence reason, and a drafted reply when intent is 6 or more.
- Disqualified leads stay in `leads.json` with a reason, because the demo shows the filter working.

Verified on Jumpstart: 40 swept, 32 kept, 8 dropped.

## The problem to fix first

**Only 1 of 32 kept leads scored intent 6 or above**, so the board has one actionable row. This is a source
problem, not a prompt problem. Do not try to fix it by loosening the scoring; a board of weak leads is worse
than a short one.

1. **Reddit returns 403 on every unauthenticated request.** `www.reddit.com/search.json`, `old.reddit.com` and
   `api.reddit.com` all refuse, and the redirect lands on a login page. The fix is a free script app at
   reddit.com/prefs/apps, then client credentials against `https://www.reddit.com/api/v1/access_token` and
   queries against `https://oauth.reddit.com/search`. Put `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` in
   `.env`; `.env.example` already lists them. Reddit is where UK founders actually describe this pain, so this
   is the highest value work left.
2. **Hacker News is a poor fit for this ICP.** Of 200 companies in the October 2026 "Who is hiring?" thread,
   one mentioned the UK and a commercial role. HN is US and engineering heavy. Keep it as a source, do not
   expect it to carry the demo.

## Rules

- **Python pipeline: standard library only.** No pip installs. The interactive UI uses Next.js, TypeScript and Three.js per the team's updated stack decision; use `npm ci` for that app.
- **Never commit a key.** This repo is public. `.env` is gitignored; `.env.example` holds placeholders.
- `OPENAI_API_KEY` from the environment wins over `.env`, so an exported key overrides the file.
- Models: `gpt-5-mini` for brain and scoring. The gpt-5 family are reasoning models, so do not set a small
  `max_completion_tokens` or they spend the whole budget thinking and return empty content.
- Point the brain at `jumpstart-uk.com`, never `jumpstart.me`, which serves 58 characters of JavaScript shell.
- Nothing auto-sends. A human reviews and sends every message, and the Loom says so out loud.

## Out of scope today

Auto-sending and finding personal email addresses remain out of scope.

## LinkedIn scope update

The user explicitly requested LinkedIn support after the initial build. The Next.js app now searches public LinkedIn posts through treg (`harvestapi.linkedin.post.search`), scores up to ten with `gpt-5-mini`, and keeps the original lead schema. No browser scraping, cookies, personal enrichment or auto-sending. Local development uses `treg login`; hosted deployments require server-side `TREG_TOKEN` (and `TREG_ORG` for a personal token). LinkedIn results persist on this device and can be exported; the Python CLI still gathers Reddit and HN.

## Current demo journey

The UI starts at website onboarding. `/api/company` reads the homepage and a same-site employer page when available, builds a buyer-oriented company brain and LinkedIn search queries. `/api/linkedin` accepts that validated company context, searches up to two queries and scores up to twenty posts. It does not substitute an older profile.

Opening the source or author profile is manual and uses a new tab. The user confirms connection status; the app neither sends a connection request nor checks whether LinkedIn accepted it. Prospects, connection confirmations, drafts and notes are stored in `signal-hunter.session.v2` on this device. Prospect metadata is separate from the frozen lead contract. See `DEMO.md` for the recording journey.
