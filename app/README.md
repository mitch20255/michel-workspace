# Bibliothèque centralisée

App web auto-hébergée pour stocker screenshots, documents et images dans une base de données unique, avec **catégorisation automatique par IA** (Claude vision + texte).

## Fonctionnalités

- 📥 **3 façons d'ajouter des fichiers** :
  - Glisser-déposer / bouton "Ajouter" dans l'interface web
  - **Dossier surveillé** : tout fichier déposé dans `watched/` est importé automatiquement
  - **Import Google Drive** : synchronise les nouveaux fichiers d'un dossier Drive
  - **Partage depuis le téléphone** (Android) : installe l'app sur l'écran d'accueil, puis utilise le bouton "Partager" de n'importe quelle app
- 🤖 **Catégorisation automatique** : chaque fichier est analysé par Claude (catégorie, tags, description, texte détecté/OCR)
- 🔍 Recherche et filtrage par catégorie
- 🗄️ Stockage local (SQLite), rien ne quitte ta machine sauf l'appel à l'API Claude pour l'analyse

## Installation

```bash
cd app
npm install
cp .env.example .env
```

Édite `.env` et ajoute au minimum ta clé `ANTHROPIC_API_KEY` (https://console.anthropic.com/settings/keys).

```bash
npm start
```

Ouvre http://localhost:3000

## Accès depuis ton téléphone (Tailscale, recommandé)

L'app doit tourner sur une machine que tu contrôles (ton PC/Mac, un Raspberry Pi, un petit serveur...) — elle ne peut pas rester sur un environnement cloud éphémère type ce sandbox Claude. Une fois sur ta machine, **Tailscale** est le plus simple pour y accéder depuis ton téléphone avec une vraie URL HTTPS (nécessaire pour installer le PWA et utiliser le bouton Partager) :

1. **Récupère le code sur ta machine** (celle qui restera allumée) :
   ```bash
   git clone https://github.com/mitch20255/michel-workspace.git
   cd michel-workspace
   git checkout claude/centralized-data-db-rhuy5n
   cd app
   npm install
   cp .env.example .env   # puis ajoute ANTHROPIC_API_KEY
   npm start
   ```
2. **Installe Tailscale** sur cette machine et sur ton téléphone : https://tailscale.com/download — connecte les deux avec le même compte (Google/GitHub/email).
3. Sur la machine qui fait tourner l'app, active le partage HTTPS :
   ```bash
   tailscale serve https / http://localhost:3000
   ```
   Tailscale te donne une URL du type `https://ton-pc.ton-tailnet.ts.net`.
4. Sur ton téléphone, ouvre cette URL dans Chrome (Android) ou Safari (iPhone) — l'app est maintenant accessible de partout, même hors de ton wifi.
5. **Android** : menu ⋮ → "Ajouter à l'écran d'accueil" → utilise ensuite le bouton **Partager** de n'importe quelle app pour envoyer un fichier directement dans ta bibliothèque (voir section suivante).
6. **iPhone** : ajoute l'URL à l'écran d'accueil (bouton Partager → "Sur l'écran d'accueil") pour y accéder comme une app, mais le partage direct depuis d'autres apps ne fonctionne pas (voir limitation iOS ci-dessous).

**Pour juste tester rapidement sans Tailscale** : `npx ngrok http 3000` te donne une URL HTTPS temporaire (change à chaque relance, gratuite, suffisant pour un essai).

**Pour un accès permanent sans garder un ordinateur personnel allumé 24/7** : déploie l'app sur un petit serveur cloud toujours actif (Railway, Render, Fly.io...) — demande-moi si tu veux le faire, ça change le stockage des fichiers (il faudra un disque persistant plutôt que le dossier local).

## Dossier surveillé

Par défaut : `app/watched/`. Dépose-y n'importe quel screenshot/document et il sera importé + catégorisé automatiquement en quelques secondes. Change l'emplacement avec `WATCH_DIR=/chemin/vers/ton/dossier` dans `.env` (ex: ton dossier de screenshots macOS/Windows).

## Partage depuis ton téléphone (Android)

Une fois l'app accessible en HTTPS (voir section précédente) et ajoutée à l'écran d'accueil, utilise le bouton **Partager** depuis n'importe quelle app (Photos, navigateur...) → choisis "Bibliothèque centralisée" pour envoyer un fichier directement dans ta bibliothèque.

**Limitation iOS** : Safari/iOS ne supporte pas encore l'API Web Share Target, donc cette méthode ne fonctionne que sur Android. Pour iPhone, deux alternatives :
- Utilise l'app **Raccourcis (Shortcuts)** : crée un raccourci "Partager" qui fait un `POST` du fichier vers `https://ton-serveur/api/share` (action "Obtenir le contenu de l'URL")
- Mets tes screenshots dans un dossier Google Drive synchronisé automatiquement par ton iPhone, et utilise l'import Drive ci-dessous

## Import Google Drive

1. Crée des identifiants OAuth dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials) : type "Application de bureau"
2. Renseigne `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env`
3. Lance :
   ```bash
   npm run drive:auth
   ```
   et suis les instructions (ouvre l'URL, autorise, colle le code) — ça génère un `GOOGLE_REFRESH_TOKEN` à ajouter dans `.env`
4. Renseigne `DRIVE_FOLDER_ID` (l'ID dans l'URL du dossier Drive, ex: `drive.google.com/drive/folders/<CET_ID>`)
5. Clique sur le bouton **🔄 Drive** dans l'interface (ou appelle `POST /api/import/drive`) pour synchroniser

## Architecture

```
server/
  index.js       Serveur Express + routes API
  db.js          Schéma et requêtes SQLite (better-sqlite3)
  categorize.js  Appels Claude API (vision pour images, texte pour PDF/txt)
  ingest.js      Logique commune: stocker un fichier + déclencher la catégorisation
  watcher.js     Surveillance du dossier `watched/`
  drive.js       Import Google Drive
  drive-auth.js  Script CLI one-shot pour obtenir le refresh token Drive
public/
  index.html, app.js, style.css   Interface web (galerie, recherche, filtres)
  manifest.json, sw.js            PWA + Web Share Target (Android)
data/
  library.db     Base SQLite (créée automatiquement)
  files/         Fichiers stockés
watched/         Dossier surveillé pour l'import automatique
```

## Limites connues (MVP)

- Types de fichiers supportés pour l'analyse de contenu : images (png/jpg/gif/webp), PDF, texte (.txt/.md). Les autres types sont catégorisés par nom de fichier uniquement.
- Images limitées à ~4.5 Mo pour l'analyse vision (limite API Claude).
- Pas d'authentification — à n'exposer publiquement que derrière un reverse proxy avec login (ex: Tailscale, Caddy + auth basique).
