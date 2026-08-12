---
type: moc
projet: Parenting
tag_projet: parenting
phase: recherche
date_debut: 2026-08-12
status: actif
---

# 🎯 Parenting — MOC

> **Objectif** — Apprendre tout ce qui se fait de sérieux dans le monde du parenting
> (0-5 ans en priorité : sommeil, discipline positive, développement, écrans), consolider
> une base de connaissance solide, puis rester à jour via une veille.
> **« Closé » =** j'ai une base de connaissances synthétique qui répond à mes 10 questions clés.

**Phase actuelle :** 🔎 Recherche
**Livrable final :** [[Parenting - Base de connaissances]]
**Veille :** [[Parenting - Veille]]

---

## 📥 À traiter (nouvelles captures non digérées)
```dataview
TABLE source AS "Source", importance AS "Imp.", date AS "Date"
FROM #parenting
WHERE status = "à-lire"
SORT date DESC
```

## 📚 Toutes les sources du projet
```dataview
TABLE type AS "Type", source AS "Source", importance AS "Imp.", status AS "Statut"
FROM #parenting
WHERE type != "moc"
SORT importance ASC, date DESC
```

## ⭐ Les pépites (importance = high)
```dataview
LIST
FROM #parenting
WHERE importance = "high" AND type != "moc"
SORT date DESC
```

---

## 🗺️ Mes questions clés (le plan de recherche)
Coche quand la base y répond de façon satisfaisante :

- [ ] Sommeil 0-2 ans : quelles méthodes, laquelle pour nous ?
- [ ] Discipline positive : principes concrets applicables au quotidien
- [ ] Développement du langage : quoi faire / éviter
- [ ] Écrans : recommandations par âge
- [ ] Alimentation & autonomie (DME, etc.)
- [ ] Gestion des crises / émotions
- [ ] Attachement : les bases scientifiques
- [ ] Éveil & jeu par tranche d'âge
- [ ] Répartition parentale / charge mentale
- [ ] Ressources francophones fiables (QC)

> ℹ️ Cette MOC ne recopie rien : elle **interroge** le vault. Toute note taggée `#parenting`
> y apparaît automatiquement. Nécessite le plugin **Dataview**.
