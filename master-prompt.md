# Master prompt, for a one-shot build

Paste everything between the lines into ChatGPT. It is written to be answered in a single response with two
complete files. The facts in "What is already known" were learned the hard way this morning; they stop the
model rediscovering them.

---

You are building a working demo for a hackathon. Reply with complete, runnable files and nothing else: no
explanation before the code, no placeholders, no "rest of the logic here". If you must choose between a
feature and something that runs, choose the thing that runs.

## The product

**Signal Hunter.** A company brain that finds people publicly describing the exact problem a company solves,
ranks who is ready to buy, and drafts a reply that answers what they actually wrote.

One line for the pitch: stop guessing who is ready to buy, find the people already asking for you.

The loop, in order:

1. **Brain.** Given a company website, a GitHub repo or a one-line description, work out what it sells, who
   buys it, the pain points the buyer feels in the buyer's own words, the company's tone of voice, and a set of
   rules for who to disqualify.
2. **Find.** Turn those pain points into short search queries and pull matching posts from Reddit and Hacker
   News.
3. **Score.** For each post, rate buying intent, fit with the ideal customer and urgency, each out of 10.
   Capture the single sentence from the post that proves the pain. Give a one-sentence reason.
4. **Act.** For leads that are not disqualified and score 6 or more on intent, draft a reply that quotes the
   person's own words back, says what the company does about it, and asks one question. A human reviews and
   sends. Nothing auto-posts, ever.
5. **Board.** A single HTML page that renders the ranked leads so a team can claim one, mark it contacted and
   leave a note, so nobody messages the same person twice.

## Who it is for, and the demo

The sponsor is **Jumpstart** (jumpstart-uk.com), which places early-career sales, marketing, operations and
chief-of-staff talent into UK startups. The demo runs with Jumpstart as the company, so the judges watch their
own pipeline appear. Judging is half the build (solves a real sales problem, works in the demo, smart use of
tools) and half the sell (knows the audience, shows value, clear and confident).

## What is already known, so do not rediscover it

These were established by testing this morning. Treat them as facts, not suggestions.

- **Reddit refuses unauthenticated search.** `www.reddit.com/search.json`, `old.reddit.com/search.json` and
  `api.reddit.com/search` all return HTTP 403, and following the redirect lands on a login page. Changing the
  User-Agent does not help. You must use OAuth: POST to `https://www.reddit.com/api/v1/access_token` with
  HTTP basic auth of client id and secret and body `grant_type=client_credentials`, then query
  `https://oauth.reddit.com/search` with `Authorization: bearer <token>` and a descriptive User-Agent. Read
  `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` from the environment, and when they are absent skip Reddit with
  a clear message rather than crashing.
- **Hacker News works with no auth** through Algolia: `https://hn.algolia.com/api/v1/search_by_date?query=…&tags=(story,comment)`.
  Use `search_by_date`, because plain `search` returns results from years ago.
- **Hacker News is a poor fit for a UK commercial ICP.** Of 200 companies in the October 2026 "Who is hiring?"
  thread, one mentioned the UK and a commercial role. It skews US and engineering. Include it, do not rely on
  it.
- **Searching for your own problem surfaces your competitors.** On one LinkedIn search, six of nine results were
  vendors selling the same solution. Disqualify rules are therefore not optional: drop vendors and consultants
  selling the same thing, drop job seekers and candidates who feel the pain but hold no budget, and drop anyone
  outside the target geography or company size.
- **Keep disqualified leads in the output** with the reason, and show them in the UI. Demonstrating the filter
  is more persuasive than hiding it.
- **Point the brain at `jumpstart-uk.com`, never `jumpstart.me`.** The `.me` domain serves a JavaScript shell
  with 58 characters of text, and the brain will correctly reply that it cannot see anything. The `-uk.com`
  domain serves about 27,000 characters of real copy.
- **A GitHub repo often keeps its product prose outside the README.** Read the README and also CANON.md,
  CLAUDE.md, PRODUCT.md and STATUS.md from the repo root. On one repo this took the readable source from 222
  characters to 12,000 and turned a useless profile into an accurate one.
