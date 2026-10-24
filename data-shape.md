# The lead record

Three people are building against each other for three hours. This shape is the contract between them: Data
writes it, Brain and scoring fill the scores, Lightfern renders it. Agree it at 12:30 and do not change the
key names after, because a rename at 14:00 costs more than a wrong field name does.

```json
{
  "id": "reddit_1xe2kdq_harddaddy3",
  "source": "reddit",
  "source_url": "https://www.reddit.com/r/recruiting/comments/...",
  "fetched_at": "2026-10-24T12:40:00Z",
  "posted_at": "2026-10-24T09:12:00Z",
  "author_handle": "harddaddy_3",
  "author_profile_url": "https://www.reddit.com/user/harddaddy_3",
  "context": "r/recruiting",
  "title": "My recruiters weren't recruiting. They were chasing.",
  "quote": "chasing is the whole job now, just herding cats who already ghosted you twice",
  "body_excerpt": "first 600 characters, enough for the model to score and for a human to judge",
  "scores": { "intent": 8, "fit": 7, "urgency": 6, "total": 21 },
  "reasoning": "one sentence, in the model's words, naming what in the post earned the intent score",
  "disqualified": false,
  "disqualified_reason": "",
  "draft_reply": "the reply, quoting their own words",
  "claim": { "claimed_by": "", "status": "new", "notes": "" }
}
```

## Field rules

- `id` must be stable across runs, so a re-run updates a lead instead of duplicating it. Source plus post id
  plus author.
- `quote` is the single sentence that qualified them. It is what the board shows and what the draft reply
  quotes back. If there is no quotable sentence, the lead is weak.
- `scores.total` is just the sum. Keep the three parts separate so the board can sort on intent alone.
- `status` is one of `new`, `claimed`, `contacted`, `replied`, `dead`. Nothing else.
- `disqualified` is set by the brain, not dropped silently, so the demo can show what was filtered and why.
  Filtering out loud is a feature. See `decisions.md`.

## Why no email or phone field

Out of scope per the brief. Reddit and Hacker News handles are pseudonymous, so there is nobody to enrich. The
reply goes where the post is.
