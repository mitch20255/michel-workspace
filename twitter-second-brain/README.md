# 🧠 Twitter → Second Brain (+ AI)

Turn an X (Twitter) profile into a clean **Markdown / Obsidian second brain** —
every tweet, thread, PDF, guide and linked resource — then **ask it questions in
natural language**, answered by Claude with citations back to the source notes.

Two ways to get the data in, one AI to query it:

```
   ┌─ Official X archive (your own account) ─┐
   │                                          │→  build_brain.py  →  Obsidian vault  →  ask_brain.py  →  🧠 Claude Q&A
   └─ Scrape a profile (your own account) ───┘        │                  │                   │
                                              neutral JSON schema    notes/ + resources/   BM25 retrieval (local)
```

---

## Getting the data in — pick your path

### Path A — Official archive (simplest, safest, your own profile)

The archive X gives you of **your own account's** data. Fully within X's ToS,
100% complete, never breaks.

1. On X: **Settings → Your account → Download an archive of your data**
2. Wait for the email link (a few hours to ~24h), download the `.zip`.
3. Build:
   ```bash
   python build_brain.py --archive ~/Downloads/twitter-archive.zip --out ./vault
   ```

### Path B — Scrape a profile with your own account

For a profile the archive can't give you. This logs into X with **your own
account** (via [`twscrape`](https://github.com/vladkens/twscrape)) and pulls a
profile's tweets.

> ### ⚠️ Read this first
> Automated scraping with account credentials is **against X's Terms of
> Service** and can get the account **rate-limited or suspended**. Mitigations:
> - Use a **secondary, dedicated account** — never your main one.
> - Keep volumes modest; add delays; don't hammer it.
> - Credentials live in `.env` (gitignored), never in code or output.
>
> You accept this risk. The tool doesn't hide it.

```bash
pip install twscrape python-dotenv
cp .env.example .env        # fill in your SECONDARY account details

python collectors/collect_twscrape.py --target somehandle --limit 2000 \
    --out ./data/somehandle.json

python build_brain.py --json ./data/somehandle.json --out ./vault
```

The collector writes a **neutral JSON schema** (`collectors/SCHEMA.md`), so the
source is fully decoupled: an official-API collector, an Apify export, or a
manual dump that conforms to that schema feeds the exact same builder.

---

## Build options (`build_brain.py`)

| Flag | Effect |
|---|---|
| `--archive PATH` | Official X archive `.zip` or unzipped directory |
| `--json PATH` | Neutral-schema JSON from a collector (mutually exclusive with `--archive`) |
| `--out DIR` | Output vault directory |
| `--download-resources` | Fetch external PDFs/guides/files that were linked (needs `requests`) |
| `--include-retweets` | Also make notes for pure retweets (off by default) |

---

## Ask your brain (`ask_brain.py`)

Natural-language Q&A over the vault. **Retrieval is 100% local** — a pure-Python
BM25 index over your notes, no embeddings, no extra services, works offline. The
**answer** is written by **Claude** (`claude-opus-5`) from the retrieved notes,
with `[note-id]` citations so every claim is verifiable.

```bash
pip install anthropic python-dotenv
# put ANTHROPIC_API_KEY in .env, or run `ant auth login`

# One-off question
python ask_brain.py --vault ./vault -q "What's their advice on pricing?"

# Interactive chat
python ask_brain.py --vault ./vault

# Retrieval only, no AI (no API key needed) — great for a quick sanity check
python ask_brain.py --vault ./vault -q "cold outbound" --no-ai
```

| Flag | Effect |
|---|---|
| `--vault DIR` | The vault built by `build_brain.py` |
| `-q, --question` | Ask once and exit (omit for interactive chat) |
| `--k N` | How many notes to retrieve as context (default 6) |
| `--no-ai` | Show retrieved notes only; skip the Claude answer |

**Why BM25 and not embeddings?** You chose the lightest path: zero heavy
dependencies, nothing to index-build or host, fully offline retrieval. It's
excellent for keyword-and-topic questions over a personal corpus. If you later
want fuzzy/semantic matching ("things *like* X" even without shared words), the
retriever is a clean seam to swap for embeddings — ask and I'll add it.

---

## What you get

```
vault/
├── Home.md                 # Dashboard: counts, top notes, navigation
├── _index_by_date.md       # Every note, grouped by month
├── _index_by_topic.md      # Every note, grouped by #hashtag
├── _index_resources.md     # Every PDF / guide / external link
├── notes/                  # One note per tweet OR per thread
├── attachments/            # Images & videos (from the official archive)
└── resources/              # Downloaded PDFs / guides (with --download-resources)
```

Each note carries YAML frontmatter (date, id, likes, tags, canonical X URL),
rebuilt threads (`1/n`), expanded `t.co` links, embedded media, and `#hashtags`
as Obsidian tags. `ask_brain.py` reads that frontmatter for its citations.

---

## Files

| File | Role |
|---|---|
| `build_brain.py` | Archive/JSON → Obsidian vault |
| `ask_brain.py` | BM25 retrieval + Claude Q&A over the vault |
| `collectors/collect_twscrape.py` | Scrape a profile with your own account → neutral JSON |
| `collectors/SCHEMA.md` | The neutral ingestion schema (source-agnostic) |
| `.env.example` | Template for X credentials + `ANTHROPIC_API_KEY` |
| `requirements.txt` | All-optional deps, documented per feature |

---

## Security & privacy notes

- **`.env`, `accounts.db`, `data/`, and `vault/` are gitignored** — credentials,
  session tokens, scraped data and the brain never get committed.
- The core build and BM25 retrieval are **offline**. Network is touched only by:
  `--download-resources` (fetches URLs you archived), the collector (talks to X
  via your account), and `ask_brain.py` (sends retrieved notes to the Anthropic
  API to compose an answer).

## Extending it

Ask and I'll add any: semantic/embeddings retrieval, per-thread AI summaries,
an official-X-API collector, likes/bookmarks as a separate "inbox", or a small
web UI over `ask_brain.py`.
