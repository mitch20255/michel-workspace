# 🧠 Twitter → Second Brain

Turn a full X (Twitter) profile into a clean **Markdown / Obsidian second brain** —
every tweet, thread, PDF, guide and linked resource, organized and searchable.

This uses the **official X data archive** (the export X gives you of your own /
your account's data). It's the legal, complete and robust path: no scraping, no
rate limits, no risk of a banned session, and you get *everything* — including
tweets that scrapers miss.

---

## Why the archive (not scraping)?

You picked the **semi-manual / export** method. Here's what that buys you:

| | Official archive (this tool) | Unofficial scraping |
|---|---|---|
| Legality | ✅ Within X's ToS | ❌ Against ToS |
| Completeness | ✅ 100% of the account's tweets | ⚠️ Partial, capped |
| Reliability | ✅ Never breaks | ❌ Breaks when X changes |
| Media/links | ✅ Included in the export | ⚠️ Must re-fetch each one |
| Setup | Download one `.zip` | Accounts, tokens, proxies |

> **Note on "a channel you don't own":** the official archive covers the account
> **you can log into**. To archive *your own* profile fully, use this. To capture
> someone else's public profile, X's archive won't help — that requires the paid
> official API or an unofficial scraper (a different, more fragile path). Tell me
> if that's your case and I'll wire up an API-based collector instead.

---

## Step 1 — Download the X archive

1. On X: **Settings → Your account → Download an archive of your data**
2. Confirm your password, request the archive.
3. X emails you a download link (can take a few hours to ~24h).
4. Download the `.zip` (it contains a `data/` folder with `tweets.js`,
   `account.js`, `tweets_media/`, etc.).

You do **not** need to unzip it — the tool reads the `.zip` directly.

## Step 2 — Build the vault

```bash
# Core build (offline, stdlib only) — copies local media, expands links
python build_brain.py --archive ~/Downloads/twitter-archive.zip --out ./vault

# Also download externally-linked PDFs / guides / files
pip install requests
python build_brain.py --archive ~/Downloads/twitter-archive.zip --out ./vault --download-resources
```

Options:

| Flag | Effect |
|---|---|
| `--archive` | Path to the `.zip` **or** the unzipped archive directory |
| `--out` | Output vault directory |
| `--download-resources` | Fetch external PDFs/guides/files you linked (needs `requests`) |
| `--include-retweets` | Also make notes for pure retweets (off by default) |

## Step 3 — Open in Obsidian

Open the `--out` folder as an Obsidian vault and start at **`Home.md`**.

---

## What you get

```
vault/
├── Home.md                 # Dashboard: counts, top notes, navigation
├── _index_by_date.md       # Every note, grouped by month
├── _index_by_topic.md      # Every note, grouped by #hashtag
├── _index_resources.md     # Every PDF / guide / external link
├── notes/                  # One note per tweet OR per thread
│   └── 2025-08-04-complete-guide-to-ai-agencies-1a2b3c.md
├── attachments/            # Images & videos copied from the archive
└── resources/              # Downloaded PDFs / guides (with --download-resources)
```

Each note has:

- **YAML frontmatter** (date, tweet id, author, likes, retweets, tags, canonical X URL)
  — so Obsidian's Properties, Dataview and search all work.
- **Rebuilt threads** — self-reply chains are stitched into one note, numbered `1/n`.
- **Expanded links** — `t.co` shorteners replaced with the real URLs.
- **Embedded media** — `![[image.jpg]]` for anything in the archive.
- **Resource links** — every guide/PDF/article, also collected in `_index_resources.md`.
- **`#hashtags`** — carried through as Obsidian tags for graph + filtering.

---

## Design notes

- **Offline-first.** The core build touches the network only if you pass
  `--download-resources`, and even then only to fetch the public URLs *you*
  linked in your own tweets.
- **Idempotent-ish.** Re-running overwrites notes; delete the `--out` folder for a
  clean rebuild.
- **Robust to archive variants.** Handles `tweets.js` / `tweet.js`, split parts
  (`tweets-part1.js`), and both `full_text` and legacy `text`.
- **Pure retweets are skipped** by default — a second brain is *your* ideas, not
  reposts. Use `--include-retweets` to keep them.

---

## Extending it

Ideas that slot in cleanly (ask and I'll add any):

- **Semantic search / RAG** — add embeddings over `notes/` so you can ask
  questions in natural language.
- **Likes & bookmarks** — the archive also has `like.js`; treat liked tweets as an
  inbox of external ideas.
- **Auto-summaries** — generate a TL;DR per thread with an LLM.
- **Someone else's public profile** — swap the archive reader for an official
  X API collector.
