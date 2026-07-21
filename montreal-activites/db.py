"""Couche d'accès SQLite pour les fiches d'activités montréalaises."""
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).parent / "activites.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS activities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    category        TEXT DEFAULT 'Autre',
    neighborhood    TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    price           TEXT DEFAULT '',
    start_date      TEXT DEFAULT '',
    end_date        TEXT DEFAULT '',
    source_platform TEXT DEFAULT 'manual',
    source_url      TEXT DEFAULT '',
    author_handle   TEXT DEFAULT '',
    image_url       TEXT DEFAULT '',
    tags            TEXT DEFAULT '',
    status          TEXT DEFAULT 'a_faire',
    rating          INTEGER DEFAULT 0,
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status   ON activities(status);
CREATE INDEX IF NOT EXISTS idx_category ON activities(category);
"""

# Colonnes modifiables via l'API (on ne laisse jamais l'utilisateur toucher id/created_at).
EDITABLE_FIELDS = [
    "title", "description", "category", "neighborhood", "address", "price",
    "start_date", "end_date", "source_platform", "source_url", "author_handle",
    "image_url", "tags", "status", "rating", "notes",
]


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def _clean(data: dict) -> dict:
    """Ne garde que les champs autorisés, avec valeurs par défaut sûres."""
    out = {}
    for field in EDITABLE_FIELDS:
        if field in data and data[field] is not None:
            value = data[field]
            if field == "rating":
                try:
                    value = max(0, min(5, int(value)))
                except (TypeError, ValueError):
                    value = 0
            else:
                value = str(value).strip()
            out[field] = value
    return out


def list_activities(search="", category="", status="", tag=""):
    query = "SELECT * FROM activities WHERE 1=1"
    params = []
    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR neighborhood LIKE ? OR tags LIKE ?)"
        like = f"%{search}%"
        params += [like, like, like, like]
    if category:
        query += " AND category = ?"
        params.append(category)
    if status:
        query += " AND status = ?"
        params.append(status)
    if tag:
        query += " AND tags LIKE ?"
        params.append(f"%{tag}%")
    query += " ORDER BY datetime(created_at) DESC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def get_activity(activity_id):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    return dict(row) if row else None


def create_activity(data: dict):
    fields = _clean(data)
    if not fields.get("title"):
        raise ValueError("Le titre est obligatoire.")
    now = _now()
    fields.setdefault("status", "a_faire")
    cols = list(fields.keys()) + ["created_at", "updated_at"]
    vals = list(fields.values()) + [now, now]
    placeholders = ",".join("?" for _ in cols)
    with get_conn() as conn:
        cur = conn.execute(
            f"INSERT INTO activities ({','.join(cols)}) VALUES ({placeholders})", vals
        )
        new_id = cur.lastrowid
    return get_activity(new_id)


def update_activity(activity_id, data: dict):
    fields = _clean(data)
    if not fields:
        return get_activity(activity_id)
    fields["updated_at"] = _now()
    assignments = ",".join(f"{k} = ?" for k in fields)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE activities SET {assignments} WHERE id = ?",
            list(fields.values()) + [activity_id],
        )
    return get_activity(activity_id)


def delete_activity(activity_id):
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    return cur.rowcount > 0


def stats():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM activities").fetchone()[0]
        by_status = {
            r["status"]: r["n"]
            for r in conn.execute(
                "SELECT status, COUNT(*) n FROM activities GROUP BY status"
            ).fetchall()
        }
    return {"total": total, "by_status": by_status}
