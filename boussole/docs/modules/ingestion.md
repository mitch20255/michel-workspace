# Module — Ingestion

Récupère les offres depuis les ATS, les normalise et les range en base.

## Connecteurs disponibles

| ATS        | Endpoint                                                       | Particularité traitée                                |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{jeton}/jobs?content=true` | Description encodée en entités HTML                  |
| Lever      | `api.lever.co/v0/postings/{compagnie}?mode=json`               | Description éclatée en trois champs                  |
| Ashby      | `api.ashbyhq.com/posting-api/job-board/{nom}`                  | `isListed`, `isRemote`, compensation par composantes |
| Personio   | `{compagnie}.jobs.personio.de/xml`                             | Flux XML à CDATA imbriquées                          |

Chaque particularité est couverte par un test, parce que chacune est un piège
qui produit des données silencieusement fausses plutôt qu'une erreur.

**Greenhouse** encode sa description en entités (`&lt;p&gt;`). Sans décodage,
la description arrive comme un bloc de texte contenant des balises littérales,
et le découpage en sections échoue entièrement. Un **seul** décodage : il
transforme le HTML échappé en HTML, les entités qui subsistent (`&#39;`) en
font partie et relèvent de `htmlToText`. Décoder deux fois abîmerait une
annonce citant `&lt;script&gt;` comme texte.

**Lever** éclate la description en `description`, `lists` et `additional`. Ne
lire que la première fait perdre les exigences, qui vivent presque toujours
dans `lists`. Les titres de listes sont réémis en `<h3>` pour que le découpage
en sections les reconnaisse.

**Ashby** publie `isListed` et `isRemote` de façon structurée. Une offre
`isListed: false` est retirée du tableau public : la présenter enverrait le
candidat vers une page morte. La compensation est renvoyée en composantes
(salaire, actions, prime) ; seule la composante salariale est retenue —
additionner le reste produirait un chiffre que l'employeur n'a jamais annoncé.

**Personio** ne publie qu'un flux XML. C'est la seule raison de la dépendance
`fast-xml-parser` : un parseur maison à base d'expressions régulières casse
sur les CDATA contenant du HTML, c'est-à-dire tous les cas réels. Une balise
XML vide y devient un objet, d'où la normalisation qui évite
« [object Object] » dans les offres.

## Politesse

Ces API sont offertes gratuitement. Les marteler ferait fermer l'accès pour
tout le monde.

- délai minimum entre deux requêtes vers le même hôte ;
- User-Agent identifiant ;
- respect de `Retry-After` sur 429 et 503 ;
- trois tentatives au maximum.

Un **401 ou 403 est une réponse, pas un obstacle**. Le message d'erreur le dit
explicitement : le tableau n'est pas public et Boussole ne tente pas de
contourner la restriction.

## Pourquoi pas Workday

Pas d'API publique : un locataire par client, des points d'accès internes non
documentés atteints en POST, dont la forme change sans préavis. Un connecteur
Workday serait du scraping fragile déguisé.

Les offres hébergées sur Workday restent ajoutables à la main, avec la même
normalisation et le même scoring. À réévaluer si Workday publie une API de
tableau d'offres stable et documentée.

## Cycle d'une offre

```
première ingestion   → créée, firstSeenAt = maintenant, seenCount = 1
ingestions suivantes → seenCount++, lastSeenAt mis à jour
description modifiée → contentHash change, lastChangedAt renseigné
offre absente        → status = inactive (jamais supprimée)
réapparition         → repostCount++ (signal fantôme fort)
```

L'état précédent est transmis à `normalizeJob`. Sans lui, `firstSeenAt` est
réécrit à chaque passage : l'offre paraît éternellement neuve et le score
d'offre fantôme, qui repose sur l'ancienneté et les republications, devient
faux.

Une offre disparue est **désactivée, jamais supprimée** : elle peut porter une
candidature en cours, et sa réapparition est un signal.

## Ajouter un connecteur

Voir [`docs/development.md`](../development.md). Le critère d'admission n'est
pas la difficulté technique mais l'existence d'une API publique et documentée.
