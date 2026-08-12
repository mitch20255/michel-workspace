---
type: veille
projet: Parenting
tag_projet: parenting
date_activation: 2026-08-12
---

# 📡 Parenting — Veille

> Le dossier sera **closé** une fois la [[Parenting - Base de connaissances]] complète.
> Cette note liste les **nouveautés** captées depuis, pour rester à jour sans tout relire.

## 🆕 Captures récentes (30 derniers jours)
```dataview
TABLE source AS "Source", importance AS "Imp.", date AS "Date"
FROM #parenting
WHERE type != "moc" AND type != "veille" AND type != "synthese" AND date >= date(today) - dur(30 days)
SORT date DESC
```

## 🔥 À intégrer à la base
Quand une nouveauté change vraiment ma compréhension, je l'ajoute à la
[[Parenting - Base de connaissances]] et je coche ici.

- [ ] 

---
> 💡 Idée d'automatisation : une fois par semaine, un workflow n8n peut envoyer un
> résumé Telegram des nouvelles notes `#parenting` de la semaine (« ta veille parenting »).
> Voir `_system/Capture-Automation.md`. Nécessite **Dataview**.
