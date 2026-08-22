#!/usr/bin/env python3
"""
build_brain.py — Turn an official X (Twitter) data archive into a Markdown / Obsidian "second brain".

100% legal, offline-first pipeline. It reads the archive you download from
X (Settings -> Your account -> Download an archive of your data), parses every
tweet, rebuilds threads, expands t.co links, copies local media, optionally
downloads externally-linked resources (PDFs, guides, articles) and writes a
clean Obsidian vault with indexes, tags and backlinks.

Usage:
    python build_brain.py --archive path/to/twitter-archive.zip --out ./vault
    python build_brain.py --archive ./unzipped_archive_dir --out ./vault --download-resources

Nothing here talks to Twitter/X. It only reads the files X gave you and,
optionally, fetches the public URLs you yourself linked to in your tweets.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

# ----------------------------------------------------------------------------
# Optional dependency: requests (only needed for --download-resources)
# ----------------------------------------------------------------------------
try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None


# ----------------------------------------------------------------------------
# Data model
# ----------------------------------------------------------------------------
@dataclass
class Tweet:
    id: str
    created_at: dt.datetime
    full_text: str
    in_reply_to_status_id: str | None
    in_reply_to_user_id: str | None
    reply_count: int
    retweet_count: int
    favorite_count: int
    hashtags: list[str] = field(default_factory=list)
    urls: list[dict] = field(default_factory=list)          # expanded url metadata
    mentions: list[str] = field(default_factory=list)
    media: list[dict] = field(default_factory=list)          # local media metadata
    is_retweet: bool = False


# ----------------------------------------------------------------------------
# Archive loading
# ----------------------------------------------------------------------------
def load_archive(archive_path: Path, work_dir: Path) -> Path:
    """Return a directory that contains the archive's `data/` folder."""
    if archive_path.is_dir():
        return archive_path
    if archive_path.suffix.lower() == ".zip":
        extract_to = work_dir / "archive_extracted"
        if extract_to.exists():
            shutil.rmtree(extract_to)
        extract_to.mkdir(parents=True, exist_ok=True)
        print(f"  Extracting {archive_path.name} ...")
        with zipfile.ZipFile(archive_path) as zf:
            zf.extractall(extract_to)
        return extract_to
    raise SystemExit(f"Unsupported archive: {archive_path} (expected a .zip or a directory)")


def _read_js_object(path: Path):
    """X archive .js files look like `window.YTD.tweets.part0 = [ ... ]`.

    Strip the assignment prefix and parse the JSON payload.
    """
    text = path.read_text(encoding="utf-8", errors="replace")
    idx = text.find("=")
    if idx == -1:
        raise ValueError(f"Malformed archive file (no '='): {path}")
    payload = text[idx + 1 :].strip()
    return json.loads(payload)


def find_data_file(data_dir: Path, *names: str) -> Path | None:
    for name in names:
        p = data_dir / name
        if p.exists():
            return p
    return None


# ----------------------------------------------------------------------------
# Parsing
# ----------------------------------------------------------------------------
TWITTER_TS_FMT = "%a %b %d %H:%M:%S %z %Y"


def parse_account(data_dir: Path) -> dict:
    p = find_data_file(data_dir, "account.js")
    if not p:
        return {}
    obj = _read_js_object(p)
    if isinstance(obj, list) and obj:
        return obj[0].get("account", {})
    return {}


def parse_profile(data_dir: Path) -> dict:
    p = find_data_file(data_dir, "profile.js")
    if not p:
        return {}
    obj = _read_js_object(p)
    if isinstance(obj, list) and obj:
        return obj[0].get("profile", {})
    return {}


