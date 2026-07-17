# Décision : Le cerveau centralisé vit dans ce repo git (Brain OS)

- **Date :** 2026-07-17
- **Décision :** Bâtir le système de gestion des connaissances de Michel comme une structure Markdown versionnée dans ce repo git, plutôt que dans Google Drive ou directement dans l'app Nexus.

## Contexte
Michel avait ses connaissances éparpillées : le playbook business (`SKILL.md` + `references/`), la spec produit (`NEXUS_VIBE_CODING.md`), le mode autonome (`HEARTBEAT_RULES.md`) et des outputs (Executive Summary, Trend Radar). Rien ne les reliait en une source de vérité unique. Il voulait un « brain cloning » — un système central que ses agents peuvent lire pour agir comme lui.

## Options considérées
1. **Repo git en Markdown** — versionné, portable, lisible par tout agent IA, jamais perdu. Peut se brancher à Drive/Nexus plus tard. Contre : moins pratique à consulter du téléphone au quotidien.
2. **Google Drive** — facile à consulter, mais pas versionné, moins structuré, plus dur à faire lire proprement par des agents.
3. **App Nexus direct** — le produit fini, mais long à bâtir et surdimensionné pour un cerveau perso au départ.

## Pourquoi ce choix
Le repo git garde toutes les portes ouvertes : c'est la fondation la plus neutre et durable. Les agents (Heartbeat, futurs) lisent du Markdown nativement. Drive et Nexus pourront synchroniser/consommer cette source plus tard sans qu'on ait à refaire le travail. Option choisie par défaut car la fenêtre de choix s'est fermée avant réponse de Michel — à revalider avec lui.

## Conséquences / à revisiter si
- À revisiter si Michel veut absolument consulter/éditer depuis son téléphone au quotidien → ajouter une couche de sync Drive.
- À revisiter quand Nexus (l'app) sera assez mûre pour devenir l'interface principale → ce repo deviendrait le backend/seed.
