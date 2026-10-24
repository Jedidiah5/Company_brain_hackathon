# Signal Hunter

Lightfern hackathon, 24 October 2026. Track: Sales & GTM, sponsored by Jumpstart.
Brief by Enesi is in `brief/`. This folder is the working copy of what we agreed and what is left to decide.

**One line.** Stop guessing who is ready to buy. Find the people already asking for you.

**The loop.** Brain reads a company and learns its pain points, ideal customer and tone. Find turns those into
searches and pulls posts from Reddit and Hacker News. Score rates intent, fit and urgency out of 10 and ranks
them. Act drafts a reply that quotes what the person actually wrote. A human reviews and sends. Leads land on a
shared Lightfern board so nobody messages the same person twice.

**Demo company is Jumpstart**, not us. We run the tool with Jumpstart as the company and show real posts from
founders struggling to hire sales people, so the judges watch their own pipeline appear.

## Hard times

| Time | What |
|---|---|
| 12:30 | Roles split, everyone building |
| 13:30 | Pieces join up, loop runs end to end |
| 15:00 | Build stops, no exceptions |
| 15:30 | Loom recorded, 3 minutes maximum |
| 15:45 | Submitted on the portal |

## Out of scope today

Auto-sending anything, scraping LinkedIn, finding personal email addresses. These are roadmap lines in the
Loom, not work.

## Files

- `data-shape.md` — the one lead record all three workstreams read and write. Agree this before building.
- `roles.md` — who owns what, and the seams between them.
- `decisions.md` — what is still open, including where an earlier prototype conflicts with this brief.
- `loom-script.md` — the three minute structure with timings.
- `prototype-notes.md` — what already exists and what of it survives the brief.

## Interactive product

The UI now uses **Next.js, TypeScript and Three.js**. The discovery/scoring pipeline stays Python standard library only.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The UI reads the existing root `leads.json`; when that file is absent, it shows a clearly labeled synthetic sample workspace. Refresh signals reloads the dataset. Generate fresh real leads separately with the Python CLI.

Search and filter signals, inspect evidence and all three scores, edit and copy eligible drafts, claim leads, change status, add notes and export your workspace. Claims and edits persist on this device only. The Three.js field visualizes actual lead classifications and opens a lead when its node is clicked.

Run `npm test` and `npm run build` before merging. Node.js 22.18+ or 24 is recommended. See [TEAM-TASKS.md](TEAM-TASKS.md) for ownership, setup and remaining pipeline work.

Shared cross-browser ownership is not implemented in this version. The earlier shared-board pitch describes the intended integration, not the current local storage behavior.

## LinkedIn search

The inbox now has a **Search LinkedIn** form. It searches public posts from the last month through treg, scores up to ten against the company profile using `gpt-5-mini`, and adds validated results to the queue. It verifies exact quote evidence, score ranges and draft eligibility. Existing rows and claims survive repeat searches; sample rows are removed when real results arrive.

For local use, run `treg login` and set `OPENAI_API_KEY` in `.env`. No provider key is required. The route runs the signed-in treg CLI without exposing credentials. For Vercel, configure a team-scoped `TREG_TOKEN` and `OPENAI_API_KEY` in server environment settings; a personal treg token also needs `TREG_ORG`. The local CLI login does not transfer to a deployment.

A search is listed at $0.004 through HarvestAPI; the returned actual charge is shown separately from OpenAI scoring. Search failures preserve the current dataset. Results from the UI persist on this device, refresh with the latest file and are included in JSON export. The Python CLI remains the Reddit/HN pipeline.

## Complete demo journey

Start with **Company website → Build my company brain → Find LinkedIn buying signals**. The app reads the submitted website, generates a company-specific profile and searches, and scores posts against that profile. It reviews up to twenty posts from two searches by default; **Refine search** runs one custom query instead.

Open a signal to read its source post, open the author's profile in a new tab, connect manually, then return and confirm the connection status. **Add to my prospects** saves the person with notes and follow-up state. The company workspace, results, drafts and saved prospects survive reload on this device. Connection requests are never sent by the app and connection status is user-confirmed.

See [DEMO.md](DEMO.md) for the exact presentation flow. Fresh browsers start at website onboarding; use **Open the previous run instead** only when presenting a saved run. No synthetic buyer signal is substituted into a live search.
