# Signal Hunter team build plan

Prepared 24 October 2026, around 13:05 London, from `master-prompt.md` and a three-agent review of the existing code. `README.md` and `data-shape.md` remain the contracts. This is a plan; implementation and live acceptance remain to be completed.

## Outcome by 15:00

Demonstrate Jumpstart's company brain, real public buyer signals, strict qualification, a reviewed reply draft, and a usable lead board. Use `https://jumpstart-uk.com`. Preserve every lead key and the intent threshold of 6. Nothing sends automatically.

The pipeline already exists. The critical work is restoring Reddit access and making the board work in a normal browser. Do not rebuild the app from the one-shot prompt.

## Owners and parallel work

Names are pending; assign the four human teammates to these roles.

| Owner | Work | Done when |
|---|---|---|
| Data | Replace unauthenticated Reddit search with client-credentials OAuth, cached token and Bearer search. Skip cleanly when credentials are unavailable. Keep HN, stable IDs and deduplication. | Mocked auth/search checks pass; a bounded live search returns actual posts, or clearly reports the source unavailable. |
| Brain + integration | Keep existing brain and strict scoring. Validate score ranges, totals, quote evidence and draft eligibility; report missing model results rather than silently dropping posts. Own end-to-end run and frozen output. | Every scored input is accounted for; actionable rows have exact source evidence, intent >=6, no disqualification and a draft. Invalid output fails clearly without replacing the good demo file. |
| Board | Remove unconditional `claude.use` dependency; add guarded localStorage, owner input, notes and the five contract statuses. Initialize from `claim`, persist by stable lead ID, sort by intent then total, show urgency, add viewport metadata and remove external fonts. | Local HTTP serving works without platform globals; claim/status/notes survive reload; bad storage does not crash; phone, light and dark layouts work. |
| Pitch + QA | Prepare the three-minute Loom, verify source-backed examples, correct stale docs, record measured counts and run duration. Pair with board owner on shared-store feasibility. | Rehearsed demo uses a frozen real dataset, shows a justified rejection and says a human reviews and sends every message. |

Two owners touch `signal_hunter.py`: Data owns source helpers and gathering; Brain owns scoring/output and CLI integration. Coordinate before editing shared sections. Board owner owns `board.html`; Pitch owns demo/docs. Integration owner is the only writer of the final `leads.json`.

## Schedule, London time

| Deadline | Gate |
|---|---|
| 13:15 | Assign people; privately confirm usable OpenAI and Reddit credentials. Board starts against a schema-valid fixture. Check whether Lightfern has a usable shared store. |
| 13:30 | Reddit source check and standalone board both work independently. Decide shared store or explicitly local demo; do not leave platform discovery open. |
| 14:00 | First integrated Jumpstart run. Inspect actual buyer fit and quote evidence. Pitch owner starts rehearsal. |
| 14:30 | Freeze real demo data and backup with timestamp, counts and duration. Stop adding features. |
| 15:00 | Build stops. Only use the verified frozen demo. |
| 15:30 | Loom recorded, at most three minutes. |
| 15:45 | Submit. |

## Dependencies and scope choices

- Reddit requires usable app credentials supplied privately as `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`. Never copy keys into planning documents or logs. Live Reddit access must be demonstrated rather than assumed.
- A live brain/scoring run requires an OpenAI API key with available credit. The balance has not been verified. Begin with a small run before increasing the scoring limit.
- A localStorage board is the master prompt's baseline, but cannot prevent duplicate outreach across teammates' browsers. Only describe shared ownership as working after two browsers demonstrate one successful owner and a visible conflict for the other. If that integration is unavailable by 13:30, ship the local demo and qualify the pitch.
- Use Python standard library only, `gpt-5-mini`, environment-over-file credentials, no small completion cap, bounded retries and roughly one second between searches.
- No LinkedIn scraping, enrichment, auto-sending, new frameworks or schema changes.

## Acceptance checklist

- [ ] OAuth request, Bearer search, token reuse and missing/rejected credentials covered with standard-library mocks.
- [ ] Duplicate posts have one stable ID; unavailable Reddit does not prevent HN collection.
- [ ] Existing score threshold and disqualification rules remain strict; weak yield triggers source/query review.
- [ ] Scores are valid, totals correct, model omissions visible, quotes checked and ineligible drafts empty.
- [ ] A real buyer signal and a clearly justified rejected record have been manually reviewed. Seek several actionable leads; do not promise a count or invent evidence.
- [ ] Board renders scores, evidence, reasons, drafts, source links and collapsed rejections; claims, notes and statuses persist locally.
- [ ] Shared claims, if included, pass a two-browser conflict check and surface save failures.
- [ ] Correct `jumpstart.me` examples in Python, `jumpstart.com` in Loom, and unauthenticated Reddit instructions in `usage.md`; avoid unmeasured cost claims.
- [ ] Frozen data and backup are available; Loom states the timestamp if using the frozen run.

## If time remains

Balance source/query coverage before truncating to `--limit`, and consider an explicit HN recency window. These follow source access and reliable integration. A short queue of defensible leads is an acceptable result.
