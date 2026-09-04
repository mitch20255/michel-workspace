# Protocole GLP-1

L'app que tu installes sur ton écran d'accueil pour piloter ton protocole : protéines, poids,
entraînement, injection, effets secondaires. Tout est stocké **sur ton téléphone**, dans le
navigateur. Il n'y a pas de compte, pas de serveur de données, personne d'autre que toi.

Ce fichier est écrit pour le toi de dans six mois, qui aura tout oublié. Il n'y a rien à savoir
d'avance.

---

## 1. Où sont mes données ?

Dans le navigateur de ton téléphone, dans une base locale qui s'appelle IndexedDB. Concrètement :

- Elles survivent aux fermetures de l'app et aux redémarrages du téléphone.
- Elles **ne survivent pas** à « effacer les données du navigateur », ni à un changement de
  téléphone, ni à une désinstallation.
- Elles ne sont visibles nulle part ailleurs. Personne ne les reçoit.

**Donc : fais un export JSON de temps en temps.** Onglet Suivi → « Exporter en JSON ». C'est un
fichier, tu le mets où tu veux, et le bouton « Importer une sauvegarde » le remet en place. C'est
ton seul vrai filet.

## 2. Le flux d'une journée

1. Le matin : tu te pèses, tu entres le poids.
2. La journée : tu manges, tu logues dans **MyFitnessPal** comme d'habitude (c'est lui qui a le
   scanner et la base de produits).
3. Le soir : tu ouvres l'app, onglet Aujourd'hui → **Total du jour**, tu recopies les protéines et
   les calories que MyFitnessPal affiche. Dix secondes.
4. Le reste — eau, suppléments, gym, effets — se coche au fur et à mesure.

Le pont avec MyFitnessPal est manuel, et c'est voulu : MyFitnessPal n'a plus d'API publique, et
Health Connect (« Google Santé ») est une API Android sur l'appareil qu'une app web ne peut pas
lire. Deux chiffres recopiés ne cassent jamais.

Si tu as sauté des journées, l'onglet Suivi peut **importer un export MyFitnessPal** (le CSV
Premium ou le .zip gratuit « Download My Data »). L'app te montre ce qu'elle a compris avant
d'écrire quoi que ce soit, et elle ne touche pas aux journées que tu as saisies à la main.

## 3. Installer l'app sur Android

1. Ouvre l'URL de l'app dans **Chrome** (pas dans un navigateur intégré à une autre app).
2. Menu ⋮ en haut à droite → **Ajouter à l'écran d'accueil** (parfois écrit « Installer
   l'application »).
3. Confirme. Une icône apparaît sur ton écran d'accueil.
4. Ouvre-la depuis cette icône : elle s'ouvre en plein écran, sans barre d'adresse, et elle
   fonctionne sans réseau.

Sur iPhone, c'est Safari → bouton Partager → « Sur l'écran d'accueil ».

## 4. Les rappels

L'app n'envoie **pas** de notifications quand elle est fermée, et ce n'est pas un oubli : une app
web installée sur Android ne peut pas déclencher une alerte à une heure précise si elle n'est pas
ouverte. Bricoler ça donnerait des rappels qui arrivent une fois sur trois.

À la place : onglet Suivi → « Télécharger les rappels (.ics) ». Tu importes ce fichier dans Google
Agenda et tu as les quatre récurrences (injection, pesée, point protéines, revue du dimanche) avec
leurs alarmes. Quand tu ouvres l'app, elle t'affiche aussi les rappels du moment en haut de
l'onglet Aujourd'hui.

## 5. Modifier l'app

Tout le code est dans ce dossier. Pour travailler dessus :

```bash
cd glp1/app
npm install
npm run dev
```

Ça ouvre l'app sur `http://localhost:5173`. Chaque modification s'affiche immédiatement.

Pour vérifier que tout compile avant de publier :

```bash
npm run build
```

### Où est quoi

| Fichier | Ce qu'il contient |
| --- | --- |
| `src/lib/seed.ts` | Les plats, les suppléments, les effets, les réglages par défaut |
| `src/lib/analyse.ts` | **Les règles de décision** : seuils de perte, protéines, gym, titration, drapeaux rouges |
| `src/onglets/Protocole.tsx` | Le texte du protocole (la partie en Georgia) |
| `src/onglets/Jour.tsx` | L'onglet Aujourd'hui |
| `src/lib/mfp.ts` | La lecture des exports MyFitnessPal |
| `src/lib/exports.ts` | Export JSON, notes Obsidian, fichier .ics |
| `src/index.css` | Toutes les couleurs et tous les styles |
| `api/produit.js` | Le relais vers Open Food Facts pour le scanner |

Pour changer une couleur, va dans `src/index.css` : elles sont toutes déclarées en haut.

Pour refaire les icônes après avoir changé le motif : `node scripts/generate-icons.mjs`.

## 6. Redéployer

Le déploiement est automatique : **tu pousses sur GitHub, Vercel republie.**

```bash
git add -A
git commit -m "ce que j'ai changé"
git push
```

Une minute plus tard, l'app est à jour. Sur ton téléphone, ferme-la et rouvre-la : elle se met à
jour toute seule au prochain lancement.

### La toute première fois (à faire une seule fois)

1. Va sur [vercel.com](https://vercel.com), connecte-toi avec ton compte GitHub.
2. **Add New… → Project**, choisis le dépôt `michel-workspace`.
3. **Important** : dans « Root Directory », clique *Edit* et choisis `glp1/app`. Sans ça, Vercel ne
   trouvera pas l'app.
4. Le reste se détecte tout seul (Framework : Vite). Clique **Deploy**.
5. Au bout d'une minute, Vercel te donne une URL du genre `protocole-glp1.vercel.app`. C'est celle
   que tu ouvres dans Chrome pour l'installer.

Le plan gratuit suffit largement : l'app est statique, et la seule fonction serveur (le relais pour
le scanner) ne s'exécute que quand tu scannes un produit.

## 7. Le scanner de codes-barres

Onglet Aujourd'hui → « Scanner un produit ». La caméra s'ouvre, tu vises le code, l'app cherche le
produit dans **Open Food Facts** (base ouverte et gratuite), tu entres la quantité, elle calcule.

Deux choses à savoir :

- **Un scan envoie le numéro de code-barres à Open Food Facts.** Aucune donnée personnelle, mais
  c'est la seule chose de toute l'app qui sort de ton téléphone. Les produits déjà scannés sont
  gardés en mémoire locale et ne repartent pas en ligne.
- Tous les produits ne sont pas dans la base, et certains n'ont pas leurs protéines. Quand c'est le
  cas, l'app te le dit au lieu d'inventer un chiffre. MyFitnessPal reste plus complet — le scanner
  est là pour les fois où tu ne veux pas ouvrir une deuxième app.

## 8. Ce qui a été volontairement laissé de côté

- Pas de dark mode, pas de thèmes, pas de badges, pas de séries de jours.
- Pas d'intégration Health Connect / Google Fit / MyFitnessPal en direct : techniquement
  impossible depuis une app web, voir le point 2.
- Pas de revue du dimanche générée automatiquement ni de saisie vocale (phase 3) : à faire le jour
  où tu le demandes.

---

Rien ici ne remplace ton prescripteur. L'app sert à lui arriver avec des données au lieu
d'impressions.
