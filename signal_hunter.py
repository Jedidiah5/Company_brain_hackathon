"""Signal Hunter: find people publicly describing the problem a company solves.

Pipeline: brain -> queries -> fetch (Reddit + Hacker News) -> score -> leads.json
Records follow data-shape.md. Standard library only, so it runs with no install.

    python3 signal_hunter.py brain  --company "https://jumpstart-uk.com"
    python3 signal_hunter.py run    --company "https://jumpstart-uk.com" --out leads.json
    python3 signal_hunter.py run    --company "we place sales talent into UK startups" --limit 40
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SignalHunter/0.1"
BRAIN_MODEL = "gpt-5-mini"
SCORE_MODEL = "gpt-5-mini"


def load_env():
    """Read .env beside this file so nobody has to export anything."""
    path = HERE / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("No OPENAI_API_KEY. Put it in .env beside this script.")
    return key


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def get_json(url, headers=None, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def openai_json(api_key, model, system, user, retries=2):
    """One chat completion that must come back as a JSON object."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
    )
    last = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read().decode())
            return json.loads(data["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            last = f"HTTP {e.code}: {detail}"
            if e.code in (429, 500, 502, 503) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            break
        except Exception as e:  # noqa: BLE001 - a hackathon wants the message, not the class
            last = str(e)
            if attempt < retries:
                time.sleep(2)
                continue
    sys.exit(f"OpenAI call failed. {last}")


# --------------------------------------------------------------------------- brain

def fetch_site_text(url, limit=6000):
    """Readable text from the company's own page, so the brain reads rather than guesses."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25) as r:
            html = r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"  could not read {url} ({e}); using the URL alone", file=sys.stderr)
        return ""
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;?", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()[:limit]


def run_cmd(args, timeout=25):
    """Run a command and return stdout, or None if it is unavailable or fails."""
    import subprocess
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return out.stdout if out.returncode == 0 else None
    except Exception:  # noqa: BLE001
        return None


REPO_DOC_NAMES = (
    "README.md", "readme.md", "README", "CANON.md", "CLAUDE.md", "AGENTS.md",
    "PRODUCT.md", "docs/README.md", "docs/product.md", "STATUS.md",
)


def read_local_repo(path, limit=12000):
    """Product prose from a repo on disk: the docs first, then package metadata."""
    root = Path(path).expanduser().resolve()
    parts = []
    for name in REPO_DOC_NAMES:
        f = root / name
        if f.is_file():
            parts.append(f"--- {name}\n{f.read_text(errors='replace')[:6000]}")
    for name in ("package.json", "pyproject.toml"):
        f = root / name
        if f.is_file():
            parts.append(f"--- {name}\n{f.read_text(errors='replace')[:1200]}")
    if not parts:
        mds = sorted(root.glob("*.md"))[:3] + sorted(root.glob("docs/*.md"))[:3]
        for f in mds:
            parts.append(f"--- {f.relative_to(root)}\n{f.read_text(errors='replace')[:4000]}")
    if not parts:
        print(f"  {root} has no readable docs; using the path alone", file=sys.stderr)
    return "\n\n".join(parts)[:limit]


def read_github_repo(slug, limit=12000):
    """Product prose from a GitHub repo. Uses the gh CLI when present, so private repos work."""
    slug = slug.strip("/")
    m = re.search(r"github\.com[/:]([^/]+/[^/#?]+)", slug)
    if m:
        slug = m.group(1)
    slug = re.sub(r"\.git$", "", slug)
    parts = []

    meta_raw = run_cmd(["gh", "api", f"repos/{slug}"])
    if meta_raw:
        try:
            meta = json.loads(meta_raw)
            parts.append(
                "--- repo\n"
                f"name: {meta.get('full_name','')}\n"
                f"description: {meta.get('description') or ''}\n"
                f"homepage: {meta.get('homepage') or ''}\n"
                f"topics: {', '.join(meta.get('topics') or [])}\n"
                f"language: {meta.get('language') or ''}"
            )
        except Exception:  # noqa: BLE001
            pass

    import base64

    readme_raw = run_cmd(["gh", "api", f"repos/{slug}/readme", "--jq", ".content"])
    if readme_raw and readme_raw.strip():
        try:
            text = base64.b64decode(readme_raw.strip()).decode("utf-8", "replace")
            parts.append("--- README\n" + text[:8000])
        except Exception:  # noqa: BLE001
            pass

    # A README is not the only place product prose lives. Pull the other usual
    # suspects from the repo root, which is how a workspace repo describes itself.
    listing = run_cmd(["gh", "api", f"repos/{slug}/contents", "--jq", ".[].name"])
    if listing:
        present = {n.strip() for n in listing.splitlines() if n.strip()}
        extras = [n for n in ("CANON.md", "CLAUDE.md", "PRODUCT.md", "STATUS.md", "AGENTS.md")
                  if n in present]
        for name in extras[:3]:
            raw = run_cmd(["gh", "api", f"repos/{slug}/contents/{name}", "--jq", ".content"])
            if not raw or not raw.strip():
                continue
            try:
                text = base64.b64decode(raw.strip()).decode("utf-8", "replace")
                parts.append(f"--- {name}\n" + text[:5000])
            except Exception:  # noqa: BLE001
                continue

    if not parts:  # no gh, or not authorised: try the public raw files
        for branch in ("main", "master"):
            for name in ("README.md", "readme.md"):
                try:
                    url = f"https://raw.githubusercontent.com/{slug}/{branch}/{name}"
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=20) as r:
                        parts.append("--- README\n" + r.read().decode("utf-8", "replace")[:8000])
                    break
                except Exception:  # noqa: BLE001
                    continue
            if parts:
                break

    if not parts:
        print(f"  could not read github repo {slug}; using the name alone", file=sys.stderr)
    return "\n\n".join(parts)[:limit]


def read_company_source(company):
    """Work out what the user handed us and return (kind, text).

    A local directory, a GitHub repo, a website, or a plain description.
    """
    candidate = Path(company).expanduser()
    if candidate.is_dir():
        return "local repo", read_local_repo(candidate)
    if re.search(r"(^|//)github\.com[/:]", company) or re.fullmatch(r"[\w.-]+/[\w.-]+", company.strip()):
        return "github repo", read_github_repo(company)
    if company.startswith("http://") or company.startswith("https://"):
        return "website", fetch_site_text(company)
    return "description", ""


BRAIN_SYSTEM = """You profile a company so a sales team can find people who already have the problem it solves.
Answer only as JSON with these keys:
  sells            one sentence on what the company sells
  icp              one sentence on who buys it
  pains            3 to 5 short phrases, each a problem the buyer feels, in the buyer's own vocabulary and not marketing language
  tone             one sentence on how this company writes
  disqualify       3 to 5 short rules naming who to drop even when they discuss the pain
Disqualify rules matter. People posting about a problem are often vendors selling the same solution, candidates
rather than buyers, or outside the market. Name those explicitly."""


def build_brain(api_key, company):
    kind, text = read_company_source(company)
    print(f"  source: {kind}" + (f", {len(text)} characters" if text else ", nothing readable"))
    if text:
        user = f"Source ({kind}): {company}\n\nWhat it says:\n{text}"
    else:
        user = (
            f"Company description: {company}\n\n"
            "Nothing readable was fetched, so profile it from this line alone and keep the guesses modest."
        )
    profile = openai_json(api_key, BRAIN_MODEL, BRAIN_SYSTEM, user)
    profile["_source_kind"] = kind
    return profile


QUERY_SYSTEM = """Turn a buyer's pain points into search queries for Reddit and Hacker News.
Answer only as JSON: {"queries": ["...", "..."]}
Rules:
  Write how a frustrated buyer writes, not how a vendor writes. "spending my whole day chasing candidates", not
  "talent acquisition inefficiency".
  2 to 5 words each. Long phrases match nothing.
  No brand names, no hashtags, no boolean operators.
  8 queries."""


def build_queries(api_key, profile):
    user = json.dumps({"pains": profile.get("pains", []), "icp": profile.get("icp", "")})
    out = openai_json(api_key, BRAIN_MODEL, QUERY_SYSTEM, user)
    return [q for q in out.get("queries", []) if isinstance(q, str) and q.strip()][:8]


# --------------------------------------------------------------------------- fetch

def fetch_reddit(query, limit=15):
    url = "https://www.reddit.com/search.json?" + urllib.parse.urlencode(
        {"q": query, "sort": "new", "t": "month", "limit": limit, "type": "link"}
    )
    try:
        data = get_json(url)
    except Exception as e:  # noqa: BLE001
        print(f"  reddit '{query}' failed: {e}", file=sys.stderr)
        return []
    posts = []
    for child in data.get("data", {}).get("children", []):
        d = child.get("data", {})
        if d.get("over_18"):
            continue
        body = (d.get("selftext") or "").strip()
        posts.append(
            {
                "source": "reddit",
                "source_url": "https://www.reddit.com" + d.get("permalink", ""),
                "posted_at": datetime.fromtimestamp(
                    d.get("created_utc", 0), timezone.utc
                ).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "author_handle": d.get("author", ""),
                "author_profile_url": f"https://www.reddit.com/user/{d.get('author','')}",
                "context": "r/" + d.get("subreddit", ""),
                "title": d.get("title", ""),
                "body_excerpt": body[:600],
                "engagement": {"score": d.get("score", 0), "comments": d.get("num_comments", 0)},
                "query": query,
            }
        )
    return posts


def fetch_hn(query, limit=15):
    url = "https://hn.algolia.com/api/v1/search_by_date?" + urllib.parse.urlencode(
        {"query": query, "tags": "(story,comment)", "hitsPerPage": limit}
    )
    try:
        data = get_json(url)
    except Exception as e:  # noqa: BLE001
        print(f"  hn '{query}' failed: {e}", file=sys.stderr)
        return []
    posts = []
    for h in data.get("hits", []):
        text = (h.get("comment_text") or h.get("story_text") or "").strip()
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        title = h.get("title") or h.get("story_title") or ""
        if not text and not title:
            continue
        posts.append(
            {
                "source": "hackernews",
                "source_url": f"https://news.ycombinator.com/item?id={h.get('objectID')}",
                "posted_at": h.get("created_at", ""),
                "author_handle": h.get("author", ""),
                "author_profile_url": f"https://news.ycombinator.com/user?id={h.get('author','')}",
                "context": "Hacker News",
                "title": title,
                "body_excerpt": text[:600],
                "engagement": {"score": h.get("points") or 0, "comments": h.get("num_comments") or 0},
                "query": query,
            }
        )
    return posts


def lead_id(post):
    raw = f"{post['source']}|{post['source_url']}|{post['author_handle']}"
    return post["source"] + "_" + hashlib.sha1(raw.encode()).hexdigest()[:12]


def gather(queries, per_query=15):
    seen, posts = set(), []
    for q in queries:
        print(f"  searching: {q}")
        for post in fetch_reddit(q, per_query) + fetch_hn(q, per_query):
            pid = lead_id(post)
            if pid in seen:
                continue
            seen.add(pid)
            post["id"] = pid
            post["fetched_at"] = now_iso()
            posts.append(post)
        time.sleep(1.0)  # be a good citizen on free endpoints
    return posts


# --------------------------------------------------------------------------- score

SCORE_SYSTEM = """You score public posts as sales signals for one company, and draft a reply to the good ones.

For each post return an object with:
  id                    copy it back unchanged
  intent                0-10, how strongly this person signals they want a solution NOW. A direct request or a
                        description of current pain scores high. General discussion scores low.
  fit                   0-10, how well the author matches the ideal customer
  urgency               0-10, how time-sensitive this is
  reasoning             one sentence naming what in the post earned the intent score
  quote                 the single sentence from the post that best shows the pain, copied exactly. Empty if
                        there is no such sentence.
  disqualified          true if a disqualify rule applies
  disqualified_reason   which rule, in a few words. Empty when false.
  draft_reply           when not disqualified and intent >= 6: a reply of 60 to 90 words that quotes their own
                        words back, says what the company does about it, and asks one question. Match the
                        company's tone. No greeting like "Hope this finds you well", no marketing adjectives,
                        no em dashes. Empty otherwise.

Be hard on intent. Most posts are discussion, not demand. Apply the disqualify rules strictly: a vendor selling
the same solution is not a lead no matter how well they describe the problem.

Answer only as JSON: {"leads": [ ... ]}"""


def score_batch(api_key, profile, batch):
    compact = [
        {
            "id": p["id"],
            "context": p["context"],
            "title": p["title"],
            "text": p["body_excerpt"],
            "author": p["author_handle"],
        }
        for p in batch
    ]
    user = json.dumps(
        {
            "company": {
                "sells": profile.get("sells", ""),
                "icp": profile.get("icp", ""),
                "tone": profile.get("tone", ""),
                "disqualify": profile.get("disqualify", []),
            },
            "posts": compact,
        }
    )
    out = openai_json(api_key, SCORE_MODEL, SCORE_SYSTEM, user)
    return {item.get("id"): item for item in out.get("leads", []) if item.get("id")}


def score_all(api_key, profile, posts, batch_size=10):
    scored = {}
    for i in range(0, len(posts), batch_size):
        batch = posts[i : i + batch_size]
        print(f"  scoring {i + 1} to {i + len(batch)} of {len(posts)}")
        scored.update(score_batch(api_key, profile, batch))

    leads = []
    for p in posts:
        s = scored.get(p["id"])
        if not s:
            continue
        intent = int(s.get("intent") or 0)
        fit = int(s.get("fit") or 0)
        urgency = int(s.get("urgency") or 0)
        leads.append(
            {
                **p,
                "quote": (s.get("quote") or "").strip(),
                "scores": {"intent": intent, "fit": fit, "urgency": urgency,
                           "total": intent + fit + urgency},
                "reasoning": (s.get("reasoning") or "").strip(),
                "disqualified": bool(s.get("disqualified")),
                "disqualified_reason": (s.get("disqualified_reason") or "").strip(),
                "draft_reply": (s.get("draft_reply") or "").strip(),
                "claim": {"claimed_by": "", "status": "new", "notes": ""},
            }
        )
    leads.sort(key=lambda l: (not l["disqualified"], l["scores"]["total"]), reverse=True)
    return leads


# --------------------------------------------------------------------------- cli

def cmd_brain(args):
    api_key = load_env()
    profile = build_brain(api_key, args.company)
    print(json.dumps(profile, indent=2))


def cmd_run(args):
    api_key = load_env()
    print("brain: reading the company")
    profile = build_brain(api_key, args.company)
    print(f"  sells: {profile.get('sells','')}")
    print(f"  buyer: {profile.get('icp','')}")
    for pain in profile.get("pains", []):
        print(f"  pain: {pain}")

    print("queries:")
    queries = build_queries(api_key, profile)
    if not queries:
        sys.exit("The brain produced no queries. Check the company input.")

    print("fetch:")
    posts = gather(queries, per_query=args.per_query)
    print(f"  {len(posts)} unique posts")
    if not posts:
        sys.exit("Nothing came back. Reddit may be rate limiting; try again or lower --per-query.")
    posts = posts[: args.limit]

    print("score:")
    leads = score_all(api_key, profile, posts)

    kept = [l for l in leads if not l["disqualified"]]
    dropped = [l for l in leads if l["disqualified"]]
    out = {
        "generated_at": now_iso(),
        "company_input": args.company,
        "profile": profile,
        "queries": queries,
        "counts": {"fetched": len(posts), "kept": len(kept), "dropped": len(dropped)},
        "leads": leads,
    }
    path = Path(args.out)
    path.write_text(json.dumps(out, indent=2))

    print(f"\n{len(posts)} swept, {len(kept)} kept, {len(dropped)} dropped -> {path}")
    print("\nTop leads:")
    for l in kept[:8]:
        print(f"  {l['scores']['total']:>2}  [{l['scores']['intent']}i {l['scores']['fit']}f] "
              f"{l['context']:<20} {l['title'][:60]}")
        if l["quote"]:
            print(f"      \"{l['quote'][:100]}\"")
    if dropped:
        print("\nDropped, with reasons:")
        for l in dropped[:6]:
            print(f"  {l['context']:<20} {l['disqualified_reason'][:60]}")


def main():
    ap = argparse.ArgumentParser(description="Find people describing the problem your company solves.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("brain", help="profile the company and stop")
    b.add_argument("--company", required=True, help="a URL, or a one-line description")
    b.set_defaults(func=cmd_brain)

    r = sub.add_parser("run", help="the whole loop, writing leads.json")
    r.add_argument("--company", required=True, help="a URL, or a one-line description")
    r.add_argument("--out", default="leads.json")
    r.add_argument("--limit", type=int, default=60, help="maximum posts to score")
    r.add_argument("--per-query", type=int, default=15, help="results per query per source")
    r.set_defaults(func=cmd_run)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
