# 🤖 Automatisation de la capture (réutilise Cortex)

> ✅ **La solution LIVRÉE et prête à brancher est dans `../../automation/`** (moteur
> GitHub Actions, aucun serveur). Lis **`automation/README.md`** en premier — c'est le
> système réel, avec sa checklist de 15 min. Le contenu ci-dessous décrit l'**alternative
> n8n** (utile si tu préfères tout garder dans n8n comme Cortex).

Objectif : partager un contenu depuis ton téléphone → 30 s plus tard une note propre
existe dans le vault. On **clone la logique de Cortex** en changeant la destination.

## Vue d'ensemble

```
 SOURCE            CANAL DE CAPTURE        n8n                      DESTINATION
┌────────────┐    ┌───────────────┐   ┌──────────────────┐    ┌─────────────────┐
│ 📸 Instagram│    │  Partager →   │   │ Telegram Trigger │    │ GitHub API :     │
│ 📰 Article  │──▶ │  Telegram bot │──▶│ Fetch contenu    │──▶ │ créer <note>.md  │
│ ▶️ YouTube  │    │ (2e bot ou    │   │ Claude → JSON    │    │ dans 01-Sources/ │
│ ✍️ Journal  │    │  même Cortex) │   │ Formate Markdown │    │ (le repo = vault)│
└────────────┘    └───────────────┘   └──────────────────┘    └─────────────────┘
                                                                        │
                                              Obsidian Git plugin ◀─────┘  (pull auto)
```

## Étape par étape

### 1. Le canal : Telegram (comme Cortex)
Le plus simple : **un 2e bot Telegram** « Knowledge » (ou une commande `/save` sur le bot
Cortex existant). Sur mobile, `Partager → Telegram → bot`. Ça marche pour :
- **Instagram** : *Partager le post → Telegram* (le lien + la légende partent au bot).
- **YouTube** : *Partager → Telegram* (le lien suffit, n8n récupère le transcript).
- **Article** : *Partager l'URL → Telegram*.
- **Journal / pensée** : tu écris ou tu envoies un vocal (Cortex gère déjà le vocal).

### 2. Récupérer le contenu (nouveaux nœuds n8n)
- **YouTube** → nœud HTTP vers une API de transcript (ex. `youtube-transcript`) pour donner
  le texte à Claude.
- **Article** → nœud HTTP + extracteur de lisibilité (ex. Readability / Jina Reader
  `https://r.jina.ai/<url>`) pour récupérer le texte propre.
- **Instagram** → la légende arrive avec le partage ; pour le visuel, garde juste l'URL.

### 3. Claude analyse (réutilise le nœud Cortex, prompt différent)
Remplace le system prompt « cerveau exécutif » par un **« bibliothécaire »**. Sortie JSON :

```json
{
  "type": "article",
  "title": "Titre clair et descriptif",
  "source": "Nom du média",
  "summary": "2-3 phrases de résumé.",
  "takeaways": ["Apprentissage 1", "Apprentissage 2", "Apprentissage 3"],
  "category": "Parenting",
  "tags": ["parenting", "sommeil"],
  "projets": ["Parenting"],
  "importance": "high"
}
```

### 4. Formater en Markdown
Un nœud *Code* transforme ce JSON en fichier `.md` avec le frontmatter (voir
`_templates/Source-Template.md`). Nom de fichier : `AAAA-MM-JJ - <titre court>.md`.

### 5. Écrire dans le vault
Deux options :

- **A. Le vault EST un repo Git** (recommandé, et c'est déjà le cas ici) → nœud n8n
  **GitHub → Create/Update file** dans `second-brain-vault/01-Sources/<type>/`. Le plugin
  **Obsidian Git** fait un *pull* automatique côté app → la note apparaît sur tous tes
  appareils.
- **B. Obsidian Local REST API** (plugin) → n8n POST direct dans le vault si ton Obsidian
  tourne sur une machine joignable.

### 6. Confirmer sur Telegram
Comme Cortex : *« ✅ Archivé dans 🧠 Parenting — 3 takeaways »*.

## Migrer sans casser Cortex
Cortex archive aujourd'hui dans **Supabase** (`cortex_memories`). Deux choix :
1. **Ajouter une branche** à Cortex : quand `decision = archive` et que c'est du contenu
   *consommé*, écrire AUSSI (ou à la place) une note Obsidian.
2. **Workflow séparé** « Knowledge » dédié à la consommation, et garder Cortex pour l'exécutif.

👉 Recommandation : **workflow séparé**. Cortex reste focalisé sur l'action ; le Second
Brain sur la connaissance. Les deux peuvent partager le même bot et se router selon une
commande (`/todo` vs `/save`).

## ⚠️ Sécurité — à corriger dans Cortex
Le fichier `cortex_n8n_FINAL.json` contient la **clé Supabase en dur** dans les headers
HTTP (`apikey` + `Authorization: Bearer`). C'est la clé `anon` (moins critique que la
`service_role`), mais :
- garde ce JSON **privé** (ne le pousse pas sur un repo public) ;
- vérifie que la **Row Level Security (RLS)** est bien activée sur la table `cortex_memories` ;
- idéalement, stocke la clé dans les **credentials n8n**, pas dans un nœud HTTP en clair.
