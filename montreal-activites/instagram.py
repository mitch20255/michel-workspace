"""
Intégration Instagram **conforme aux règles de Meta**.

Deux voies légitimes sont supportées, aucune ne fait de scraping (interdit par les CGU) :

1. oEmbed officiel (`/instagram_oembed`) — nécessite un jeton d'accès Meta.
   Permet d'obtenir le code d'intégration + la miniature d'un post PUBLIC dont
   on possède l'URL. C'est la façon supportée d'afficher un post.

2. Recherche par hashtag (Instagram Graph API `ig_hashtag_search`) — nécessite
   un compte Business/Creator lié à une app Facebook validée. Limité (~30
   hashtags / 7 jours, posts publics seulement, pas d'infos auteur).

Sans jeton configuré, l'app reste 100% fonctionnelle : on stocke simplement le
lien collé et l'utilisateur complète la fiche à la main.

Configuration via variables d'environnement :
    META_ACCESS_TOKEN   Jeton d'accès Meta (oEmbed + Graph API)
    IG_BUSINESS_USER_ID Identifiant du compte IG Business (recherche hashtag)
"""
import os
import re
import json
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

GRAPH_VERSION = "v21.0"
# Accepte les deux formes : /p/<code> et /<handle>/p/<code> (+ reel, tv).
POST_URL_RE = re.compile(
    r"https?://(www\.)?instagram\.com/([A-Za-z0-9_.\-]+/)?(p|reel|tv)/[A-Za-z0-9_\-]+", re.I
)


def is_valid_post_url(url: str) -> bool:
    return bool(POST_URL_RE.match(url.strip())) if url else False


def parse_url(url: str) -> dict:
    """Extrait ce qu'on peut d'une URL de post SANS appeler Instagram (pas de scraping)."""
    url = (url or "").strip().split("?")[0].rstrip("/")
    handle = ""
    shortcode = ""
    m = re.search(r"instagram\.com/([^/]+)/(p|reel|tv)/([A-Za-z0-9_\-]+)", url, re.I)
    if m:
        handle = m.group(1)
        shortcode = m.group(3)
    else:
        m = re.search(r"instagram\.com/(p|reel|tv)/([A-Za-z0-9_\-]+)", url, re.I)
        if m:
            shortcode = m.group(2)
    if handle in {"p", "reel", "tv", "www.instagram.com"}:
        handle = ""
    return {
        "source_url": url,
        "author_handle": f"@{handle}" if handle else "",
        "shortcode": shortcode,
        "source_platform": "instagram",
    }


def _token():
    return os.environ.get("META_ACCESS_TOKEN", "").strip()


def _http_get_json(url: str):
    req = Request(url, headers={"User-Agent": "montreal-activites/1.0"})
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def oembed(url: str) -> dict:
    """
    Retourne les données oEmbed officielles si un jeton Meta est configuré.
    Sinon, retombe proprement sur l'analyse locale de l'URL.
    Ne lève jamais : renvoie toujours un dict exploitable par le frontend.
    """
    base = parse_url(url)
    token = _token()
    if not token:
        base["oembed_available"] = False
        base["note"] = "Jeton Meta absent : lien enregistré, complète la fiche à la main."
        return base

    endpoint = (
        f"https://graph.facebook.com/{GRAPH_VERSION}/instagram_oembed"
        f"?url={url}&access_token={token}&omitscript=true"
    )
    try:
        data = _http_get_json(endpoint)
        base["oembed_available"] = True
        base["title"] = data.get("title", "")
        base["author_handle"] = (
            f"@{data['author_name']}" if data.get("author_name") else base["author_handle"]
        )
        base["image_url"] = data.get("thumbnail_url", "")
        base["embed_html"] = data.get("html", "")
    except (HTTPError, URLError, ValueError, KeyError) as exc:
        base["oembed_available"] = False
        base["note"] = f"oEmbed indisponible ({exc}). Lien enregistré, complète à la main."
    return base


def search_hashtag(hashtag: str, limit: int = 25) -> dict:
    """
    Recherche par hashtag via l'Instagram Graph API (voie conforme).
    Nécessite META_ACCESS_TOKEN + IG_BUSINESS_USER_ID.
    Renvoie une structure exploitable, ou une erreur explicite si non configuré.
    """
    token = _token()
    ig_user = os.environ.get("IG_BUSINESS_USER_ID", "").strip()
    hashtag = hashtag.lstrip("#").strip()
    if not token or not ig_user:
        return {
            "configured": False,
            "results": [],
            "note": (
                "Recherche hashtag non configurée. Requiert un compte IG Business + "
                "META_ACCESS_TOKEN et IG_BUSINESS_USER_ID. Voir le README."
            ),
        }
    try:
        hid = _http_get_json(
            f"https://graph.facebook.com/{GRAPH_VERSION}/ig_hashtag_search"
            f"?user_id={ig_user}&q={hashtag}&access_token={token}"
        )["data"][0]["id"]
        fields = "id,caption,media_type,permalink,thumbnail_url,media_url"
        media = _http_get_json(
            f"https://graph.facebook.com/{GRAPH_VERSION}/{hid}/recent_media"
            f"?user_id={ig_user}&fields={fields}&limit={limit}&access_token={token}"
        )
        results = []
        for m in media.get("data", []):
            results.append({
                "title": (m.get("caption") or "")[:120],
                "description": m.get("caption", ""),
                "source_url": m.get("permalink", ""),
                "image_url": m.get("thumbnail_url") or m.get("media_url", ""),
                "source_platform": "instagram",
                "tags": hashtag,
            })
        return {"configured": True, "results": results, "note": ""}
    except (HTTPError, URLError, ValueError, KeyError, IndexError) as exc:
        return {"configured": True, "results": [], "note": f"Erreur Graph API : {exc}"}