def parse_neutral_json(path: Path) -> tuple[list[Tweet], dict, dict]:
    """Ingest the neutral collector schema (see collectors/SCHEMA.md).

    Returns (tweets, account, profile). This is the source used when scraping a
    profile with your own account instead of using the official X archive.
    """
    doc = json.loads(path.read_text(encoding="utf-8"))
    acc = doc.get("account", {}) or {}
    account = {
        "username": acc.get("username", "unknown"),
        "accountId": str(acc.get("id") or acc.get("user_id") or ""),
        "accountDisplayName": acc.get("display_name", ""),
    }
    profile = {"description": {"bio": acc.get("bio", "")}} if acc.get("bio") else {}

    tweets: list[Tweet] = []
    for t in doc.get("tweets", []):
        created_raw = t.get("created_at")
        try:
            created = dt.datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
        except Exception:
            # fall back to the Twitter archive timestamp format if present
            try:
                created = dt.datetime.strptime(created_raw, TWITTER_TS_FMT)
            except Exception:
                created = dt.datetime.now(dt.timezone.utc)
        full_text = t.get("full_text") or t.get("text") or ""
        tweets.append(Tweet(
            id=str(t.get("id")),
            created_at=created,
            full_text=full_text,
            in_reply_to_status_id=(str(t["in_reply_to_status_id"])
                                   if t.get("in_reply_to_status_id") else None),
            in_reply_to_user_id=(str(t["in_reply_to_user_id"])
                                 if t.get("in_reply_to_user_id") else None),
            reply_count=int(t.get("reply_count", 0) or 0),
            retweet_count=int(t.get("retweet_count", 0) or 0),
            favorite_count=int(t.get("favorite_count", 0) or 0),
            hashtags=[h.lstrip("#") for h in t.get("hashtags", [])],
            urls=[{"url": u.get("url"), "expanded": u.get("expanded") or u.get("url"),
                   "display": u.get("display") or u.get("expanded") or u.get("url")}
                  for u in t.get("urls", [])],
            mentions=t.get("mentions", []),
            media=t.get("media", []),
            is_retweet=bool(t.get("is_retweet")) or full_text.startswith("RT @"),
        ))
    return tweets, account, profile


def parse_tweets(data_dir: Path) -> list[Tweet]:
    # Newer archives use tweets.js; older ones tweet.js. Some split into parts.
    candidates = sorted(
        [f for f in data_dir.glob("tweets*.js")] + [f for f in data_dir.glob("tweet.js")]
    )
    if not candidates:
        raise SystemExit(
            f"No tweets file found in {data_dir}. "
            "Make sure you point --archive at the folder that contains data/tweets.js"
        )

    tweets: list[Tweet] = []
    for path in candidates:
        obj = _read_js_object(path)
        for entry in obj:
            t = entry.get("tweet") or entry
            tweets.append(_to_tweet(t))
    return tweets


def _to_tweet(t: dict) -> Tweet:
    entities = t.get("entities", {}) or {}
    ext = t.get("extended_entities", {}) or {}

    hashtags = [h["text"] for h in entities.get("hashtags", []) if h.get("text")]
    mentions = [m["screen_name"] for m in entities.get("user_mentions", []) if m.get("screen_name")]

    urls = []
    for u in entities.get("urls", []):
        expanded = u.get("expanded_url") or u.get("url")
        if expanded:
            urls.append({
                "url": u.get("url"),
                "expanded": expanded,
                "display": u.get("display_url", expanded),
            })

    media = []
    for m in ext.get("media", []) or entities.get("media", []):
        media.append({
            "type": m.get("type", "photo"),
            "media_url": m.get("media_url_https") or m.get("media_url"),
            "id": m.get("id_str") or m.get("id"),
        })

    created_raw = t.get("created_at")
    try:
        created = dt.datetime.strptime(created_raw, TWITTER_TS_FMT)
    except Exception:
        created = dt.datetime.now(dt.timezone.utc)

    full_text = t.get("full_text") or t.get("text") or ""

    return Tweet(
        id=str(t.get("id_str") or t.get("id")),
        created_at=created,
        full_text=full_text,
        in_reply_to_status_id=t.get("in_reply_to_status_id_str"),
        in_reply_to_user_id=t.get("in_reply_to_user_id_str"),
        reply_count=int(t.get("reply_count", 0) or 0),
        retweet_count=int(t.get("retweet_count", 0) or 0),
        favorite_count=int(t.get("favorite_count", 0) or 0),
        hashtags=hashtags,
        urls=urls,
        mentions=mentions,
        media=media,
        is_retweet=full_text.startswith("RT @"),
    )


# ----------------------------------------------------------------------------
# Thread reconstruction
# ----------------------------------------------------------------------------
def build_threads(tweets: list[Tweet], own_user_id: str | None) -> list[list[Tweet]]:
    """Group self-reply chains into threads. Returns list of threads (each a
    time-ordered list of tweets). Standalone tweets are threads of length 1."""
    by_id = {t.id: t for t in tweets}
    children: dict[str, list[str]] = defaultdict(list)

    for t in tweets:
        parent = t.in_reply_to_status_id
        # Only stitch self-threads (reply to your own tweet that is in the archive)
        if parent and parent in by_id and (
            own_user_id is None or t.in_reply_to_user_id in (None, own_user_id)
        ):
            children[parent].append(t.id)

    # Roots = tweets that are not a self-reply to an in-archive tweet
    child_ids = {cid for kids in children.values() for cid in kids}
    roots = [t for t in tweets if t.id not in child_ids]

    threads: list[list[Tweet]] = []
    for root in roots:
        chain: list[Tweet] = []
        stack = [root.id]
        seen = set()
        while stack:
            cid = stack.pop(0)
            if cid in seen:
                continue
            seen.add(cid)
            chain.append(by_id[cid])
            kids = sorted(children.get(cid, []), key=lambda x: by_id[x].created_at)
            stack = kids + stack
        chain.sort(key=lambda x: x.created_at)
        threads.append(chain)

    threads.sort(key=lambda c: c[0].created_at, reverse=True)
    return threads


