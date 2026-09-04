#!/usr/bin/env python3
"""Image-to-video: une image + un prompt positif + un prompt negatif -> un MP4.

Un seul CLI, plusieurs fournisseurs. Chaque adaptateur traduit les memes
arguments vers l'API du fournisseur, attend la fin du job et telecharge le
resultat.

    python3 video/img2video.py --image photo.png \
        --prompt "camera qui recule lentement, lumiere douce" \
        --negative "flou, texte, mains deformees" \
        --provider replicate --model kwaivgi/kling-v1.6-standard \
        --duration 5 --aspect 9:16 --out out/clip.mp4

Cles d'API lues dans l'environnement:
    replicate -> REPLICATE_API_TOKEN
    fal       -> FAL_KEY
    veo       -> GEMINI_API_KEY

Deux modes sans reseau ni cle, utiles pour preparer le terrain:
    --dry-run  affiche la requete exacte qui serait envoyee
    --check    teste seulement la joignabilite du fournisseur
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

TIMEOUT = 120
POLL_EVERY = 5


# --------------------------------------------------------------------------
# HTTP (stdlib: urllib respecte HTTPS_PROXY tout seul)
# --------------------------------------------------------------------------


class ApiError(RuntimeError):
    pass


def request(method, url, headers=None, body=None, raw=False):
    data = None
    headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            payload = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        raise ApiError(f"HTTP {exc.code} sur {url}\n{detail}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(
            f"Connexion impossible vers {url}: {exc.reason}\n"
            "Si c'est un refus du proxy, le domaine n'est pas autorise par la "
            "politique reseau de cet environnement."
        ) from exc

    return payload if raw else json.loads(payload or b"{}")


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def download(url: str, out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(request("GET", url, raw=True))
    return out


# --------------------------------------------------------------------------
# Adaptateurs
# --------------------------------------------------------------------------


class Provider:
    """Base commune. Un adaptateur = construire la requete, puis attendre."""

    name = ""
    host = ""
    env_key = ""
    default_model = ""

    def __init__(self, args):
        self.args = args
        self.token = os.environ.get(self.env_key, "")
        self.model = args.model or self.default_model

    def require_token(self):
        if not self.token:
            raise SystemExit(
                f"Cle absente: exporte {self.env_key} avant de lancer "
                f"(fournisseur '{self.name}')."
            )

    def plan(self, image: Path) -> dict:
        """Requete exacte, sans l'envoyer. Utilise par --dry-run."""
        raise NotImplementedError

    def run(self, image: Path) -> str:
        """Lance le job, attend, retourne l'URL de la video."""
        raise NotImplementedError

    def redacted(self, plan: dict) -> dict:
        shown = json.loads(json.dumps(plan))
        for key in list(shown.get("headers", {})):
            if key.lower() in {"authorization", "x-key", "x-goog-api-key"}:
                shown["headers"][key] = "<masque>"
        _shorten_images(shown.get("body"))
        return shown


def _shorten_images(node):
    """Remplace les blobs base64 par un marqueur pour un affichage lisible."""
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(value, str) and (
                value.startswith("data:image") or len(value) > 500
            ):
                node[key] = f"<image base64, {len(value)} caracteres>"
            else:
                _shorten_images(value)
    elif isinstance(node, list):
        for item in node:
            _shorten_images(item)


class Replicate(Provider):
    """Passerelle vers Kling, Wan, SVD... Le slug decide du modele reel."""

    name = "replicate"
    host = "https://api.replicate.com"
    env_key = "REPLICATE_API_TOKEN"
    default_model = "kwaivgi/kling-v1.6-standard"

    def plan(self, image):
        payload = {
            self.args.image_field: data_uri(image),
            "prompt": self.args.prompt,
            "negative_prompt": self.args.negative,
            "duration": self.args.duration,
            "aspect_ratio": self.args.aspect,
        }
        payload.update(self.args.extra)
        return {
            "method": "POST",
            "url": f"{self.host}/v1/models/{self.model}/predictions",
            "headers": {
                "Authorization": f"Bearer {self.token}",
                "Prefer": "wait=60",
            },
            "body": {"input": {k: v for k, v in payload.items() if v not in (None, "")}},
        }

    def run(self, image):
        plan = self.plan(image)
        job = request(plan["method"], plan["url"], plan["headers"], plan["body"])

        while job.get("status") in {"starting", "processing"}:
            time.sleep(POLL_EVERY)
            print(f"  ... {job['status']}", flush=True)
            job = request("GET", job["urls"]["get"], plan["headers"])

        if job.get("status") != "succeeded":
            raise ApiError(f"Job {job.get('status')}: {job.get('error')}")

        output = job["output"]
        return output[-1] if isinstance(output, list) else output


class Fal(Provider):
    name = "fal"
    host = "https://queue.fal.run"
    env_key = "FAL_KEY"
    default_model = "fal-ai/kling-video/v1.6/standard/image-to-video"

    def plan(self, image):
        payload = {
            "image_url": data_uri(image),
            "prompt": self.args.prompt,
            "negative_prompt": self.args.negative,
            "duration": str(self.args.duration),
            "aspect_ratio": self.args.aspect,
        }
        payload.update(self.args.extra)
        return {
            "method": "POST",
            "url": f"{self.host}/{self.model}",
            "headers": {"Authorization": f"Key {self.token}"},
            "body": {k: v for k, v in payload.items() if v not in (None, "")},
        }

    def run(self, image):
        plan = self.plan(image)
        job = request(plan["method"], plan["url"], plan["headers"], plan["body"])
        status_url, result_url = job["status_url"], job["response_url"]

        while True:
            status = request("GET", status_url, plan["headers"])
            state = status.get("status")
            if state == "COMPLETED":
                break
            if state in {"FAILED", "CANCELLED"}:
                raise ApiError(f"Job {state}: {json.dumps(status)[:400]}")
            print(f"  ... {state}", flush=True)
            time.sleep(POLL_EVERY)

        result = request("GET", result_url, plan["headers"])
        return result["video"]["url"]


