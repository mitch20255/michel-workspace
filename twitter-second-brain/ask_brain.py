#!/usr/bin/env python3
"""
ask_brain.py — Ask questions about your second brain in natural language.

Retrieval is 100% local (a pure-Python BM25 index over the vault notes — no
embeddings, no extra services, works offline). The answer is written by Claude
from the retrieved notes, with citations back to the source notes so you can
verify every claim.

Usage:
    # One-off question
    python ask_brain.py --vault ./vault --question "What's their advice on pricing?"

    # Interactive chat
    python ask_brain.py --vault ./vault

    # Just show what the retriever finds, no AI (works with no API key)
    python ask_brain.py --vault ./vault --question "cold outbound" --no-ai

Auth: set ANTHROPIC_API_KEY (e.g. in .env) or run `ant auth login`. The SDK
picks up either automatically.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None

# Anthropic SDK imported lazily inside answer_with_claude so --no-ai works
# without it installed.

MODEL = "claude-opus-5"

# Small bilingual stopword list (EN + FR) — keeps BM25 focused on content words.
STOPWORDS = set("""
a an the of to in on for and or but with without as at by from into is are was were be been being
this that these those it its it's i you he she they we me my your our their his her them us
not no do does did done have has had can could would should will shall may might must
about above after again against all am any because before below between both down during each few
more most other some such than too very s t just don now
le la les un une des du de d et ou mais avec sans comme au aux ce cet cette ces il elle ils elles
nous vous je tu me te se son sa ses leur leurs mon ma mes ton ta tes notre nos votre vos
ne pas plus moins que qui quoi dont pour par sur dans est sont etait etaient ete etre avoir
ce cela ça on y en a
""".split())


def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"https?://\S+", " ", text)
    tokens = re.findall(r"[a-zà-ÿ0-9]{2,}", text)
    return [t for t in tokens if t not in STOPWORDS]


# ----------------------------------------------------------------------------
# Note loading
# ----------------------------------------------------------------------------
@dataclass
class Note:
    slug: str
    path: Path
    title: str = ""
    url: str = ""
    date: str = ""
    likes: int = 0
    body: str = ""
    tokens: list[str] = field(default_factory=list)


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.startswith(("  ", "-", "\t")):
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"')
    return meta, text[m.end():]


def load_notes(vault: Path) -> list[Note]:
    notes_dir = vault / "notes"
    if not notes_dir.exists():
        raise SystemExit(f"No notes/ folder in {vault}. Build the vault first with build_brain.py.")
    notes: list[Note] = []
    for p in sorted(notes_dir.glob("*.md")):
        raw = p.read_text(encoding="utf-8", errors="replace")
        meta, body = parse_frontmatter(raw)
        try:
            likes = int(meta.get("likes", 0))
        except ValueError:
            likes = 0
        note = Note(
            slug=p.stem,
            path=p,
            title=meta.get("title", p.stem),
            url=meta.get("url", ""),
            date=meta.get("date", ""),
            likes=likes,
            body=body.strip(),
        )
        note.tokens = tokenize(note.title + "\n" + note.body)
        notes.append(note)
    if not notes:
        raise SystemExit(f"No notes found in {notes_dir}.")
    return notes


# ----------------------------------------------------------------------------
# BM25 (pure Python)
# ----------------------------------------------------------------------------
class BM25:
    def __init__(self, docs_tokens: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.N = len(docs_tokens)
        self.doc_len = [len(d) for d in docs_tokens]
        self.avgdl = (sum(self.doc_len) / self.N) if self.N else 0.0
        self.freqs = [Counter(d) for d in docs_tokens]
        df: Counter = Counter()
        for tf in self.freqs:
            df.update(tf.keys())
        self.idf = {
            term: math.log(1 + (self.N - n + 0.5) / (n + 0.5))
            for term, n in df.items()
        }

    def score(self, query_tokens: list[str], idx: int) -> float:
        tf = self.freqs[idx]
        dl = self.doc_len[idx]
        score = 0.0
        for term in query_tokens:
            if term not in tf:
                continue
            idf = self.idf.get(term, 0.0)
            freq = tf[term]
            denom = freq + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1))
            score += idf * (freq * (self.k1 + 1)) / denom
        return score

    def top_k(self, query_tokens: list[str], k: int) -> list[tuple[int, float]]:
        scored = [(i, self.score(query_tokens, i)) for i in range(self.N)]
        scored = [s for s in scored if s[1] > 0]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]


# ----------------------------------------------------------------------------
# Retrieval + answering
# ----------------------------------------------------------------------------
def retrieve(notes: list[Note], bm25: BM25, question: str, k: int) -> list[Note]:
    q_tokens = tokenize(question)
    hits = bm25.top_k(q_tokens, k)
    return [notes[i] for i, _ in hits]


def build_context(hits: list[Note], max_chars: int = 24000) -> str:
    blocks = []
    used = 0
    for n in hits:
        block = (f"[{n.slug}] (❤️{n.likes}, {n.date})\n"
                 f"Title: {n.title}\n{n.body}\n")
        if used + len(block) > max_chars:
            block = block[: max(0, max_chars - used)]
        blocks.append(block)
        used += len(block)
        if used >= max_chars:
            break
    return "\n---\n".join(blocks)


SYSTEM_PROMPT = (
    "You are a research assistant answering questions strictly from a person's "
    "archived tweets ('notes'). Rules:\n"
    "- Answer ONLY from the provided notes. If they don't contain the answer, "
    "say so plainly — never invent facts.\n"
    "- Cite the notes you use with their [slug] id inline, e.g. [2026-03-01-...].\n"
    "- Be concise and specific. Synthesize across notes when relevant.\n"
    "- Answer in the language of the question."
)


def answer_with_claude(question: str, context: str) -> int:
    try:
        import anthropic  # type: ignore
    except Exception:
        print("\n[!] The `anthropic` SDK is not installed. Run: pip install anthropic\n"
              "    (or use --no-ai to see the retrieved notes without an AI answer.)")
        return 1

    try:
        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY or ant auth profile
    except Exception as e:
        print(f"\n[!] Could not init Anthropic client: {e}")
        return 1

    user_msg = (
        f"Question: {question}\n\n"
        f"Here are the most relevant notes from the second brain:\n\n{context}\n\n"
        f"Answer the question using only these notes, with [slug] citations."
    )

    print("\n🧠 Claude:\n")
    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=2000,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        ) as stream:
            for event in stream.text_stream:
                print(event, end="", flush=True)
        print("\n")
    except anthropic.APIStatusError as e:
        print(f"\n[!] Anthropic API error {e.status_code}: {e}")
        return 1
    except Exception as e:
        print(f"\n[!] Request failed: {e}")
        return 1
    return 0


def show_hits(hits: list[Note]) -> None:
    print("\n🔎 Most relevant notes:")
    for n in hits:
        print(f"  • [{n.slug}] ❤️{n.likes} — {n.title}")
        if n.url:
            print(f"      {n.url}")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def answer_once(notes, bm25, question: str, k: int, use_ai: bool) -> int:
    hits = retrieve(notes, bm25, question, k)
    if not hits:
        print("No matching notes found for that query.")
        return 0
    show_hits(hits)
    if not use_ai:
        return 0
    context = build_context(hits)
    return answer_with_claude(question, context)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vault", required=True, type=Path, help="Path to the vault built by build_brain.py")
    ap.add_argument("--question", "-q", help="Ask one question and exit (omit for interactive chat)")
    ap.add_argument("--k", type=int, default=6, help="How many notes to retrieve (default 6)")
    ap.add_argument("--no-ai", action="store_true", help="Only show retrieved notes; skip the Claude answer")
    ap.add_argument("--env", type=Path, default=None, help="Path to .env for ANTHROPIC_API_KEY")
    args = ap.parse_args()

    if load_dotenv is not None:
        load_dotenv(args.env)

    print(f"→ Loading notes from {args.vault} ...")
    notes = load_notes(args.vault)
    bm25 = BM25([n.tokens for n in notes])
    print(f"  indexed {len(notes)} notes")

    use_ai = not args.no_ai

    if args.question:
        sys.exit(answer_once(notes, bm25, args.question, args.k, use_ai))

    # Interactive REPL
    print("\n💬 Ask your second brain (type 'exit' to quit).")
    while True:
        try:
            q = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if q.lower() in {"exit", "quit", "q", ""}:
            break
        answer_once(notes, bm25, q, args.k, use_ai)


if __name__ == "__main__":
    main()
