#!/usr/bin/env python3
"""
collect_twscrape.py — Fetch a profile's tweets using YOUR OWN X account, and
emit the neutral JSON schema consumed by build_brain.py --json.

⚠️  LEGAL / ACCOUNT-SAFETY NOTICE
---------------------------------
Automated scraping of X with account credentials is AGAINST X's Terms of
Service and can get the account rate-limited or suspended. Use a SECONDARY,
dedicated account — never your main one. You accept this risk; this tool does
not hide it. Credentials are read from environment variables / a .env file and
are never written to the output.

Setup:
    pip install twscrape python-dotenv
    cp .env.example .env      # then fill in your (secondary) account details

Usage:
    python collectors/collect_twscrape.py --target somehandle --limit 2000 \
        --out ../data/somehandle.json

Then build the brain:
    python build_brain.py --json ../data/somehandle.json --out ../vault

This talks to X only through the account you configure. It does not touch the
Anthropic API — that's ask_brain.py's job.
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import os
import sys
from pathlib import Path

# --- optional deps, imported lazily with a helpful message ------------------
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None

try:
    from twscrape import API, gather  # type: ignore
except Exception:
    API = None
    gather = None


def _iso(d) -> str:
    if isinstance(d, dt.datetime):
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    return str(d)


def tweet_to_neutral(tw) -> dict:
    """Map a twscrape Tweet object to the neutral schema."""
    urls = []
    for u in (getattr(tw, "links", None) or []):
        # twscrape TextLink has .url (t.co) and .text/.expandedUrl
        expanded = getattr(u, "expandedUrl", None) or getattr(u, "url", None)
        urls.append({
            "url": getattr(u, "url", None),
            "expanded": expanded,
            "display": getattr(u, "text", None) or expanded,
        })

    media = []
    m = getattr(tw, "media", None)
    if m:
        for photo in (getattr(m, "photos", None) or []):
            media.append({"type": "photo", "media_url": getattr(photo, "url", None),
                          "id": None})
        for vid in (getattr(m, "videos", None) or []):
            variants = getattr(vid, "variants", None) or []
            best = variants[-1].url if variants else getattr(vid, "thumbnailUrl", None)
            media.append({"type": "video", "media_url": best, "id": None})

    hashtags = list(getattr(tw, "hashtags", None) or [])
    mentions = [getattr(u, "username", str(u)) for u in (getattr(tw, "mentionedUsers", None) or [])]

    reply_to_status = getattr(tw, "inReplyToTweetId", None)
    reply_to_user = getattr(tw, "inReplyToUser", None)
    reply_to_user_id = getattr(reply_to_user, "id", None) if reply_to_user else None

    return {
        "id": str(tw.id),
        "created_at": _iso(getattr(tw, "date", None)),
        "full_text": getattr(tw, "rawContent", None) or getattr(tw, "content", "") or "",
        "in_reply_to_status_id": str(reply_to_status) if reply_to_status else None,
        "in_reply_to_user_id": str(reply_to_user_id) if reply_to_user_id else None,
        "favorite_count": int(getattr(tw, "likeCount", 0) or 0),
        "retweet_count": int(getattr(tw, "retweetCount", 0) or 0),
        "reply_count": int(getattr(tw, "replyCount", 0) or 0),
        "hashtags": hashtags,
        "urls": urls,
        "mentions": mentions,
        "media": media,
        "is_retweet": bool(getattr(tw, "retweetedTweet", None)),
    }


async def add_account_from_env(api) -> None:
    """Register the configured account into twscrape's pool (idempotent)."""
    user = os.environ.get("X_USERNAME")
    pwd = os.environ.get("X_PASSWORD")
    email = os.environ.get("X_EMAIL")
    email_pwd = os.environ.get("X_EMAIL_PASSWORD")
    cookies = os.environ.get("X_COOKIES")  # optional: skip password login

    if not user:
        raise SystemExit(
            "No X_USERNAME in environment. Copy .env.example to .env and fill it in."
        )

    try:
        if cookies:
            # Cookie-based auth avoids password login challenges entirely.
            await api.pool.add_account(user, pwd or "x", email or "x", email_pwd or "x",
                                       cookies=cookies)
        else:
            await api.pool.add_account(user, pwd, email, email_pwd)
    except Exception as e:
        # Most commonly: account already exists in the pool db — that's fine.
        print(f"  (add_account note: {e})")

    await api.pool.login_all()


async def run(target: str, limit: int, out_path: Path) -> None:
    api = API()  # stores session state in accounts.db in the cwd
    await add_account_from_env(api)

    print(f"→ Resolving @{target} ...")
    user = await api.user_by_login(target)
    if user is None:
        raise SystemExit(f"Could not resolve @{target} (login failed, suspended, or blocked?)")

    account = {
        "username": user.username,
        "display_name": getattr(user, "displayname", ""),
        "bio": getattr(user, "rawDescription", "") or getattr(user, "description", ""),
        "id": str(user.id),
    }

    print(f"→ Fetching up to {limit} tweets from @{target} ...")
    tweets_raw = await gather(api.user_tweets(user.id, limit=limit))
    print(f"  fetched {len(tweets_raw)} tweets")

    doc = {"account": account, "tweets": [tweet_to_neutral(t) for t in tweets_raw]}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ Wrote {len(doc['tweets'])} tweets → {out_path.resolve()}")
    print(f"   Next: python build_brain.py --json {out_path} --out ./vault")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True, help="Handle to scrape (without @)")
    ap.add_argument("--limit", type=int, default=1000, help="Max tweets to fetch")
    ap.add_argument("--out", required=True, type=Path, help="Output neutral JSON path")
    ap.add_argument("--env", type=Path, default=None, help="Path to .env (default: ./.env)")
    args = ap.parse_args()

    if load_dotenv is not None:
        load_dotenv(args.env)  # loads ./.env by default
    elif args.env:
        print("  (python-dotenv not installed; relying on real environment vars)")

    if API is None:
        raise SystemExit(
            "twscrape is not installed. Run: pip install twscrape python-dotenv\n"
            "This collector needs it to talk to X with your account."
        )

    asyncio.run(run(args.target, args.limit, args.out))


if __name__ == "__main__":
    main()
