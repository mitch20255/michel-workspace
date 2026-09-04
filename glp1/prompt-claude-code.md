# Prompt pour Claude Code

> Colle tout ce qui suit dans Claude Code, en joignant le fichier `protocole-glp1.html`.

---

## Contexte

Je ne suis pas développeur. Je veux une **app web installable sur mon écran d'accueil** (PWA) pour piloter mon protocole GLP-1. J'ai un prototype HTML fonctionnel que je te joins : `protocole-glp1.html`. Il contient déjà toute la logique métier, tout le contenu français, la charte visuelle et le modèle de données.

**Ta mission : porter ce prototype en PWA déployée, par le chemin le plus court.** Pas de réécriture conceptuelle. Le prototype est la spécification.

## Règles de travail

1. **Livre en phases. Déploie à la fin de chaque phase.** Je dois pouvoir utiliser l'app après la phase 1, pas après la phase 3.
2. **Aucune abstraction anticipée.** Un seul utilisateur, un seul appareil, pas d'authentification, pas de backend tant que je ne le demande pas. Si tu hésites entre une solution simple et une solution extensible, prends la simple.
3. **Ne me pose de questions que si un choix est irréversible ou m'engage financièrement.** Pour tout le reste, décide et avance.
4. **Interface entièrement en français** (québécois, tutoiement, ton sobre). Le contenu textuel du prototype est rédigé — reprends-le tel quel, ne le réécris pas.
5. Explique-moi chaque étape en langage non technique, et donne-moi les commandes exactes à copier quand j'ai quelque chose à faire.
6. Écris un `README.md` qui me dit comment relancer, modifier et redéployer l'app dans six mois quand j'aurai tout oublié.

## Stack imposée

- Vite + React + TypeScript
- Tailwind CSS
- `vite-plugin-pwa` (manifest, service worker, installable)
- `idb-keyval` pour le stockage local (IndexedDB)
- Déploiement : dépôt GitHub → Vercel, avec déploiement automatique au push

Pas de base de données, pas de serveur, pas de compte utilisateur.

---

## Saisie quotidienne des aliments — la règle de partage du travail

C'est le point le plus important à comprendre avant d'écrire une ligne de code, parce qu'il détermine ce que l'app doit faire **et surtout ce qu'elle ne doit pas essayer de faire**.

### Le partage

- **MyFitnessPal est l'outil de saisie des aliments.** C'est lui qui scanne les codes-barres, qui possède la base de données de produits, qui calcule les portions et qui additionne les macros. Je ne veux pas que tu recrées ça.
- **L'app GLP-1 est le tableau de bord.** Elle ne reçoit que le **résultat de la journée** : protéines totales, calories totales. Plus le poids, l'eau, les suppléments, le gym, les effets secondaires, l'injection — tout ce que MyFitnessPal ne suit pas.
- **Le pont entre les deux est volontairement manuel.** Deux chiffres recopiés une fois par jour, en dix secondes. C'est fiable, ça ne casse jamais, et ça ne dépend d'aucun service qui peut changer d'idée.

### Ce qui ne marche pas, et pourquoi je ne veux pas que tu essaies

J'avais imaginé une chaîne « MyFitnessPal → Google Santé (Health Connect) → app Claude → mon app ». Elle est bloquée à chaque jointure, et il vaut mieux le savoir tout de suite :

1. **MyFitnessPal n'a plus d'API publique.** Elle a été fermée ; l'accès est réservé à des partenaires commerciaux. Aucune app tierce ne peut lire mon journal en direct.
2. **Health Connect (« Google Santé ») est une API Android sur l'appareil, pas un service web.** Les données sont stockées localement et chiffrées, lisibles uniquement par une application Android native qui utilise le SDK Health Connect. **Une PWA ne peut pas y accéder — il n'existe aucune API web.** Ajouter cette étape ne rapproche donc pas les données de mon app : ça les enferme davantage.
3. **En prime, ce qui transite est appauvri.** MyFitnessPal écrit dans Health Connect des *résumés de repas* (déjeuner, dîner, souper, collation), pas les aliments détaillés, et seulement pour les noms de repas par défaut.
4. **L'app Claude n'a aucun moyen d'écrire dans le stockage local de ma PWA.** Il n'y a pas de tuyau entre les deux.

**Donc : n'implémente aucune intégration Health Connect, Google Fit ou MyFitnessPal en direct. Si tu penses avoir trouvé un contournement, écris-moi pourquoi avant d'écrire le code — ne le construis pas d'abord.**

### Ce que ça change dans l'app (phase 1)

Le prototype ne permet d'ajouter des protéines que par boutons « +45 g » liés aux plats. Ça ne colle pas au flux réel, où le chiffre arrive tout fait de MyFitnessPal. Donc :

- Ajoute, dans l'onglet **Aujourd'hui**, un champ de saisie directe **« Total du jour »** : protéines (g) et calories, qui **écrase** le compteur au lieu de s'y additionner. C'est le geste principal de ma journée : je regarde MyFitnessPal le soir, je recopie deux nombres.
- **Garde les boutons de plats** malgré tout. Ils servent en cours de journée, quand je veux voir où j'en suis sans ouvrir MyFitnessPal.
- L'app doit montrer clairement lequel des deux fait foi : si j'ai saisi un total manuel aujourd'hui, c'est lui qui compte, et les boutons de plats s'ajoutent par-dessus.

---

## Phase 1 — L'app installable (priorité absolue)

**Objectif : une icône sur mon écran d'accueil, qui ouvre exactement le prototype.**

