# Google Tasks AI

App web qui connecte ton compte Google Tasks/Calendar et utilise l'IA (Claude) pour :
- créer des tâches à partir d'une phrase en langage naturel,
- prioriser automatiquement tes tâches (P1 à P4) avec une estimation de durée,
- planifier automatiquement des blocs de travail dans Google Calendar selon la priorité,
  l'échéance et tes disponibilités (comme Reclaim.ai), sans dupliquer les blocs déjà créés.

Stack : Next.js 14 (App Router) + NextAuth (OAuth Google) + Google Tasks/Calendar API +
Anthropic SDK (Claude). Pas de base de données : la priorité et la durée estimée sont
stockées directement dans les notes de la tâche Google Tasks (métadonnée invisible).

## 1. Créer les identifiants Google OAuth

1. Va sur [Google Cloud Console](https://console.cloud.google.com/) et crée un projet
   (ou réutilise un projet existant).
2. Dans **APIs & Services > Library**, active :
   - **Google Tasks API**
   - **Google Calendar API**
3. Dans **APIs & Services > OAuth consent screen** :
   - Type d'utilisateur : *External* (ou *Internal* si tu as un Google Workspace).
   - Ajoute ton adresse Gmail comme utilisateur de test si l'app reste en mode *Testing*.
4. Dans **APIs & Services > Credentials**, crée un **OAuth client ID** de type
   *Web application* :
   - **Authorized redirect URIs** :
     - `http://localhost:3000/api/auth/callback/google` (développement local)
     - `https://<ton-domaine-vercel>.vercel.app/api/auth/callback/google` (production)
   - Note le **Client ID** et le **Client Secret**.

## 2. Obtenir une clé API Anthropic (Claude)

Crée une clé sur [console.anthropic.com](https://console.anthropic.com/) (section API Keys).

## 3. Configurer les variables d'environnement

Copie `.env.example` vers `.env.local` et remplis :

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...        # génère avec: openssl rand -base64 32
ANTHROPIC_API_KEY=...
```

## 4. Lancer en local

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000), connecte-toi avec Google, et utilise l'app.

## 5. Déployer sur Vercel (gratuit)

1. Pousse ce dossier dans un repo GitHub (ou connecte le repo existant).
2. Sur [vercel.com](https://vercel.com/), importe le projet (root directory =
   `google-tasks-ai` si le repo contient d'autres dossiers).
3. Ajoute les variables d'environnement (mêmes clés que `.env.local`, avec
   `NEXTAUTH_URL=https://<ton-domaine>.vercel.app`).
4. Ajoute l'URL de callback Vercel dans les *Authorized redirect URIs* du client OAuth
   (étape 1).
5. Déploie. Le tier gratuit de Vercel est suffisant pour un usage personnel.

## Fonctionnement

- **Création en langage naturel** : tape une phrase dans la barre du haut (ex.
  *"Renvoyer le formulaire de taxes avant vendredi"*). Claude extrait titre, échéance et
  notes, puis la tâche est créée dans Google Tasks.
- **Prioriser avec l'IA** : envoie toutes les tâches non complétées à Claude, qui assigne
  une priorité (P1=critique → P4=basse) et une durée estimée, écrites dans les notes de
  la tâche.
- **Planifier dans Calendar** : récupère tes disponibilités (Google Calendar freebusy) sur
  les 7 prochains jours, puis place chaque tâche non planifiée dans le premier créneau
  libre (heures de bureau 9h-17h, lun-ven) avant son échéance, en respectant l'ordre de
  priorité. Les événements créés portent une métadonnée privée (`taskId`) pour éviter de
  planifier deux fois la même tâche.

## Limites connues (v1)

- Seule la liste de tâches Google par défaut (`@default`) est utilisée.
- Heures de travail et fenêtre de planification (9h-17h, lun-ven, 7 jours) sont fixes
  dans `lib/scheduling.ts` — modifie les constantes si besoin.
- Next.js est figé sur la branche 14.2.x (dernière version patchée disponible) ; certaines
  CVE listées par `npm audit` ne sont corrigées qu'en v15/v16, mais concernent des
  fonctionnalités non utilisées ici (Image Optimizer, middleware, i18n).
