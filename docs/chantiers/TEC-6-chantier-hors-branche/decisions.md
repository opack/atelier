# TEC-6 Décisions

## 2026-11-20 — Branche par défaut : nom court de la base seulement
- Décision : la déduction est écartée quand la branche courante a le nom court de la base résolue (`origin/HEAD` → `origin/main` → `main`, `origin/master` → `master`, `main`, `master`).
- Écarté : exclure aussi `main` et `master` en dur, quelle que soit la base. Si `origin/HEAD` pointe vers une autre branche (`develop`), `main` n'est plus la branche par défaut du dépôt ; l'exclure en dur ajouterait une règle que la spec ne demande pas.

## 2026-11-20 — Existence d'une référence : `git rev-parse --verify --quiet <ref>^{commit}`
- Décision : un appel par candidat, arrêté au premier trouvé ; seulement sur une branche non conforme.
- Écarté : `git for-each-ref` en un seul appel, qui ne résout pas les noms courts (`main` local contre `origin/main`) aussi simplement et rend l'ordre de priorité moins lisible.
