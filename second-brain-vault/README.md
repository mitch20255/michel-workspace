# 🧠 Second Brain — Vault Obsidian

> Le **cerveau de connaissance** de Mitch. Complément de **Cortex** (le cerveau *exécutif*).
> Cortex transforme tes pensées en **actions** (Asana). Ce vault transforme ce que tu
> **consommes** (Instagram, articles, YouTube, journal…) en une **base de connaissance
> organisée, cherchable et orientée projets**.

---

## En 30 secondes

```
   TU CONSOMMES              CAPTURE            CLAUDE TRIAGE           OBSIDIAN
┌──────────────────┐      ┌──────────┐      ┌────────────────┐    ┌──────────────┐
│ 📸 Post Instagram │      │ Telegram │      │ Résume          │    │ 1 note .md    │
│ 📰 Article/journal│ ───▶ │   bot    │ ───▶ │ Tag + catégorise│──▶ │ + liens vers  │
│ ▶️  Vidéo YouTube │      │ (partage)│      │ Rattache projet │    │   les projets │
└──────────────────┘      └──────────┘      └────────────────┘    └──────────────┘
                                                                          │
                                                                          ▼
                                              PROJET (ex. Parenting) = MOC qui agrège
                                              automatiquement toutes les notes tagguées,
                                              + une VEILLE continue qui reste à jour.
```

---

## Comment c'est rangé (méthode PARA + couche Sources)

| Dossier | Rôle |
|---|---|
| `00-Inbox/` | 📥 Captures brutes, non traitées. Le point d'entrée. |
| `01-Sources/` | 📚 Une note atomique par contenu consommé (article, vidéo, post…). |
| `02-Projects/` | 🎯 Projets actifs à échéance (ex. *Parenting*). Chaque projet a une **MOC**. |
| `03-Areas/` | ♾️ Domaines permanents sans date de fin (ex. Santé, Business, Famille). |
| `04-Resources/` | 🧰 Références evergreen réutilisables (frameworks, templates de pensée). |
| `05-Archive/` | 🗄️ Projets terminés (« dossier closé »). |
| `_templates/` | 🧩 Modèles de notes (à brancher au plugin *Templater*). |
| `_system/` | ⚙️ Doc du système : architecture, automatisation, taxonomie. |

**Règle mentale :** *Inbox → je traite → ça devient une Source → la Source est reliée à un ou plusieurs Projets/Areas.*

---

## Ta première demi-heure

1. Ouvre ce dossier comme **vault** dans Obsidian (*Open folder as vault*).
2. Installe 3 plugins communautaires : **Dataview**, **Templater**, **Obsidian Git** (pour la sync).
3. Lis `_system/Architecture.md` (5 min) — la logique complète.
4. Ouvre `02-Projects/Parenting/Parenting - MOC.md` — l'exemple déjà monté.
5. **Pour la capture 100 % automatique → va dans [`../automation/`](../automation/README.md)**
   (moteur GitHub Actions déjà livré : tu likes/saves, ça se range tout seul la nuit).

---

## Le principe qui fait tout marcher

Chaque note-source porte des **métadonnées** (frontmatter YAML) : `category`, `tags`,
`projets`, `type`, `date`. Les **MOC de projet** ne recopient rien — elles **interrogent**
le vault avec Dataview (« montre-moi toutes les notes taggées `#parenting` triées par
date »). Donc dès qu'une nouvelle capture arrive avec le bon tag, **elle apparaît
automatiquement dans le bon projet**. C'est ça, la veille qui « reste à jour toute seule ».