- **The gpt-5 family are reasoning models.** They spend the token budget thinking before answering, so a small
  `max_completion_tokens` returns empty content while still charging for the tokens. Either leave it unset or
  set it in the hundreds.
- **Reddit and Hacker News handles are pseudonymous**, so there is nobody to enrich. Do not add email or phone
  lookup. The reply goes where the post is.
- **Be hard on intent.** Most posts are discussion, not demand. A long list of weak leads is worse than a short
  list of real ones. In one run only 1 of 32 kept leads scored 6 or more, and that was the source's fault, not
  the scorer's; do not loosen the scoring to make the list look fuller.

## Constraints

- **Python 3, standard library only.** No pip installs, no OpenAI SDK, no requests. Call the API over
  `urllib.request`. It must run on a teammate's laptop with nothing set up.
- Read `OPENAI_API_KEY` from the environment, falling back to a `.env` file beside the script. An exported
  variable wins over the file.
- Use `gpt-5-mini` for both the brain and the scoring. One call for the brain, one for the queries, and batch
  the posts about ten at a time for scoring.
- Ask the API for JSON with `response_format: {"type": "json_object"}`.
- Retry twice on 429 and 5xx with a short backoff, and never loop beyond that.
- Pause about a second between searches, so free endpoints are not hammered.
- Never print or commit a key.

## The lead record

Every part of the system reads and writes this shape. Do not rename the keys.

```json
{
  "id": "reddit_a1b2c3d4e5f6",
  "source": "reddit",
  "source_url": "https://www.reddit.com/r/startups/comments/...",
  "fetched_at": "2026-10-24T12:40:00Z",
  "posted_at": "2026-10-24T09:12:00Z",
  "author_handle": "someuser",
  "author_profile_url": "https://www.reddit.com/user/someuser",
  "context": "r/startups",
  "title": "...",
  "quote": "the one sentence that proves the pain, copied exactly",
  "body_excerpt": "first 600 characters",
  "scores": { "intent": 8, "fit": 7, "urgency": 6, "total": 21 },
  "reasoning": "one sentence naming what earned the intent score",
  "disqualified": false,
  "disqualified_reason": "",
  "draft_reply": "quotes their words, says what the company does, asks one question",
  "claim": { "claimed_by": "", "status": "new", "notes": "" }
}
```

`id` must be stable across runs so a re-run updates a lead instead of duplicating it. `status` is one of
`new`, `claimed`, `contacted`, `replied`, `dead`.

The output file wraps the leads:

```json
{ "generated_at": "...", "company_input": "...", "profile": {...}, "queries": [...],
  "counts": { "fetched": 0, "kept": 0, "dropped": 0 }, "leads": [...] }
```

## Deliver exactly two files

**1. `signal_hunter.py`** with a small CLI:

```
python3 signal_hunter.py brain --company "https://jumpstart-uk.com"
python3 signal_hunter.py run   --company "https://jumpstart-uk.com" --out leads.json
```

`run` prints progress as it goes (which query, how many posts, which batch is being scored) and ends with the
counts and the top leads, so a demo has something to show in the terminal too. Accept `--limit` for how many
posts get scored and `--per-query` for results per query per source.

**2. `board.html`**, a single self-contained page that `fetch`es `leads.json` from beside itself and renders:

- a figure row of swept, kept, dropped, and how many scored 6 or more on intent
- a side panel showing what the brain decided: what the company sells, who buys, the pain it looked for, the
  searches it wrote and who it drops
- the ranked queue, each lead showing its scores, the quote, the reason, the drafted reply, a link to the post,
  and Claim and Mark contacted buttons
- the disqualified leads in a collapsed list with their reasons

It must work opened over `python3 -m http.server`, be readable in both light and dark colour schemes, and work
at phone width. Keep claim state in `localStorage`, wrapped in try/catch. No frameworks and no CDN
dependencies; inline the CSS and JavaScript.

## Out of scope

Auto-sending any message, scraping LinkedIn, and finding personal email addresses. Do not add them.

Reply with the two files, complete and runnable.
