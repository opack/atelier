# Commandes

## Commandes Claude Code

atelier est un plugin Claude Code : ces commandes se lancent **dans une session Claude Code ouverte sur le répertoire du projet**, pas dans un terminal.

| Commande | Étape | Rôle |
|---|---|---|
| `/atelier:init` | Projet | Installe atelier : contrôles, dossiers, section Process du `CLAUDE.md`, déclaration du plugin. Relancée sur un projet installé : propose d’ajouter les lignes de la section Process qui manquent. |
| `/atelier:new [type] [source]` | Intention | Ouvre un chantier : identifiant (après `git fetch`), branche, dossier, spec construite en questionnant les manques, décision TDD (sauf EPIC), relations si le contexte en suggère, commit et push du brouillon (qui réserve l’identifiant). Propose un EPIC pour une demande à plusieurs livrables. |
| `/atelier:sign` | Signature | Complétude, relecture critique, signature sur votre confirmation explicite. |
| `/atelier:plan` | Conception | Approche, fichiers, tranches → `plan.md` ; décisions → `decisions.md`. Pour un EPIC : le découpage en chantiers (`plan-epic`). |
| `/atelier:amend <changement>` | Après signature | Modifie la spec signée : entrée datée, impact sur les critères, votre nouvel accord, commit. |
| `/atelier:write-tests [raison]` | Tests d’abord | TDD étapes 1 à 3 pour la tranche en cours : tests de ses CA, échec vérifié, relecture, commit, gel. Relancée avec une raison : rouvre des tests figés (de la tranche, ou d’une tranche précédente), raison tracée. |
| `/atelier:build` | Implémentation | TDD étapes 4 et 5 (ou implémentation simple sans TDD) pour la tranche en cours : code jusqu’au vert, vérification du surapprentissage, commit après validation. Argument de tranche réservé au `SPIKE` sans TDD. |
| `/atelier:review` | Revue | Revue de la tranche en cours, puis revue du chantier après la dernière : contrôles, revue indépendante, traitement des points, autant de revues que nécessaire, `revue.md`, votre validation, passage à la tranche suivante ou commit revu enregistré. |
| `/atelier:close` | Clôture | Toutes les tranches revues, revue du chantier à jour (sauf SPIKE sans TDD et EPIC), dépendances livrées, enfants d’un EPIC clos, `bilan.md`, verdict, vérifications déterministes, proposition de PR. |
| `/atelier:status` | Toutes | Chantier actif, statut, tranche en cours, phase TDD, état de la revue, relations, prochaine étape. |
| `/atelier:off <raison>` | Urgence | Débrayage : code autorisé sans spec, tracé. |

## Ligne de commande `atelier`

Utilisée par les commandes `/atelier:*` et par les hooks : l’agent la lance pour vous. C’est le seul moyen prévu de modifier l’état d’un chantier (statut, signature, TDD après signature, gel des tests, revue) : les outils d’édition de l’agent ne le peuvent pas.

