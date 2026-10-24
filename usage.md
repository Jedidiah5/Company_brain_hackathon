# Running it

No install. Python 3 and the key in `.env` beside the script, nothing else.

```bash
cd <this repo>

# profile a company and stop, to check the brain before spending a run
python3 signal_hunter.py brain --company "https://jumpstart-uk.com"

# the whole loop
python3 signal_hunter.py run --company "https://jumpstart-uk.com" --out leads.json

# a company with no readable site, or to test a different angle
python3 signal_hunter.py run --company "we place vetted junior sales talent into UK startups"
```

Useful flags: `--per-query` results per query per source (default 15), `--limit` how many posts get scored
(default 60). Each scored post costs a fraction of a cent, so a run is pennies.

## Use jumpstart-uk.com, not jumpstart.me

`jumpstart.me` serves a JavaScript shell: 58 characters of text, nothing for the brain to read.
`jumpstart-uk.com` serves 27,000 characters of real copy. The brain reads whatever the page actually returns,
so point it at the second one.

## What comes out

`leads.json`:

```
generated_at, company_input, profile, queries,
counts: { fetched, kept, dropped },
leads: [ ... ]   sorted, kept first, then by total score
```

Each lead follows `data-shape.md`. Dropped leads stay in the file with `disqualified_reason` set, because the
demo shows the filter working.

## Pieces, if you only want one

- `build_brain(api_key, company)` — the company profile
- `build_queries(api_key, profile)` — pains into searches
- `fetch_reddit(query, limit)` / `fetch_hn(query, limit)` — the free endpoints, no auth
- `score_all(api_key, profile, posts)` — scores, reasoning, draft replies

Lightfern reads `leads.json`. Start against a static file so the board is finished before the live run is.

## Endpoints

- Reddit: `https://www.reddit.com/search.json` with a real User-Agent. It rate limits an eager loop, which is
  why there is a one second pause between queries.
- Hacker News: `https://hn.algolia.com/api/v1/search_by_date` over stories and comments. No auth, no limit
  worth worrying about.

## The key

Copy `.env.example` to `.env` and put your own key in it. `.gitignore` covers `.env`, and this repo is public,
so never commit a real key and never paste one into an issue, a published page or a Loom. Rotate the shared
hackathon key at platform.openai.com once the event is over.
