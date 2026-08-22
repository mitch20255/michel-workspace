# Neutral ingestion schema

`build_brain.py --json <file>` reads this format. Any collector (twscrape,
official API, Apify, a manual export) that emits this shape can feed the second
brain — the source is fully decoupled from the vault builder.

```jsonc
{
  "account": {
    "username": "growthlead",          // required — handle without @
    "display_name": "Growth Lead",     // optional
    "bio": "Threads on SaaS growth.",  // optional — shown on Home.md
    "id": "42"                          // optional — numeric user id (used to stitch self-threads)
  },
  "tweets": [
    {
      "id": "9001",                     // required — string tweet id
      "created_at": "2026-03-01T10:00:00Z", // required — ISO 8601 (Z or +00:00)
      "full_text": "…",                 // required — the tweet text (or "text")
      "in_reply_to_status_id": null,    // optional — parent tweet id, for threads
      "in_reply_to_user_id": null,      // optional — reply target user id
      "favorite_count": 800,            // optional — likes
      "retweet_count": 210,             // optional
      "reply_count": 4,                 // optional
      "hashtags": ["#sales", "growth"], // optional — leading # is stripped
      "urls": [                         // optional — external links
        {"url": "https://t.co/p",
         "expanded": "https://example.com/playbook.pdf",
         "display": "example.com/playbook.pdf"}
      ],
      "mentions": ["someone"],          // optional — screen names
      "media": [                        // optional — media attached to the tweet
        {"type": "photo", "media_url": "https://…/img.jpg", "id": "123"}
      ],
      "is_retweet": false               // optional — pure RTs are skipped by default
    }
  ]
}
```

## Notes

- **Threads** are reconstructed from `in_reply_to_status_id` chains where the
  reply targets the same author (`in_reply_to_user_id == account.id`). Include
  the whole self-reply chain and threading just works.
- **Media** from a scraped profile is referenced by URL (there is no local
  media folder as with the official archive). Run `build_brain.py` with
  `--download-resources` to also pull linked PDFs/guides into `resources/`.
- Only `account.username`, and each tweet's `id` / `created_at` / `full_text`
  are strictly required. Everything else degrades gracefully.
