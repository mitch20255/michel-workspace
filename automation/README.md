# 🤖 Capture automatique — Le guide

> Objectif : **tu consommes, ça se range tout seul.** Tu ne t'envoies rien à la main.
> Pendant que tu dors, GitHub Actions ramasse ce que tu as regardé/lu et écrit des notes
> propres dans le vault Obsidian. Zéro serveur à héberger.

---

## ⚠️ La vérité technique (lis ça, c'est important)

Le rêve « ça capture TOUT ce que je regarde sans que je fasse rien » se heurte à un mur
réel : **les plateformes ne donnent pas accès à ton historique de visionnage.**

- **YouTube** : l'API **ne donne pas** l'historique de ce que tu as *regardé* (supprimé par
  Google pour la vie privée). Ce qui EST accessible : tes vidéos **likées** 👍.
- **Instagram / Facebook** : pas d'API pour tes *saved/likes* perso.
- **Historique de navigateur** : local à ta machine, pas exposé.

👉 **La solution intelligente : un seul geste universel = « like / save ».**
Tu likes une vidéo YouTube, tu ❤️ un post Insta, tu sauvegardes un article → **ça devient
le signal de capture.** C'est quasi sans friction (1 tap) et ça marche partout. Tu m'as dit
que tu pouvais mettre les trucs dans des listes/saves — c'est exactement ce qu'on exploite.

Résultat : **automatique après le tap.** Le reste (récupérer, résumer, tagger, classer,
écrire la note, synchroniser) est 100 % auto.

---

## 🗺️ L'architecture (tout dans GitHub, rien à héberger)

```
   TON GESTE            DÉCLENCHEUR             MOTEUR (GitHub Actions)          VAULT
┌────────────────┐   ┌──────────────────┐   ┌───────────────────────────┐   ┌──────────┐
│ 👍 Like YouTube │   │ Cron nocturne     │   │ capture.mjs :             │   │ note .md  │
│                │──▶│ (chaque nuit 4h)  │──▶│  1. va chercher le neuf    │──▶│ dans      │
│ 💾 Save Readwise│   │                   │   │  2. Jina lit le contenu    │   │ 01-Sources│
├────────────────┤   ├──────────────────┤   │  3. Claude résume+tag+range│   │           │
│ ❤️ Like Insta   │   │ repository_dispatch│   │  4. écrit la note Markdown │   │ Obsidian  │
│ 📌 Save FB      │──▶│ (IFTTT/Zapier POST)│──▶│                           │   │ Git pull  │
│ 🔗 N'importe quoi│   │  = instantané     │   │  5. git commit + push      │   │ (auto)    │
└────────────────┘   └──────────────────┘   └───────────────────────────┘   └──────────┘
```

Deux workflows :
- **`second-brain-capture.yml`** — nocturne, ramasse YouTube likés + Readwise. Passif.
- **`second-brain-ingest.yml`** — instantané, capture UNE URL envoyée par IFTTT/Zapier/partage.

Le cerveau des deux : **`capture.mjs`** (un seul fichier, aucune dépendance).

---

## ✅ Ta checklist de démarrage (~15 min, à faire au réveil)

Fais-les dans l'ordre. Chaque bloc est indépendant : configure ce que tu veux, saute le reste.

### 0. Activer les workflows (obligatoire, 1 min)
Les workflows planifiés ne tournent **que depuis `main`**. Merge la branche
`claude/cortex-project-location-3xg81m` dans `main` (ou ouvre la PR et merge).

### 1. Clé Claude (obligatoire, 2 min) — le résumeur
`Settings → Secrets and variables → Actions → New repository secret`
- `ANTHROPIC_API_KEY` = ta clé Anthropic (tu l'as déjà pour Cortex).
- *(optionnel)* Variable `ANTHROPIC_MODEL` (onglet **Variables**) — défaut `claude-haiku-4-5-20251001`
  (rapide + pas cher, idéal pour du volume ; mets un Sonnet si tu veux plus de profondeur).
- *(optionnel)* Variable `PROJECTS` = `Parenting,La Fabrique / IA` (les projets que Claude
  peut rattacher ; le tag = version « slug » du nom).

### 2. Articles → le plus simple (5 min) — **commence par ça**
**Readwise Reader** est la voie royale : son extension navigateur + app mobile te laissent
**save** un article/vidéo en 1 tap, et tout arrive ici.
- Crée un compte Readwise Reader, prends ton token : https://readwise.io/access_token
- Secret `READWISE_TOKEN` = ce token.
- Désormais : *Save to Reader* sur un article → note auto la nuit suivante. ✅

### 3. YouTube likés (10 min) — un peu plus technique
Suis **`get-youtube-refresh-token.md`** (pas à pas). Tu obtiendras 3 valeurs à mettre en secrets :
`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.
Ensuite : tu **likes** une vidéo → note auto la nuit suivante. ✅

### 4. Instagram / Facebook / le reste (instantané) — via IFTTT ou Zapier
Suis **`ingest-recipes.md`**. En gros : « quand je like un post Insta → POST vers GitHub ».
Marche pour Insta, FB, X, un raccourci iOS *Partager*, un bookmarklet… Tout ce qui peut
faire un webhook peut nourrir le cerveau. ✅

### 5. Tester tout de suite (optionnel)
`Actions → Second Brain — Capture nocturne → Run workflow`. Ça tourne à la demande.

---

## 🔁 Boucle de sync Obsidian
Le moteur écrit les `.md` dans le repo. Pour les voir dans Obsidian sur tous tes appareils :
installe le plugin **Obsidian Git** et active le *pull* auto (toutes les 10 min par ex.).
Sur mobile : Obsidian + plugin Git, ou le vault dans un dossier synchronisé.

## 🧪 Tester en local (pour bidouiller)
```bash
export ANTHROPIC_API_KEY=sk-ant-...
node automation/capture.mjs --url "https://www.youtube.com/watch?v=XXXX"   # capture une URL
node automation/capture.mjs                                                  # mode batch
```

## 💸 Coût
Claude Haiku sur du texte tronqué à ~12k car. : **quelques centimes par jour** même avec
20-30 captures/jour. Jina Reader : gratuit à faible volume (ajoute `JINA_API_KEY` en secret
si tu montes en volume). GitHub Actions : gratuit pour ce niveau d'usage.

## 🔗 Passerelle avec Cortex (optionnel)
Ton n8n Cortex peut aussi nourrir ce cerveau : ajoute un nœud HTTP qui POST vers le même
`repository_dispatch` (voir `ingest-recipes.md`). Un cerveau, plusieurs sources.
