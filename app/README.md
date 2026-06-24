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

## Mot de passe d'accès

Dès que l'app est accessible depuis l'extérieur (cloud, ou même Tailscale), protège-la avec un mot de passe : ajoute dans `.env` :

```
APP_USERNAME=michel
APP_PASSWORD=choisis-un-mot-de-passe-solide
```

Sans ça, l'app demande l'authentification HTTP de base avant chaque page/requête. Sans ces variables, elle reste accessible sans mot de passe (acceptable seulement si rien d'autre que toi ne peut l'atteindre).

## Hébergement cloud permanent (Fly.io) — recommandé

Pas besoin de garder un ordinateur allumé : l'app tourne sur un serveur Fly.io 24/7, avec stockage persistant (SQLite + fichiers survivent aux redéploiements). Le palier gratuit de Fly.io couvre largement un usage personnel à faible trafic comme celui-ci, mais une carte de crédit est requise à l'inscription (facturé seulement en cas de dépassement — improbable ici).

1. **Installe flyctl** : `curl -L https://fly.io/install.sh | sh`
2. **Crée un compte / connecte-toi** : `fly auth signup` (ou `fly auth login` si tu en as déjà un)
3. Depuis `app/`, **lance le déploiement** (le `fly.toml` fourni configure déjà le port, le volume persistant et le HTTPS) :
   ```bash
   cd app
   fly launch --copy-config --name ton-nom-d-app-unique --no-deploy
   ```
   Si le nom `michel-bibliotheque` du `fly.toml` est déjà pris par quelqu'un d'autre, `--name` te permet d'en choisir un autre — sinon tu peux laisser `fly launch` te le proposer.
4. **Crée le volume persistant** (1 Go suffit largement pour des screenshots/documents) :
   ```bash
   fly volumes create data --region yyz --size 1
   ```
5. **Configure tes secrets** (ne vont jamais dans le code, uniquement sur Fly) :
   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ton-cle
   fly secrets set APP_USERNAME=michel APP_PASSWORD=ton-mot-de-passe
   ```
   Ajoute aussi `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`/`DRIVE_FOLDER_ID` en secrets si tu utilises l'import Drive (section plus bas).
6. **Déploie** :
   ```bash
   fly deploy
   ```
7. Ton app est en ligne sur `https://ton-nom-d-app-unique.fly.dev`. Ouvre cette URL sur ton téléphone (Chrome sur Android, Safari sur iPhone), connecte-toi avec ton mot de passe, puis **Android** : menu ⋮ → "Ajouter à l'écran d'accueil" pour pouvoir utiliser le bouton **Partager** depuis n'importe quelle app.

**Note** : le dossier surveillé (`watched/`) n'a pas de sens sur Fly.io — il n'y a pas de dossier local à surveiller sur un serveur cloud. Pour ajouter des fichiers depuis ton ordinateur, utilise l'upload web ou l'import Google Drive ; depuis ton téléphone, utilise le bouton Partager.

### Alternative : sur ton propre ordinateur via Tailscale

Si tu préfères garder les fichiers chez toi plutôt que sur un serveur cloud tiers :

1. Lance l'app localement (`npm start`, voir Installation ci-dessus) sur une machine que tu laisses allumée.
2. Installe [Tailscale](https://tailscale.com/download) sur cette machine et sur ton téléphone (même compte des deux côtés).
3. Sur la machine, lance `tailscale serve https / http://localhost:3000` → tu obtiens une URL du type `https://ton-pc.ton-tailnet.ts.net`, accessible depuis ton téléphone même hors wifi.
4. Pour tester vite sans rien installer : `npx ngrok http 3000` (URL temporaire, change à chaque relance).

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
Dockerfile       Image pour déploiement cloud (Fly.io)
fly.toml         Configuration de déploiement Fly.io
```

## Limites connues (MVP)

- Types de fichiers supportés pour l'analyse de contenu : images (png/jpg/gif/webp), PDF, texte (.txt/.md). Les autres types sont catégorisés par nom de fichier uniquement.
- Images limitées à ~4.5 Mo pour l'analyse vision (limite API Claude).
- Authentification HTTP basique uniquement (un seul couple identifiant/mot de passe pour toute l'app, voir section "Mot de passe d'accès") — suffisant pour un usage solo, pas pour plusieurs comptes.
