"""
Fiches d'activités à Montréal — petit backend Flask + API JSON.
Sert aussi le frontend statique (static/index.html).
"""
from flask import Flask, request, jsonify, send_from_directory

import db
import instagram

app = Flask(__name__, static_folder="static", static_url_path="")

db.init_db()


# ---------- Frontend ----------
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ---------- API : activités ----------
@app.get("/api/activities")
def api_list():
    items = db.list_activities(
        search=request.args.get("search", "").strip(),
        category=request.args.get("category", "").strip(),
        status=request.args.get("status", "").strip(),
        tag=request.args.get("tag", "").strip(),
    )
    return jsonify({"activities": items, "stats": db.stats()})


@app.get("/api/activities/<int:activity_id>")
def api_get(activity_id):
    item = db.get_activity(activity_id)
    return (jsonify(item), 200) if item else (jsonify({"error": "introuvable"}), 404)


@app.post("/api/activities")
def api_create():
    try:
        item = db.create_activity(request.get_json(force=True) or {})
        return jsonify(item), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.put("/api/activities/<int:activity_id>")
def api_update(activity_id):
    if not db.get_activity(activity_id):
        return jsonify({"error": "introuvable"}), 404
    item = db.update_activity(activity_id, request.get_json(force=True) or {})
    return jsonify(item)


@app.delete("/api/activities/<int:activity_id>")
def api_delete(activity_id):
    ok = db.delete_activity(activity_id)
    return (jsonify({"ok": True}), 200) if ok else (jsonify({"error": "introuvable"}), 404)


# ---------- API : Instagram (conforme Meta) ----------
@app.post("/api/instagram/preview")
def api_ig_preview():
    """Analyse une URL de post et tente l'oEmbed officiel si un jeton est configuré."""
    url = (request.get_json(force=True) or {}).get("url", "").strip()
    if not instagram.is_valid_post_url(url):
        return jsonify({"error": "URL de post Instagram invalide (attendu /p/, /reel/ ou /tv/)."}), 400
    return jsonify(instagram.oembed(url))


@app.get("/api/instagram/search")
def api_ig_search():
    """Recherche par hashtag via la Graph API (si configurée)."""
    hashtag = request.args.get("q", "").strip()
    if not hashtag:
        return jsonify({"error": "paramètre q (hashtag) requis"}), 400
    return jsonify(instagram.search_hashtag(hashtag))


if __name__ == "__main__":
    print("→ http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
