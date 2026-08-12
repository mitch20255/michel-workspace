---
type: moc
projet: ""
tag_projet: ""        # le tag qui alimente cette MOC, ex. parenting
phase: recherche      # recherche | synthèse | veille
date_debut: <% tp.date.now("YYYY-MM-DD") %>
status: actif
---

# 🎯 <% tp.file.title %>

> **Objectif du projet** — (Qu'est-ce que je veux savoir/faire ? Quand est-ce « closé » ?)

**Phase actuelle :** 🔎 Recherche
**Livrable final :** [[<% tp.file.title %> - Base de connaissances]]
**Veille :** [[<% tp.file.title %> - Veille]]

---

## 📥 À traiter (nouvelles captures non digérées)
```dataview
TABLE source AS "Source", importance AS "Imp.", date AS "Date"
FROM #TAG_PROJET
WHERE status = "à-lire"
SORT date DESC
```

## 📚 Toutes les sources du projet
```dataview
TABLE type AS "Type", source AS "Source", category AS "Catégorie", importance AS "Imp."
FROM #TAG_PROJET
WHERE type != "moc"
SORT importance ASC, date DESC
```

## ⭐ Les pépites (importance = high)
```dataview
LIST
FROM #TAG_PROJET
WHERE importance = "high" AND type != "moc"
SORT date DESC
```

---
> ℹ️ Remplace `#TAG_PROJET` par le vrai tag (ex. `#parenting`) après avoir créé la note.
> Nécessite le plugin **Dataview**.
