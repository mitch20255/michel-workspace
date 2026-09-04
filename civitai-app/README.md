# Civitai Explorer

Application web légère pour explorer l'API Civitai (par défaut **https://civitai.red**) :
recherche de modèles, galerie d'images avec leurs prompts, annuaire des créateurs et favoris locaux.

Aucune dépendance à installer : un serveur Node (module `http` natif) sert l'interface
et relaie les appels vers l'API. Ce relais évite les blocages CORS du navigateur et
permet de garder la clé d'API côté serveur.

```
civitai-app/
├── server.js            # serveur statique + proxy API
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js           # toute la logique de l'interface
├── package.json
└── .env.example
```

## Démarrage

Prérequis : **Node.js 18 ou plus** (`node --version`).

```bash
cd civitai-app
npm start
```

Puis ouvre <http://127.0.0.1:5173>.

Avec un fichier de configuration (Node 20+) :

```bash
cp .env.example .env   # ajuste les valeurs
npm run start:env
```

Ou directement par variables d'environnement :

```bash
CIVITAI_BASE_URL=https://civitai.com CIVITAI_API_KEY=xxxxx PORT=8080 npm start
```

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `CIVITAI_BASE_URL` | `https://civitai.red` | URL de base de l'API. Bascule sur `https://civitai.com` si le miroir est indisponible. |
| `CIVITAI_API_KEY` | *(vide)* | Clé d'API : modèles restreints + quotas plus élevés. |
| `PORT` / `HOST` | `5173` / `127.0.0.1` | Écoute du serveur local. |
| `CIVITAI_TIMEOUT_MS` | `30000` | Délai maximum d'un appel à l'API. |
| `CIVITAI_CACHE_TTL_MS` | `60000` | Durée du cache mémoire des réponses. |

La clé peut aussi être saisie dans l'interface (bouton ⚙️). Elle est alors stockée
dans le `localStorage` du navigateur et transmise au serveur local via l'en-tête
`x-civitai-key`, jamais écrite sur disque.

## Fonctionnalités

- **Modèles** — recherche plein texte, filtres type (LORA, Checkpoint, VAE…), modèle
  de base (SDXL, Pony, Flux…), tri et période. Pagination par curseur (« Charger la suite »).
- **Détail d'un modèle** — description, statistiques, toutes les versions avec leurs
  fichiers (taille + lien de téléchargement), mots-clés d'entraînement cliquables
  pour copie, galerie d'aperçus.
- **Images** — galerie communautaire ; un clic affiche le prompt, le prompt négatif
  et les paramètres de génération (sampler, steps, CFG, seed), chacun copiable.
- **Créateurs** — recherche par pseudo, un clic liste leurs modèles.
- **Favoris** — sauvegardés dans le navigateur, sans compte.
- **Contenu adulte** — exclu par défaut ; case `NSFW` pour l'inclure, case `Flou`
  pour flouter les vignettes concernées.
- Raccourcis : `/` pour la recherche, `Échap` pour fermer un panneau.

## Points techniques

- Le proxy n'autorise que les chemins `/api/v1/{models,images,creators,tags,model-versions}` :
  ce n'est pas un proxy ouvert.
- Les réponses `GET` réussies sont mises en cache 60 s en mémoire (en-tête
  `x-proxy-cache: HIT|MISS`) pour ménager l'API.
- Si l'API renvoie du HTML au lieu du JSON (page d'erreur, pare-feu, mauvaise URL de
  base), le serveur renvoie une erreur 502 explicite plutôt qu'un plantage silencieux.

## Dépannage

| Symptôme | Piste |
|---|---|
| « Impossible de contacter … » | Le domaine est injoignable depuis ta machine/ton réseau. Teste `curl -I https://civitai.red`, ou bascule `CIVITAI_BASE_URL=https://civitai.com`. |
| Réponse non-JSON (502) | L'URL de base ne pointe pas sur une API Civitai, ou une protection anti-bot s'interpose. |
| `401` / `403` | Renseigne une clé d'API (⚙️ ou `CIVITAI_API_KEY`). |
| `429` | Trop de requêtes : attends un peu, réduis le nombre de résultats par page. |
| Aucune vignette | Les images sont servies par un CDN externe ; vérifie qu'il n'est pas bloqué par ton réseau. |

## Vérifications effectuées

Le proxy, la pagination, le panneau de détail, l'onglet images, l'onglet créateurs et
les favoris ont été testés de bout en bout (Chromium + API factice locale). L'API
publique elle-même n'a pas pu être appelée depuis l'environnement de développement,
dont la politique réseau bloque `civitai.red` comme `civitai.com` — à valider donc au
premier lancement sur ta machine.