class Veo(Provider):
    """Google Veo via l'API Gemini (operation longue + polling)."""

    name = "veo"
    host = "https://generativelanguage.googleapis.com"
    env_key = "GEMINI_API_KEY"
    default_model = "veo-3.0-generate-001"

    def plan(self, image):
        mime = mimetypes.guess_type(image.name)[0] or "image/png"
        parameters = {
            "negativePrompt": self.args.negative,
            "aspectRatio": self.args.aspect,
        }
        parameters.update(self.args.extra)
        return {
            "method": "POST",
            "url": f"{self.host}/v1beta/models/{self.model}:predictLongRunning",
            "headers": {"x-goog-api-key": self.token},
            "body": {
                "instances": [
                    {
                        "prompt": self.args.prompt,
                        "image": {
                            "bytesBase64Encoded": base64.b64encode(
                                image.read_bytes()
                            ).decode(),
                            "mimeType": mime,
                        },
                    }
                ],
                "parameters": {
                    k: v for k, v in parameters.items() if v not in (None, "")
                },
            },
        }

    def run(self, image):
        plan = self.plan(image)
        op = request(plan["method"], plan["url"], plan["headers"], plan["body"])

        while not op.get("done"):
            time.sleep(POLL_EVERY)
            print("  ... generation en cours", flush=True)
            op = request("GET", f"{self.host}/v1beta/{op['name']}", plan["headers"])

        if "error" in op:
            raise ApiError(json.dumps(op["error"])[:400])

        video = op["response"]["generateVideoResponse"]["generatedSamples"][0]["video"]
        return f"{video['uri']}&key={self.token}" if "key=" not in video["uri"] else video["uri"]


PROVIDERS = {p.name: p for p in (Replicate, Fal, Veo)}


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def key_value(text: str):
    if "=" not in text:
        raise argparse.ArgumentTypeError(f"attendu cle=valeur, recu '{text}'")
    key, value = text.split("=", 1)
    try:
        return key, json.loads(value)
    except json.JSONDecodeError:
        return key, value


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Genere une video a partir d'une image et de deux prompts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--image", type=Path, help="image de depart (png/jpg/webp)")
    parser.add_argument("--prompt", default="", help="prompt positif")
    parser.add_argument("--negative", default="", help="prompt negatif")
    parser.add_argument(
        "--provider", choices=sorted(PROVIDERS), default="replicate"
    )
    parser.add_argument("--model", help="slug du modele (defaut selon fournisseur)")
    parser.add_argument("--duration", type=int, default=5, help="duree en secondes")
    parser.add_argument("--aspect", default="16:9", help="16:9, 9:16 ou 1:1")
    parser.add_argument("--out", type=Path, default=Path("out/clip.mp4"))
    parser.add_argument(
        "--image-field",
        default="start_image",
        help="nom du champ image cote Replicate (start_image, image, input_image...)",
    )
    parser.add_argument(
        "--extra",
        type=key_value,
        action="append",
        default=[],
        metavar="CLE=VALEUR",
        help="parametre supplementaire passe tel quel au modele",
    )
    parser.add_argument("--dry-run", action="store_true", help="montre la requete")
    parser.add_argument("--check", action="store_true", help="teste la joignabilite")

    args = parser.parse_args(argv)
    args.extra = dict(args.extra)
    return args


def check(provider: Provider) -> int:
    print(f"Fournisseur : {provider.name}")
    print(f"Cle {provider.env_key} : {'presente' if provider.token else 'ABSENTE'}")
    try:
        request("GET", provider.host + "/", raw=True)
    except ApiError as exc:
        message = str(exc)
        reachable = "HTTP" in message.split("\n")[0]
        print(f"Reseau vers {provider.host} : {'joignable' if reachable else 'BLOQUE'}")
        if not reachable:
            print(f"  {message.splitlines()[0]}")
            return 1
    else:
        print(f"Reseau vers {provider.host} : joignable")
    return 0 if provider.token else 1


def main(argv=None) -> int:
    args = parse_args(argv)
    provider = PROVIDERS[args.provider](args)

    if args.check:
        return check(provider)

    if not args.image:
        raise SystemExit("--image est requis (sauf avec --check)")
    if not args.image.is_file():
        raise SystemExit(f"Image introuvable: {args.image}")

    if args.dry_run:
        print(json.dumps(provider.redacted(provider.plan(args.image)), indent=2))
        return 0

    provider.require_token()
    print(f"Modele  : {provider.name} / {provider.model}")
    print(f"Image   : {args.image}  ({args.image.stat().st_size / 1024:.0f} Ko)")
    print(f"Positif : {args.prompt or '(vide)'}")
    print(f"Negatif : {args.negative or '(vide)'}")

    url = provider.run(args.image)
    path = download(url, args.out)
    print(f"OK -> {path}  ({path.stat().st_size / 1024:.0f} Ko)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ApiError as error:
        print(f"Erreur: {error}", file=sys.stderr)
        sys.exit(1)
