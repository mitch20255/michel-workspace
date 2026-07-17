# 🧠 BRAIN — Le cerveau centralisé de Michel

> **Point d'entrée unique.** N'importe quel agent IA (ou Michel) commence ici.
> Ce fichier dit où tout se trouve et comment le système pense.

**Dernière mise à jour :** 2026-07-17

---

## C'est quoi ce système

Ce repo EST le cerveau. Pas une app, pas un service externe — du Markdown versionné
dans git. Portable, lisible par n'importe quel agent, jamais perdu. C'est la
**source de vérité unique** que tous les agents (Heartbeat, Nexus, moi) lisent avant d'agir.

Trois missions :
1. **Cloner la façon de penser de Michel** → `brain/IDENTITY.md` + `brain/decisions/`
2. **Ne rien perdre, tout retrouver** → `capture/` + `memory/` + `brain/knowledge/`
3. **Piloter le business** → `brain/people/` + `brain/projects/`

---

## Carte du cerveau

| Quand tu veux... | Va dans... |
|------------------|-----------|
| Savoir QUI est Michel (voix, valeurs, décisions) | `brain/IDENTITY.md` |
| Comprendre POURQUOI une décision a été prise | `brain/decisions/` |
| Un savoir par domaine (sales, AI, marché QC) | `brain/knowledge/` |
| Infos sur un prospect / client / contact | `brain/people/` |
| L'état vivant d'un projet ou client | `brain/projects/` |
| Ce qui s'est passé un jour donné | `memory/daily/` |
| Retrouver n'importe quoi vite | `memory/INDEX.md` |
| Balancer une idée / info en vrac (à trier après) | `capture/inbox.md` |
| Les règles de classement automatique | `system/ROUTER.md` |
| Le mode autonome (agent qui travaille seul) | `system/HEARTBEAT.md` |
| Le playbook business complet | `SKILL.md` + `references/` |
| La spec de l'app second-brain | `NEXUS_VIBE_CODING.md` |

---

## Règle d'or pour tout agent

Avant d'agir **au nom de Michel** :
1. Lis `brain/IDENTITY.md` — pour parler et décider comme lui.
2. Vérifie `brain/decisions/` — pour ne pas contredire un choix déjà fait.
3. Consulte le `brain/projects/` ou `brain/people/` pertinent — pour le contexte à jour.

Après avoir agi :
1. Note ce qui s'est passé dans `memory/daily/AAAA-MM-JJ.md`.
2. Si une vraie décision a été prise → nouveau fichier dans `brain/decisions/`.
3. Si du neuf est appris → mets à jour `brain/knowledge/` ou `brain/people/`.

---

## Comment ça grandit

Rien de rigide. Le flux normal :

```
Une idée arrive  →  capture/inbox.md  (5 secondes, pas de rangement)
       ↓ (plus tard, toi ou un agent trie)
   system/ROUTER.md décide où ça va
       ↓
brain/knowledge  |  brain/people  |  brain/projects  |  brain/decisions
```

Le seul travail discipliné : **vider l'inbox régulièrement**. Le reste se range tout seul via le ROUTER.
