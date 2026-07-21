# 📍 Activités à Montréal

Une petite base de données + frontend pour créer des **fiches d'activités** à faire
autour ou dans Montréal : celles que tu repères sur Instagram, ou n'importe où ailleurs.

- **Backend** : Flask + SQLite (aucune configuration lourde, un seul fichier de base).
- **Frontend** : une page unique, cartes filtrables, ajout/édition en modale.
- **Instagram** : import par lien **conforme aux règles de Meta** (voir plus bas).

![aperçu](docs/preview.png)

## 🚀 Démarrage

```bash
cd montreal-activites
python3 -m venv .venv && source .venv/bin/activate   # facultatif
pip install -r requirements.txt
python seed.py        # (facultatif) quelques activités d'exemple
python app.py         # → http://127.0.0.1:5000
```

Ouvre http://127.0.0.1:5000 dans ton navigateur.

## 🗂️ Modèle de fiche

Chaque activité contient : titre, description, catégorie, quartier, adresse, prix,
dates (début/fin), tags, compte/source, note (0–5), lien source, image, notes perso
et un **statut** (`À faire`, `Favori`, `Fait`, `Archivé`).

Recherche plein-texte + filtres par catégorie et statut. Clic sur ♥ pour basculer
une fiche en favori.

## 📸 Instagram — ce qui est permis (et ce qui ne l'est pas)

> **Le scraping d'Instagram est interdit** par les conditions d'utilisation de Meta.
> Cette app ne fait **aucun scraping**. Deux voies légitimes sont prévues :

### 1. Import par lien (oEmbed officiel) — dispo tout de suite
Colle l'URL d'un post (`/p/`, `/reel/` ou `/tv/`). L'app pré-remplit la fiche.
Pour récupérer la **miniature + l'aperçu officiel**, configure un jeton Meta :

```bash
export META_ACCESS_TOKEN="ton_jeton_meta"
```

Sans jeton, le lien est simplement enregistré et tu complètes la fiche à la main
(toujours 100% fonctionnel).

### 2. Recherche par hashtag (Instagram Graph API) — optionnel
Voie officielle pour trouver des posts publics par hashtag (ex. `#mtlmoments`).
Elle est **encadrée et limitée** par Meta :

- nécessite un compte **Business/Creator** lié à une **app Facebook validée** ;
- permissions requises (app review) ;
- ~**30 hashtags / 7 jours**, posts **publics** seulement, **pas d'infos auteur**.

Configuration :

```bash
export META_ACCESS_TOKEN="ton_jeton_meta"
export IG_BUSINESS_USER_ID="id_de_ton_compte_ig_business"
```

Endpoint : `GET /api/instagram/search?q=mtlmoments`

> Il n'existe **aucun** moyen conforme d'aspirer automatiquement « des centaines »
> de posts de comptes tiers. Le flux réaliste et durable : tu repères un post,
> tu colles le lien, tu enrichis la fiche.

## 🔌 API

| Méthode | Route | Rôle |
|--------|-------|------|
| GET | `/api/activities` | Liste + filtres (`search`, `category`, `status`, `tag`) |
| POST | `/api/activities` | Créer |
| GET | `/api/activities/<id>` | Détail |
| PUT | `/api/activities/<id>` | Modifier |
| DELETE | `/api/activities/<id>` | Supprimer |
| POST | `/api/instagram/preview` | Aperçu oEmbed d'une URL de post |
| GET | `/api/instagram/search?q=<hashtag>` | Recherche hashtag (Graph API) |

## 🧱 Structure

```
montreal-activites/
├── app.py            # Flask : API + sert le frontend
├── db.py             # SQLite : schéma + CRUD
├── instagram.py      # oEmbed + Graph API (conforme Meta)
├── seed.py           # données d'exemple
├── requirements.txt
└── static/           # index.html, styles.css, app.js
```

## 🗺️ Pistes d'amélioration
- Vue carte (lat/lng déjà envisageables).
- Export CSV / partage de listes.
- Rappels sur les événements datés.
