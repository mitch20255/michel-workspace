# 🔑 Obtenir un refresh token YouTube (une seule fois, ~10 min)

Le moteur a besoin de 3 valeurs pour lire tes vidéos **likées** :
`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`. Voici comment les obtenir.

> Pourquoi un refresh token ? Il permet au robot de se reconnecter tout seul chaque nuit,
> sans que tu aies à te relogger. On le génère une fois, on le colle en secret, c'est fini.

---

## 1. Créer un projet + activer l'API (3 min)
1. Va sur https://console.cloud.google.com/ → crée un projet (ou réutilise-en un).
2. `APIs & Services → Library` → cherche **YouTube Data API v3** → **Enable**.

## 2. Écran de consentement OAuth (2 min)
1. `APIs & Services → OAuth consent screen`.
2. Type **External** → remplis le minimum (nom d'app, ton email).
3. **Test users** → ajoute **ton propre email Google**. (Reste en mode *Testing*, pas besoin
   de publier — un refresh token de test dure, tant que l'app reste en Testing avec toi
   comme test user.)
4. Scopes : tu peux laisser vide ici, on le passe à l'étape suivante.

## 3. Créer des identifiants OAuth (2 min)
1. `APIs & Services → Credentials → Create credentials → OAuth client ID`.
2. Type d'application : **Web application**.
3. **Authorized redirect URIs** → ajoute exactement :
   `https://developers.google.com/oauthplayground`
4. Crée → note le **Client ID** et le **Client secret**.

## 4. Générer le refresh token (3 min) — OAuth Playground
1. Va sur https://developers.google.com/oauthplayground/
2. En haut à droite : ⚙️ (Settings) → coche **Use your own OAuth credentials** →
   colle ton **Client ID** et **Client secret**.
3. À gauche, dans « Input your own scopes », colle :
   `https://www.googleapis.com/auth/youtube.readonly`
   puis **Authorize APIs** → connecte-toi avec ton compte Google (le test user).
4. Étape 2 : clique **Exchange authorization code for tokens**.
5. Copie la valeur **Refresh token** affichée. 🎉

## 5. Coller dans GitHub (1 min)
`Repo → Settings → Secrets and variables → Actions → New repository secret` :
- `YT_CLIENT_ID` = ton Client ID
- `YT_CLIENT_SECRET` = ton Client secret
- `YT_REFRESH_TOKEN` = le refresh token de l'étape 4

C'est fini. Dès ce soir, chaque vidéo que tu **likes** sur YouTube deviendra une note.

---

### Dépannage
- **`invalid_grant`** : le refresh token a expiré (arrive si l'app OAuth est repassée hors
  Testing, ou après révocation). Refais l'étape 4.
- **Rien ne remonte** : vérifie que tu **likes** bien les vidéos (👍), et que les likes ne
  sont pas privés au point d'être masqués. Le moteur lit la playlist « Vidéos aimées ».
- **Quota** : l'API YouTube a un quota quotidien largement suffisant pour un usage perso.
