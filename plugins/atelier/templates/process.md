## Process (atelier)
- Toute modification passe par un chantier : `docs/chantiers/<ID>-<slug>/`, branche `<type>/<ID>-<slug>`.
- Pas de modification de code tant que `spec.md` n'a pas `status: signed`.
- Avant de déclarer une tâche terminée : contrôles de `.claude/atelier.json` verts.
- Commits : `<prefix>(<scope>): [<ID>] <description>` ; titre de PR : `[<ID>] <titre>`.
- Décision prise en cours de chantier : une entrée datée dans `decisions.md`.
- Sujet qui couvre plusieurs livrables : un EPIC d'abord (`/atelier:new`), puis des chantiers rattachés par `rel_parent` ; les autres liens se déclarent dans l'en-tête de la spec (`rel_depends_on`, `rel_origin`, `rel_replaces`).
