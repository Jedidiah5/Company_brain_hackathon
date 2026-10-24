# Team handoff

The UI is Next.js + TypeScript + Three.js. The Python pipeline remains standard-library only. `data-shape.md` is still the lead contract.

## Start together

Use Node.js 22.18+ (or 24) and Python 3. Clone the repository, run `npm ci`, then `npm run dev` and open http://127.0.0.1:3000. Without `leads.json`, the UI opens an explicitly labeled sample workspace. Sample conversations are synthetic and must not be pitched as real prospects.

Copy `.env.example` to `.env` and fill in credentials privately. Never commit `.env` or prefix keys with `NEXT_PUBLIC_`. The browser reads lead data through `/api/leads`, which only serves `leads.json` or the example fixture, never environment variables.

## You: integration and final demo

- Own final `leads.json`; run `python3 signal_hunter.py run --company "https://jumpstart-uk.com" --out leads.json` after source fixes land.
- Review the actual buyer's role, UK fit, quote and intent. Freeze the real dataset by 14:30 London.
- Merge teammates' branches, run `npm test` and `npm run build`, and rehearse from the frozen file.
- The UI refresh button reloads the latest file. It does not start or pay for a new pipeline run.

## Teammate 1: Reddit and data

Own source helpers in `signal_hunter.py`.

- The existing Reddit helper still uses the blocked unauthenticated search. Implement client-credentials OAuth using `urllib`, token caching, and Bearer search against `oauth.reddit.com`.
- Get usable Reddit app credentials privately, skip the source clearly when unavailable, preserve stable IDs and deduplication.
- Keep HN as a secondary source. Prove Reddit returns actual relevant posts before a full scoring run.
- Correct the stale unauthenticated Reddit instructions in `usage.md`.

## Teammate 2: scoring and reliability

Own scoring/output helpers in `signal_hunter.py`; coordinate shared-file edits with Teammate 1.

- Preserve `gpt-5-mini`, strict intent, the >=6 reply threshold, disqualification and exact lead keys.
- Validate score bounds, totals, source-backed exact quotes, and draft eligibility.
- Surface missing model results rather than silently dropping inputs. Write output safely so a failed run cannot destroy the known good dataset.
- Use standard-library mocks for failure handling. Do not spend on repeated large runs to test plumbing.

## Teammate 3: product QA and pitch

Own demo/docs and UI feedback.

- Check search, source filter, all four inbox tabs, three sorts, lead panel, editable drafts, copy, claims, all five statuses, notes, refresh and JSON export.
- Set your name, claim a row, reload, and verify owner/notes/status persist. Test phone width and keyboard dialog navigation.
- Claims and drafts are device-local; shared locking is not implemented. Do not claim team synchronization in the Loom. If Lightfern is available, treat integration as a time-boxed follow-up with a two-browser claim-conflict test.
- Correct `jumpstart.com` in `loom-script.md` to `jumpstart-uk.com`; rehearse a three-minute recording showing actual evidence and one justified rejection.
- Say: “A human reviews and sends every message.” Build stops 15:00, record by 15:30, submit 15:45 London.

## UI implementation notes

- App: `components/hunter.tsx`, `app/globals.css`.
- Three.js map: `components/signal-map.tsx`; click a node to inspect its lead. Actionable leads use the inner ring, filtered leads the outer ring. The queue remains usable without WebGL.
- Claims use `claim: { claimed_by, status, notes }` and stable IDs in localStorage. Source records are not overwritten; export includes your local changes.
- Leads remain local and gitignored. Teammates need to generate or privately transfer a real dataset. The checked-in fixture is illustrative only.
- Running the UI requires no OpenAI calls. There is no auto-send endpoint and no browser API key.
