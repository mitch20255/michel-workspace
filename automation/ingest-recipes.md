# 📡 Recettes de capture instantanée (Instagram, Facebook, iOS, n8n…)

Tout ce qui peut envoyer un **webhook** peut nourrir ton cerveau. Le principe :
faire un `POST` sur l'API GitHub `repository_dispatch`, qui déclenche le workflow
`second-brain-ingest.yml` → une note apparaît en ~1 min.

## Le POST générique
```
POST https://api.github.com/repos/mitch20255/michel-workspace/dispatches
Headers:
  Authorization: Bearer <TON_GITHUB_PAT>
  Accept: application/vnd.github+json
Body (JSON):
  {
    "event_type": "capture",
    "client_payload": { "url": "<URL>", "type": "post", "source": "Instagram" }
  }
```
- `type` : `article` | `video` | `post` | `podcast` (optionnel — deviné depuis l'URL sinon).
- `source` : nom lisible (optionnel).

### Créer le PAT (token GitHub) — 1 min
`GitHub → Settings → Developer settings → Fine-grained tokens → Generate`.
Accès : **ce repo uniquement**, permission **Contents: Read and write** (+ métadonnées lecture).
Copie le token → c'est le `<TON_GITHUB_PAT>` ci-dessus. Garde-le privé.

---

## Recette A — Instagram / Facebook (via IFTTT) ⭐
IFTTT a des déclencheurs Meta natifs.
1. IFTTT → **Create** → **If** : Instagram → *« New photo you like »* (ou Facebook → *« New status message »*, selon ce que tu veux capter).
2. **Then** : **Webhooks → Make a web request**.
   - URL : `https://api.github.com/repos/mitch20255/michel-workspace/dispatches`
   - Method : `POST`
   - Content Type : `application/json`
   - Additional Headers : `Authorization: Bearer <PAT>` et `Accept: application/vnd.github+json`
   - Body :
     ```json
     {"event_type":"capture","client_payload":{"url":"{{Url}}","type":"post","source":"Instagram"}}
     ```
     (`{{Url}}` = ingredient IFTTT du post liké.)
3. Save. Désormais : tu ❤️ un post → note auto. ✅

> Zapier/Make marchent pareil (module *Webhooks → POST*). Choisis l'outil que tu as déjà.

## Recette B — Raccourci iOS « Partager vers mon cerveau » ⭐
Parfait pour capturer **n'importe quoi** depuis la feuille de partage (Safari, YouTube, Insta…).
1. App **Raccourcis** → nouveau raccourci → active *Afficher dans la feuille de partage*.
2. Entrée : **URLs**.
3. Action **Obtenir le contenu d'une URL** :
   - URL : `https://api.github.com/repos/mitch20255/michel-workspace/dispatches`
   - Méthode : `POST`
   - En-têtes : `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`
   - Corps de la requête : **JSON**
     - `event_type` (Texte) = `capture`
     - `client_payload` (Dictionnaire) → `url` = *Entrée du raccourci*, `type` = `article`
4. Désormais : *Partager → Mon cerveau* sur ton iPhone → note auto. ✅

## Recette C — Bookmarklet navigateur (desktop, 0 install)
Crée un favori dont l'URL est ce code (remplace `<PAT>`) :
```javascript
javascript:(()=>{fetch('https://api.github.com/repos/mitch20255/michel-workspace/dispatches',{method:'POST',headers:{'Authorization':'Bearer <PAT>','Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({event_type:'capture',client_payload:{url:location.href,type:'article',source:document.title}})}).then(()=>alert('🧠 Capturé !'))})();
```
Clique le favori sur n'importe quelle page → note auto.

## Recette D — Depuis ton n8n Cortex existant
Ajoute un nœud **HTTP Request** dans un flux Cortex : même `POST` que ci-dessus. Ça permet
de router : `/todo` → Asana (exécutif), `/save` → repository_dispatch (connaissance).

---

### Sécurité
- Le PAT donne accès en écriture à ce repo : garde-le secret, révoque-le si fuite.
- Utilise un token **fine-grained** limité à ce seul repo.