- Scaffolder le projet, porter le prototype à l'identique : 5 onglets (Aujourd'hui, Semaine, Plats, Protocole, Suivi), même navigation, même contenu, mêmes règles de décision.
- **Reprends la logique d'analyse du prototype sans y toucher** : moyennes mobiles de poids sur 7 jours, seuils de rythme de perte (>1,3 % = trop vite / 1,0–1,3 % = rapide / 0,4–1,0 % = cible / <0,4 % = lent), moyennes de protéines, comptage des séances, détection de plateau pour la titration, drapeaux rouges.
- Ajoute le champ « Total du jour » décrit plus haut (protéines + calories, saisie directe).
- Migrer le stockage vers IndexedDB. Quatre clés : `config`, `log`, `plats`, `mesures`.
- Charte visuelle à conserver telle quelle :
  `--ink #1B2430` · `--ink2 #59636F` · `--paper #E9E9E4` · `--card #FFFFFF` · `--line #D6D6CE` · `--cobalt #2743C4` · `--moss #3F7A55` · `--ochre #B4802A` · `--rose #A63A46`
  Sans-serif système pour l'interface, Georgia pour l'onglet Protocole. Chiffres en `tabular-nums`.
- Mobile d'abord, testé à 380 px de large. Fonctionne hors ligne.
- Icône et écran de démarrage générés. Manifest en `standalone` pour qu'il n'y ait pas de barre de navigateur.
- Déployer sur Vercel et me donner l'URL + les étapes exactes pour l'installer sur Android.

**Critère de réussite :** je l'installe, je saisis mon poids et mes protéines, je ferme le téléphone, je rouvre demain, mes données sont là.

## Phase 2 — Ce que le prototype ne pouvait pas faire

- **Rappels.** Injection hebdomadaire (jeudi), pesée du matin, alerte protéines en fin d'après-midi si la cible est loin. Implémente avec l'API Notification + service worker; utilise `periodicSync` si disponible. **Si les notifications planifiées ne sont pas fiables sur ma plateforme, dis-le-moi franchement au lieu de bricoler**, et propose plutôt un export `.ics` de la récurrence pour mon calendrier.
- **Sauvegarde et export.** Export JSON complet (mon filet de sécurité), import du même fichier, et export Markdown formaté pour Obsidian : une note par semaine avec le tableau des jours, la courbe et les verdicts.
- **Import MyFitnessPal.** Rattrapage pour les jours où j'ai oublié de recopier mes totaux. MyFitnessPal offre deux sorties : l'export CSV en un clic (réservé à l'abonnement Premium) et la demande « Download My Data » (gratuite pour tout le monde, arrive par courriel en quelques heures, contient le journal alimentaire). **Écris l'import pour digérer les deux**, en tolérant que les colonnes changent de nom d'une version à l'autre :
  - je dépose le fichier dans l'app, elle me montre ce qu'elle a compris (dates, protéines, calories) **avant** d'écrire quoi que ce soit ;
  - elle agrège les lignes par repas en totaux journaliers ;
  - elle ne touche jamais aux journées où j'ai déjà saisi un total à la main, sauf si je coche explicitement « écraser » ;
  - tout se passe dans le navigateur, le fichier ne part nulle part.
- **Photos de progression.** Stockées localement en IndexedDB, vue comparative avant/après par date. Elles ne quittent jamais l'appareil.

## Phase 2.5 — Scanner de codes-barres intégré (optionnel, seulement si je le demande)

L'objectif ici n'est pas de remplacer MyFitnessPal du jour au lendemain, mais de voir si je peux m'en passer.

- Scan par la caméra : `BarcodeDetector` quand le navigateur le supporte (Chrome sur Android, oui), sinon une bibliothèque JS en repli. Pas d'app native.
- Recherche du produit dans **Open Food Facts** : base ouverte, gratuite, sans clé d'API, avec une bonne couverture des produits vendus au Québec. Envoie un `User-Agent` descriptif comme le projet le demande.
- **Vérifie d'abord si l'API répond aux requêtes du navigateur (CORS).** Si oui, appel direct depuis la PWA. Sinon, une petite fonction serverless sur Vercel qui relaie la requête — et dis-le-moi, parce que ça veut dire que l'app n'est plus 100 % autonome hors ligne pour cette fonction.
- Je saisis la portion, l'app calcule les macros et les ajoute à la journée. Les produits scannés sont mis en cache localement, pour que les mêmes items reviennent sans réseau.
- **À noter :** un scan envoie un numéro de code-barres à Open Food Facts. Aucune donnée personnelle, mais ce n'est plus strictement « rien ne sort de l'appareil ». Signale-le-moi clairement dans l'app avant le premier scan.

## Phase 3 — Le copilote (seulement si je le confirme)

- **Revue du dimanche** générée automatiquement : la semaine résumée en un paragraphe et les 2-3 ajustements à faire.
- Branchement optionnel sur mon stack existant (n8n, Supabase, bot Telegram) pour la saisie vocale.

Ne commence pas la phase 3 sans mon feu vert explicite.

---

## Ce que je ne veux pas

- Pas de dark mode, pas de thèmes, pas de réglages superflus.
- Pas de graphiques élaborés : la courbe SVG simple du prototype suffit.
- Pas de gamification, pas de badges, pas de séries de jours consécutifs.
- Pas de fenêtres modales pour confirmer des actions banales.
- Aucune donnée personnelle envoyée à un service tiers. (Seule exception envisageable : le numéro de code-barres en phase 2.5, et seulement si je l'ai approuvée.)
- Pas de tentative d'intégration Health Connect, Google Fit ou MyFitnessPal en direct — voir la section sur la saisie des aliments.

Commence par la phase 1. Quand elle est déployée et que j'ai confirmé qu'elle fonctionne sur mon téléphone, passe à la phase 2.
