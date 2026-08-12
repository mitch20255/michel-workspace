---
type: veille
projet: ""
tag_projet: ""       # ex. parenting
date_activation: <% tp.date.now("YYYY-MM-DD") %>
---

# 📡 <% tp.file.title %>

> Le dossier est **closé** (voir la Base de connaissances). Cette note liste les
> **nouveautés** captées depuis, pour rester à jour sans tout relire.

## 🆕 Captures récentes (30 derniers jours)
```dataview
TABLE source AS "Source", summary AS "Résumé", importance AS "Imp."
FROM #TAG_PROJET
WHERE type != "moc" AND type != "veille" AND date >= date(today) - dur(30 days)
SORT date DESC
```

## 🔥 À intégrer à la base
(Quand une nouveauté change vraiment ma compréhension, je l'ajoute à la
[[Base de connaissances]] et je coche ici.)

- [ ] 
- [ ] 

---
> ℹ️ Remplace `#TAG_PROJET` par le vrai tag. Nécessite **Dataview**.
