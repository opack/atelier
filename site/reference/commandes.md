# Commandes

## Commandes Claude Code

atelier est un plugin Claude Code : ces commandes se lancent **dans une session Claude Code ouverte sur le répertoire du projet**, pas dans un terminal.

| Commande | Étape | Rôle |
|---|---|---|
| `/atelier:init` | Projet | Installe atelier : contrôles, dossiers, section Process du `CLAUDE.md`, déclaration du plugin. |
| `/atelier:new [type] [source]` | Intention | Ouvre un chantier : identifiant, branche, dossier, spec construite en questionnant les manques, décision TDD. |
| `/atelier:sign` | Signature | Complétude, relecture critique, signature sur votre confirmation explicite. |
| `/atelier:plan` | Conception | Approche, fichiers, tranches → `plan.md` ; décisions → `decisions.md`. |
| `/atelier:amend <changement>` | Après signature | Modifie la spec signée : entrée datée, impact sur les critères, votre nouvel accord, commit. |
| `/atelier:write-tests [raison]` | Tests d’abord | TDD étapes 1 à 3 : tests depuis les CA, échec vérifié, relecture, commit, gel. Relancée sur des tests figés : les rouvre, raison tracée. |
| `/atelier:build [tranche]` | Implémentation | TDD étapes 4 et 5 (ou implémentation simple sans TDD) : code jusqu’au vert, vérification du surapprentissage, commit après validation. |
| `/atelier:review` | Revue | Contrôles, revue indépendante, traitement des points, autant de tours que nécessaire, `revue.md`, commit revu enregistré. |
| `/atelier:close` | Clôture | Revue à jour, `bilan.md`, verdict, vérifications déterministes, proposition de PR. |
| `/atelier:status` | Toutes | Chantier actif, statut, phase TDD, état de la revue, prochaine étape. |
| `/atelier:off <raison>` | Urgence | Débrayage : code autorisé sans spec, tracé. |

## Ligne de commande `atelier`

Utilisée par les commandes `/atelier:*` et par les hooks : l’agent la lance pour vous. C’est le seul moyen prévu de modifier l’état d’un chantier (statut, signature, TDD après signature, gel des tests, revue) : les outils d’édition de l’agent ne le peuvent pas.

| Commande | Rôle |
|---|---|
| `atelier status [--json]` | État du chantier actif, dont l’état de la revue (`reviewedCommit`, `reviewState` : `none`, `current` ou `stale`). |
| `atelier next-id <TYPE>` | Prochain identifiant du projet. |
| `atelier template <nom>` | Affiche un template (`spec-feat`, `plan`, `bilan`…). |
| `atelier check-spec <fichier>` | Liste ce qui manque dans une spec. |
| `atelier sign` | Signe la spec du chantier actif. Refuse si elle est incomplète ou n’est pas en brouillon. |
| `atelier set-tdd <yes\|no> [raison]` | Enregistre la décision TDD, tracée après signature. |
| `atelier freeze-tests` | Fige les tests commités (TDD) ; trace le regel après une réouverture. |
| `atelier reopen-tests <raison>` | Rouvre les tests figés, raison tracée. Refusée si la spec n’est pas signée, sans TDD ou si les tests ne sont pas figés. |
| `atelier tests-changed` | Liste les tests modifiés depuis leur gel. |
| `atelier checks` | Lance les contrôles configurés. |
| `atelier set-reviewed` | Enregistre le commit revu (`reviewed_commit`). Refusée sans spec signée, avec du code ou une spec non commités, ou en TDD si les tests ne sont pas figés ou ont changé. |
| `atelier close-check` | Vérifie que le chantier peut être clôturé : revue à jour, travail commité, tests figés en TDD, contrôles verts. |
| `atelier set-status <statut>` | Passe le chantier en `draft`, `done` ou `abandoned`. La signature ne passe que par `atelier sign`. Une spec non brouillon ne repasse pas en `draft` ; `done` refait les vérifications de `close-check`. |
| `atelier bypass on <raison>` / `off` | Active ou lève le débrayage. |
| `atelier hook-guard`, `hook-gate`, `hook-session-start` | Réservées aux hooks, voir [Hooks et configuration](./configuration). |

## Sous-agents

| Sous-agent | Quand | Rôle |
|---|---|---|
| `spec-critic` | Avant signature | Relit la spec sans voir la conversation : ambiguïtés, cas limites, critères invérifiables. |
| `overfit-checker` | Après le passage au vert | Vérifie que le code résout la spec et ne surapprend pas les tests. |
| `reviewer` | À la revue, à chaque tour | Revue indépendante en huit dimensions, sans rien modifier. |
