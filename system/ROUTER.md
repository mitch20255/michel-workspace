# ROUTER — Où va quoi

> Les règles de classement. Quand une info arrive dans `capture/inbox.md`,
> ceci décide où elle atterrit. Suivi par Michel ou par un agent qui vide l'inbox.

---

## Table de routage

| Si l'info est... | Elle va dans... | Format |
|------------------|-----------------|--------|
| Un contact, prospect ou client | `brain/people/<nom>.md` | 1 fichier par personne/entreprise |
| L'avancement d'un projet ou client | `brain/projects/<projet>.md` | 1 fichier par projet |
| Un savoir réutilisable (script, tactique, leçon) | `brain/knowledge/<domaine>.md` | 1 fichier par domaine |
| Un choix important + son POURQUOI | `brain/decisions/AAAA-MM-JJ-<sujet>.md` | 1 fichier par décision |
| Ce qui s'est passé aujourd'hui | `memory/daily/AAAA-MM-JJ.md` | 1 fichier par jour |
| Un trait de personnalité / voix de Michel | `brain/IDENTITY.md` (mise à jour) | section existante |
| Pas clair / à décider plus tard | reste dans `capture/inbox.md` | — |

## Domaines de knowledge (dossiers suggérés)

- `sales.md` — outbound, discovery, closing (résumé ; détails dans `references/`)
- `marché-quebec.md` — spécificités du marché QC
- `ai-tools.md` — outils IA testés, ce qui marche, ce qui non
- `automations.md` — automations bâties et réutilisables
- `content.md` — idées de contenu, posts LinkedIn qui ont marché
- `lessons.md` — erreurs et leçons apprises

## Convention de nommage

- Fichiers people/projects : minuscules, tirets. Ex : `construction-abc-inc.md`
- Décisions et daily : préfixe date ISO `AAAA-MM-JJ`. Ex : `2026-07-17-pricing-enterprise.md`
- Toujours mettre à jour `memory/INDEX.md` quand un fichier important est créé.

## Règle anti-vrac

L'inbox doit être vidée **au moins 1×/jour** (le Heartbeat peut le faire).
Une info qui traîne plus de 48h dans l'inbox = signal qu'une règle de routage manque ici.