# ----------------------------------------------------------------------------
# Rendering helpers
# ----------------------------------------------------------------------------
def slugify(text: str, max_len: int = 60) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", "-", text.strip())
    text = text.strip("-")
    return (text[:max_len] or "tweet").lower()


def expand_text(t: Tweet) -> str:
    """Replace t.co links in the text with their expanded URLs (markdown)."""
    text = t.full_text
    for u in t.urls:
        if u.get("url"):
            text = text.replace(u["url"], u["expanded"])
    # convert bare hashtags to Obsidian tags is left to the reader; keep as-is
    return text


def is_resource_url(url: str) -> bool:
    """Heuristic: does this look like a downloadable resource (pdf/doc/etc)?"""
    lowered = url.lower().split("?")[0]
    return lowered.endswith((
        ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
        ".csv", ".zip", ".epub", ".md", ".txt", ".png", ".jpg", ".jpeg", ".gif",
    ))


# ----------------------------------------------------------------------------
# Resource downloading (optional)
# ----------------------------------------------------------------------------
def download_resource(url: str, dest_dir: Path, session) -> str | None:
    """Download an external resource. Returns local relative path or None."""
    try:
        resp = session.get(url, timeout=30, stream=True, headers={
            "User-Agent": "Mozilla/5.0 (second-brain-archive-tool)"
        })
        resp.raise_for_status()
        # Derive a filename
        parsed = urlparse(url)
        name = os.path.basename(parsed.path) or slugify(url, 40)
        if "." not in name:
            ctype = resp.headers.get("content-type", "")
            ext = {
                "application/pdf": ".pdf",
                "text/html": ".html",
                "text/plain": ".txt",
            }.get(ctype.split(";")[0].strip(), "")
            name += ext or ".bin"
        dest = dest_dir / name
        counter = 1
        while dest.exists():
            stem, suffix = os.path.splitext(name)
            dest = dest_dir / f"{stem}-{counter}{suffix}"
            counter += 1
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=8192):
                fh.write(chunk)
        return dest.name
    except Exception as e:
        print(f"    ! failed to download {url}: {e}")
        return None


