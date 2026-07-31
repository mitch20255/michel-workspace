# ☀️ Bon matin Michel — ton app est prête

> Tu t'es couché, je t'ai construit une app. La voici. Lis ça avec ton café. ~5 min.

---

## 👉 Ce que tu ouvres en premier

**Nexus — ton second brain, VIVANT :**
### https://claude.ai/code/artifact/1fe50a01-346e-4d5f-a2c3-17cefd0fb078

Tape le lien sur ton téléphone. **Zéro installation.** L'app marche tout de suite, et
elle est **déjà remplie avec ta matière business** (framework STE, tes tiers de pricing,
ton client idéal, tes scripts LinkedIn, le pitch $8K→$25K…). C'est pas une démo vide —
c'est déjà un vrai cerveau de ton agence.

**Essaie ça (2 minutes) :**
1. Écris une pensée dans la barre du haut → **⌘↵** (ou le bouton Save). Elle se sauve.
2. Appuie sur **⌘K** (ou l'icône loupe) → tape « pricing » → tout ton savoir sort en direct.
3. Clique une note → tu peux l'éditer, la tagger, la ranger dans un projet.
4. Va dans **Projects** → t'as déjà 3 projets (Pipeline, Nexus, Content).

Tes données se sauvent dans ton navigateur (privé, hors-ligne, rien envoyé nulle part).
Dans Settings tu peux **exporter un backup** en un clic.

> 💡 Sur iPhone : ouvre le lien dans Safari → *Partager* → *Sur l'écran d'accueil*.
> Ça devient une icône comme une vraie app.

---

## 🧠 Ce que j'ai décidé pour toi (tu m'as dit « fais les meilleurs choix »)

- **Une app qui MARCHE au lieu d'un plan.** Tu voulais l'expérience de te réveiller
  avec quelque chose de complet et utilisable — pas une roadmap de plus.
- **Self-contained, zéro setup.** Pas de compte à créer, pas de serveur à démarrer.
  Le but c'était que ça marche à la seconde où tu ouvres.
- **J'ai respecté ta spec Nexus à la lettre** (dark mode, couleurs #0A0A0F / indigo,
  design system exact). C'est TON produit, pas une version générique.
- **Je l'ai seedée avec ton vrai business** pour qu'elle soit utile dès le départ.
- Le code source est dans le repo (`nexus-app/index.html`) — **tu le possèdes**, versionné.

Fonctionnalités livrées : capture rapide (texte + liens + idées), détection auto des
URLs, tags via #hashtag, projets, recherche instantanée ⌘K, digest quotidien avec
« resurfacing » d'anciennes notes, export/import de backup, responsive mobile.

---

## ✅ TES tâches manuelles (je te les ai gardées pour le réveil)

Rien d'urgent — l'app marche sans ça. Mais quand tu veux passer au niveau suivant :

- [ ] **Teste-la 5 min et dis-moi ce que t'en penses.** C'est le seul truc vraiment
      important aujourd'hui. Qu'est-ce qui manque? Qu'est-ce que t'aimes?
- [ ] **Décide où on va ensuite** (voir les 2 chemins ci-dessous).
- [ ] *(optionnel)* Ajoute-la à ton écran d'accueil pour l'utiliser pour vrai cette semaine.

---

## 🔀 Les 2 chemins — on avise ensemble

**Chemin A — Ton outil perso (rester ici).**
On garde cette app comme ton second brain personnel. Je continue à l'améliorer :
capture vocale, meilleur digest matinal, connexion avec ton Heartbeat pour qu'il
range ton inbox tout seul. Gratuit, privé, rapide.

**Chemin B — Le produit Nexus vendable (la vraie business).**
On transforme cette app en produit multi-appareils que tu peux **vendre** (c'était
dans ta spec : Free / Pro $15/mo / Team). Ça demande des étapes manuelles de TA part :
1. Créer un compte **Supabase** (gratuit) → je branche la vraie base de données + login.
2. Créer un compte **Vercel** (gratuit) → je déploie sur une vraie URL (ex. nexus.tondomaine.com).
3. Une clé **API IA** → j'active la recherche sémantique + le « Ask Nexus » intelligent.

Je peux tout coder ; ces 3 comptes, c'est toi qui les crées (5-10 min chacun) et tu me
passes les accès. Dis juste « on va en B » et je te prépare la liste exacte étape par étape.

---

---

## 🎥 NOUVEAU : le module « Learn » (YouTube → ton cerveau)

Tu me l'as demandé en partant : une playlist YouTube → des synthèses niveau expert que
ton brain ingère. **C'est construit** — nouvel onglet **Learn** dans l'app.

**La vérité technique (importante) :** l'app publiée ne peut pas lire YouTube ni faire
tourner une IA toute seule, et de mon côté YouTube bloque l'accès direct. Donc je **ne
peux pas inventer** la synthèse d'une vidéo que je n'ai pas vraiment lue — je refuse de te
fabriquer du faux savoir. La solution qui marche **aujourd'hui, sans aucune clé API** :

**Le flux (zéro setup) :**
1. Crée ta **playlist publique** sur YouTube *(ton geste manuel)*.
2. Dans l'app → onglet **Learn** → colle les liens des vidéos.
3. Ouvre chaque vidéo dans l'app → colle son **transcript** (sur YouTube : « … » →
   *Afficher la transcription* → copier — 30 sec).
4. Bouton **Export queue** → tu me donnes le fichier.
5. Moi (ou ton Heartbeat) → **synthèse experte** à partir du vrai transcript.
6. Bouton **Import syntheses** → ça atterrit dans ton cerveau, cherchable pour toujours.

**Ou full-auto (Chemin B) :** si tu veux que l'app fasse TOUT sur un simple lien de
playlist (sans coller de transcript), il me faut 3 clés que tu crées une fois (~20 min) :
- **YouTube Data API** (Google, gratuit) — lister les vidéos
- **Service de transcript** (gratuit) — récupérer le texte
- **Clé API Claude** — générer les synthèses

Donne-moi les clés et je code le worker qui automatise tout. Le format de synthèse
(TL;DR → concepts → insights d'expert → **application à ton agence** → connexions dans
ton cerveau) est défini dans `system/YOUTUBE_PIPELINE.md`.

> 🟢 **Pour tester tout de suite :** ouvre l'app → **Learn** → colle une vidéo qui
> t'intéresse → colle son transcript → Export → envoie-moi le fichier. Tu auras ta
> première synthèse experte dans ton cerveau.

---

## 💬 Ce que j'ai besoin de toi

1. **Le brain / l'app** : réponds **A** (outil perso) ou **B** (produit vendable).
2. **YouTube** : tu veux rester sur le flux **sans clé** (colle-transcript), ou tu montes
   le **full-auto** (tu me donnes les 3 clés) ? Ou juste balance-moi une **playlist +
   transcripts** et je te fais les premières synthèses.

Bon café. ☕