| Commande | Rôle |
|---|---|
| `atelier status [--json]` | État du chantier actif, dont la tranche en cours (`slice` : numéro ou `"chantier"`, `sliceCount` : nombre de tranches du plan ; `null` pour un chantier à tranche unique), l’état de la revue (`reviewedCommit`, `reviewState` : `none`, `current` ou `stale`) et ses relations (parent, dépendances, origine, remplacement, enfants d’un EPIC, avec leur statut dans la branche courante). |
| `atelier next-id <TYPE>` | Prochain identifiant du projet. Le compteur est commun à tous les types et suit le plus grand numéro trouvé dans les dossiers de chantier, les identifiants en tête de segment des noms de branche (`fix/BUG-421-x`) et les identifiants entre crochets des sujets de commit (`[FEAT-7]`) : un `CA-13` ou un `UTF-8` dans la prose d’un commit ne compte pas. |
| `atelier template <nom>` | Affiche un template (`spec-feat`, `spec-epic`, `plan`, `plan-epic`, `process`, `bilan`…). |
| `atelier check-spec <fichier>` | Liste ce qui manque dans une spec, relations comprises (identifiants connus, parent EPIC unique et ouvert, ni auto-référence ni cycle). |
| `atelier check-process` | Liste les lignes de la section « Process (atelier) » absentes du `CLAUDE.md` du projet. |
| `atelier sign` | Signe la spec du chantier actif. Refuse si elle est incomplète ou n’est pas en brouillon. |
| `atelier set-tdd <yes\|no> [raison]` | Enregistre la décision TDD, tracée après signature. `yes` est refusé sur un EPIC. |
| `atelier freeze-tests` | Fige les tests commités (TDD) ; écrit `slice: 1` au premier gel ; trace le regel après une réouverture. Refusée si une ligne d’un test d’une tranche précédente a été modifiée ou supprimée sans réouverture, ou si `slice_base` n’est plus un ancêtre de `HEAD`. |
| `atelier reopen-tests <raison>` | Rouvre les tests figés, raison tracée ; aussi les tests des tranches précédentes, en phase « tests d’abord » d’une tranche N > 1. Refusée si la spec n’est pas signée, sans TDD, si rien n’est figé (tranche 1) ou si les tests sont déjà rouverts. |
| `atelier tests-changed` | Liste les tests modifiés depuis leur gel. |
| `atelier checks [--force]` | Lance les contrôles configurés, sauf s’ils sont déjà verts sur l’état actuel du code (fichiers non commités compris) : il le dit et ne les relance pas. Ce résultat est partagé avec `close-check`, `set-status done` et le contrôle de fin de tour. `--force` relance quand même, par exemple après un changement que git ne voit pas (fichier ignoré, version de Node). |
| `atelier review-ids [--json]` | Prochains numéros des points de relecture du chantier actif, un par préfixe (`RB`, `RD` : revue de code, lus dans `revue.md` ; `SB`, `SD` : relecture de spec, `OB`, `OD` : surapprentissage, lus dans `spec.md` et `decisions.md`), et les points de revue ouverts, dont la dernière occurrence n’a pas de traitement (identifiant, intitulé, section). Sans fichier : tous les numéros à 1. Les commandes `/atelier:*` passent ces numéros aux sous-agents. |
| `atelier set-reviewed` | Après votre validation de la revue : passe à la tranche suivante (`slice`, `slice_base`), ou à la revue du chantier après la dernière (`slice: chantier`, `last_slice`) ; pour la revue du chantier ou un chantier à tranche unique, enregistre le commit revu (`reviewed_commit`). Refusée sans spec signée, avec du code ou une spec non commités, en TDD si les tests ne sont pas figés ou ont changé, pour une tranche vide, si `slice_base` n’est plus un ancêtre de `HEAD`, ou si `revue.md` (copie de travail) a un problème : point sans traitement reconnu, mal formé ou mal rangé, identifiant en double, renvoi manquant (voir [Revue](../cycle/revue#_4-consigner-valider-passer-a-la-suite)) ; elle liste alors ces problèmes. |
| `atelier close-check` | Vérifie que le chantier peut être clôturé : toutes les tranches du plan revues et revue du chantier à jour (sauf SPIKE sans TDD et EPIC), travail commité, tests figés en TDD, contrôles verts, dépendances `done` dans la branche courante, aucun point de `revue.md` ouvert (sans traitement, ou encore `reporté (tranche N)`) ni autre problème de `revue.md` (voir [Revue](../cycle/revue#_4-consigner-valider-passer-a-la-suite)), et `revue.md` commité (sauf SPIKE sans TDD et EPIC) ; pour un EPIC, enfants tous clos dont au moins un `done`. |
| `atelier set-status <statut>` | Passe le chantier en `draft`, `done` ou `abandoned`. La signature ne passe que par `atelier sign`. Une spec non brouillon ne repasse pas en `draft` ; `done` refait les vérifications de `close-check`. `abandoned` sur un EPIC liste ses enfants encore ouverts, sans cascade. |
| `atelier bypass on <raison>` / `off` | Active ou lève le débrayage. |
| `atelier hook-guard`, `hook-gate`, `hook-session-start` | Réservées aux hooks, voir [Hooks et configuration](./configuration). |

## Sous-agents

| Sous-agent | Quand | Rôle |
|---|---|---|
| `spec-critic` | Avant signature | Relit la spec sans voir la conversation : ambiguïtés, cas limites, critères invérifiables. Points `SB1`… (bloquants), `SD1`… (à discuter). |
| `overfit-checker` | Après le passage au vert | Vérifie que le code résout la spec et ne surapprend pas les tests. Points `OB1`…, `OD1`…. |
| `reviewer` | À chaque revue, jusqu’à ce que chaque point ait un traitement | Points `RB1`…, `RD1`…, numérotés sur tout le chantier ; reprend un point encore ouvert sous son identifiant. Revue de tranche en huit dimensions, ligne à ligne ; revue du chantier transversale (couverture des CA, cohérence entre tranches, restes, écarts). Ne modifie rien. |