# ----------------------------------------------------------------------------
# Vault writing
# ----------------------------------------------------------------------------
def write_vault(
    threads: list[list[Tweet]],
    account: dict,
    profile: dict,
    data_dir: Path,
    out_dir: Path,
    download_resources: bool,
):
    notes_dir = out_dir / "notes"
    media_dir = out_dir / "attachments"
    res_dir = out_dir / "resources"
    for d in (notes_dir, media_dir, res_dir):
        d.mkdir(parents=True, exist_ok=True)

    username = account.get("username", "unknown")
    session = None
    if download_resources:
        if requests is None:
            print("  ! --download-resources requested but `requests` is not installed. "
                  "Run: pip install requests. Skipping downloads.")
        else:
            session = requests.Session()

    # Media lookup: archive stores media under data/tweets_media/<tweetid>-<...>
    media_source_dirs = [
        data_dir / "tweets_media",
        data_dir / "tweet_media",
        data_dir / "direct_messages_media",
    ]

    tag_index: dict[str, list[str]] = defaultdict(list)
    resource_index: list[tuple[str, str, str]] = []  # (title, local_or_url, source_note)
    note_records: list[dict] = []

    for thread in threads:
        head = thread[0]
        if head.is_retweet:
            continue  # skip pure retweets for the brain; they aren't your content

        title_seed = expand_text(head).strip() or f"tweet-{head.id}"
        # Clean title: drop URLs, collapse whitespace (body keeps everything)
        clean_title = re.sub(r"https?://\S+", "", title_seed)
        clean_title = re.sub(r"\s+", " ", clean_title).strip()
        first_line = (clean_title.splitlines()[0] if clean_title else f"tweet-{head.id}")
        slug = f"{head.created_at:%Y-%m-%d}-{slugify(first_line)}-{head.id[-6:]}"
        note_path = notes_dir / f"{slug}.md"

        # Aggregate thread-level metadata
        all_tags = sorted({h.lower() for t in thread for h in t.hashtags})
        total_likes = sum(t.favorite_count for t in thread)
        total_rts = sum(t.retweet_count for t in thread)

        lines: list[str] = []
        # YAML frontmatter for Obsidian
        lines.append("---")
        lines.append(f'title: "{first_line[:120].replace(chr(34), "")}"')
        lines.append(f"date: {head.created_at:%Y-%m-%d}")
        lines.append(f"tweet_id: {head.id}")
        lines.append(f"author: {username}")
        lines.append(f"url: https://twitter.com/{username}/status/{head.id}")
        lines.append(f"likes: {total_likes}")
        lines.append(f"retweets: {total_rts}")
        lines.append(f"thread_length: {len(thread)}")
        if all_tags:
            lines.append("tags:")
            for tg in all_tags:
                lines.append(f"  - {tg}")
        lines.append("---")
        lines.append("")

        if len(thread) > 1:
            lines.append(f"# 🧵 Thread ({len(thread)} tweets)")
        else:
            lines.append(f"# {first_line[:100]}")
        lines.append("")

        for i, t in enumerate(thread, 1):
            body = expand_text(t)
            if len(thread) > 1:
                lines.append(f"**{i}/{len(thread)}**")
                lines.append("")
            lines.append(body)
            lines.append("")

            # Local media
            for m in t.media:
                fname = _copy_media(t.id, m, media_source_dirs, media_dir)
                if fname:
                    lines.append(f"![[{fname}]]")
                    lines.append("")

            # External resources / links
            for u in t.urls:
                expanded = u["expanded"]
                if expanded.startswith("https://twitter.com/") and "/photo/" in expanded:
                    continue
                label = u.get("display", expanded)
                if download_resources and session and is_resource_url(expanded):
                    print(f"    downloading resource: {expanded}")
                    local = download_resource(expanded, res_dir, session)
                    if local:
                        lines.append(f"- 📎 [[resources/{local}|{label}]] "
                                     f"(source: [{expanded}]({expanded}))")
                        resource_index.append((label, f"resources/{local}", slug))
                        lines.append("")
                        continue
                lines.append(f"- 🔗 [{label}]({expanded})")
                resource_index.append((label, expanded, slug))
            if t.urls:
                lines.append("")

        # Footer stats + backlink
        lines.append("---")
        lines.append(f"❤️ {total_likes} · 🔁 {total_rts} · "
                     f"[View on X](https://twitter.com/{username}/status/{head.id})")
        if all_tags:
            lines.append("")
            lines.append(" ".join(f"#{tg}" for tg in all_tags))

        note_path.write_text("\n".join(lines), encoding="utf-8")

        for tg in all_tags:
            tag_index[tg].append(slug)
        note_records.append({
            "slug": slug,
            "title": first_line[:100],
            "date": head.created_at,
            "likes": total_likes,
            "thread_len": len(thread),
        })

    _write_indexes(out_dir, username, profile, note_records, tag_index, resource_index)
    return len(note_records), len(resource_index)


def _copy_media(tweet_id: str, media: dict, source_dirs: list[Path], media_dir: Path) -> str | None:
    for sd in source_dirs:
        if not sd.exists():
            continue
        # Archive names files like <tweetid>-<hash>.<ext>
        for f in sd.glob(f"{tweet_id}-*"):
            dest = media_dir / f.name
            if not dest.exists():
                shutil.copy2(f, dest)
            return f.name
    return None


def _write_indexes(out_dir, username, profile, note_records, tag_index, resource_index):
    # Home / MOC
    note_records_sorted = sorted(note_records, key=lambda r: r["date"], reverse=True)
    top_liked = sorted(note_records, key=lambda r: r["likes"], reverse=True)[:20]

    home = ["---", "title: Second Brain — Home", "---", "",
            f"# 🧠 Second Brain — @{username}", ""]
    bio = (profile.get("description", {}) or {}).get("bio") if profile else None
    if bio:
        home.append(f"> {bio}")
        home.append("")
    home.append(f"- **{len(note_records)}** notes")
    home.append(f"- **{len(tag_index)}** topics")
    home.append(f"- **{len(resource_index)}** linked resources")
    home.append("")
    home.append("## 🗺️ Navigate")
    home.append("- [[_index_by_date|📅 By date]]")
    home.append("- [[_index_by_topic|🏷️ By topic]]")
    home.append("- [[_index_resources|📎 Resources & guides]]")
    home.append("")
    home.append("## ⭐ Top notes (most liked)")
    for r in top_liked:
        home.append(f"- [[notes/{r['slug']}|{r['title']}]] — ❤️ {r['likes']}")
    (out_dir / "Home.md").write_text("\n".join(home), encoding="utf-8")

    # By date
    by_date = ["# 📅 Notes by date", ""]
    current_month = None
    for r in note_records_sorted:
        month = r["date"].strftime("%Y-%m")
        if month != current_month:
            current_month = month
            by_date.append(f"\n## {month}\n")
        marker = "🧵 " if r["thread_len"] > 1 else ""
        by_date.append(f"- {r['date']:%Y-%m-%d} — {marker}[[notes/{r['slug']}|{r['title']}]]")
    (out_dir / "_index_by_date.md").write_text("\n".join(by_date), encoding="utf-8")

    # By topic
    by_topic = ["# 🏷️ Notes by topic", ""]
    for tag in sorted(tag_index, key=lambda t: len(tag_index[t]), reverse=True):
        by_topic.append(f"\n## #{tag} ({len(tag_index[tag])})\n")
        for slug in tag_index[tag]:
            by_topic.append(f"- [[notes/{slug}]]")
    (out_dir / "_index_by_topic.md").write_text("\n".join(by_topic), encoding="utf-8")

    # Resources
    res = ["# 📎 Resources & guides", "",
           "Every external link and downloaded file, grouped by source note.", ""]
    for title, target, note in resource_index:
        if target.startswith("resources/"):
            res.append(f"- [[{target}|{title}]] — from [[notes/{note}]]")
        else:
            res.append(f"- [{title}]({target}) — from [[notes/{note}]]")
    (out_dir / "_index_resources.md").write_text("\n".join(res), encoding="utf-8")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--archive", type=Path,
                     help="Path to the official X archive .zip OR the unzipped archive directory")
    src.add_argument("--json", type=Path, dest="json_source",
                     help="Path to a neutral-schema JSON file (from a collector, e.g. collect_twscrape.py)")
    ap.add_argument("--out", required=True, type=Path, help="Output vault directory")
    ap.add_argument("--download-resources", action="store_true",
                    help="Download externally-linked PDFs/guides/files (needs `requests`)")
    ap.add_argument("--include-retweets", action="store_true",
                    help="Also create notes for pure retweets (off by default)")
    args = ap.parse_args()

    work_dir = args.out.parent / ".build_tmp"
    work_dir.mkdir(parents=True, exist_ok=True)
    data_dir = work_dir  # no local media dir for JSON sources; overridden for archives

    if args.json_source:
        print("→ Loading neutral JSON source ...")
        tweets, account, profile = parse_neutral_json(args.json_source)
        print(f"  parsed {len(tweets)} tweets for @{account.get('username', '?')}")
    else:
        print("→ Loading archive ...")
        root = load_archive(args.archive, work_dir)
        data_dir = root / "data" if (root / "data").exists() else root
        if not any(data_dir.glob("tweet*.js")):
            # maybe the archive root itself is the data dir
            data_dir = root
        print(f"  data dir: {data_dir}")
        print("→ Parsing account & tweets ...")
        account = parse_account(data_dir)
        profile = parse_profile(data_dir)
        tweets = parse_tweets(data_dir)
        print(f"  parsed {len(tweets)} tweets for @{account.get('username', '?')}")

    if not args.include_retweets:
        pre = len(tweets)
        # keep retweets in the list; build_threads still needs ids, we skip at render
        print(f"  (pure retweets will be skipped at render time)")

    print("→ Reconstructing threads ...")
    threads = build_threads(tweets, account.get("accountId"))
    print(f"  {len(threads)} threads/standalone notes")

    print("→ Writing Obsidian vault ...")
    n_notes, n_res = write_vault(
        threads, account, profile, data_dir, args.out, args.download_resources
    )

    # Cleanup temp extraction
    try:
        shutil.rmtree(work_dir)
    except Exception:
        pass

    print("\n✅ Done.")
    print(f"   Notes written : {n_notes}")
    print(f"   Resources     : {n_res}")
    print(f"   Vault         : {args.out.resolve()}")
    print(f"\n   Open the folder as a vault in Obsidian and start at Home.md")


if __name__ == "__main__":
    main()
