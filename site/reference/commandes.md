# Commandes

## Commandes Claude Code

| Commande | Étape | Rôle |
|---|---|---|
| `/atelier:init` | Projet | Installe atelier : contrôles, dossiers, section Process du `CLAUDE.md`, déclaration du plugin. |
| `/atelier:new [type] [source]` | Intention | Ouvre un chantier : identifiant, branche, dossier, spec construite en questionnant les manques, décision TDD. |
| `/atelier:sign` | Signature | Complétude, relecture critique, signature sur votre confirmation explicite. |
| `/atelier:plan` | Conception | Approche, fichiers, tranches → `plan.md` ; décisions → `decisions.md`. |
| `/atelier:tests` | Tests d’abord | TDD étapes 1 à 3 : tests depuis les CA, échec vérifié, relecture, commit, gel. |
| `/atelier:build [tranche]` | Implémentation | TDD étapes 4 et 5 (ou implémentation simple sans TDD) : code jusqu’au vert, vérification du surapprentissage, commit après validation. |
| `/atelier:close` | Clôture | Contrôles, revue indépendante, `bilan.md`, verdict, proposition de PR. |
| `/atelier:status` | Toutes | Chantier actif, statut, phase TDD, prochaine étape. |
| `/atelier:off <raison>` | Urgence | Débrayage : code autorisé sans spec, tracé. |

## Ligne de commande `atelier`

Utilisée par les commandes et les hooks, disponible aussi dans votre terminal Claude Code. C’est le seul moyen prévu de modifier l’état d’un chantier (statut, signature, TDD après signature, gel des tests) : les outils d’édition de l’agent ne le peuvent pas.

| Commande | Rôle |
|---|---|
| `atelier status [--json]` | État du chantier actif. |
| `atelier next-id <TYPE>` | Prochain identifiant du projet. |
| `atelier template <nom>` | Affiche un template (`spec-feat`, `plan`, `bilan`…). |
| `atelier check-spec <fichier>` | Liste ce qui manque dans une spec. |
| `atelier sign` | Signe la spec du chantier actif. Refuse si elle est incomplète ou n’est pas en brouillon. |
| `atelier set-tdd <yes\|no> [raison]` | Enregistre la décision TDD, tracée après signature. |
| `atelier freeze-tests` | Fige les tests commités (TDD). |
| `atelier reopen-tests <raison>` | Rouvre les tests, raison tracée. |
| `atelier tests-changed` | Liste les tests modifiés depuis leur gel. |
| `atelier checks` | Lance les contrôles configurés. |
| `atelier set-status <statut>` | Passe le chantier en `draft`, `done` ou `abandoned`. La signature ne passe que par `atelier sign`. |
| `atelier bypass on <raison>` / `off` | Active ou lève le débrayage. |

## Sous-agents

| Sous-agent | Quand | Rôle |
|---|---|---|
| `spec-critic` | Avant signature | Relit la spec sans voir la conversation : ambiguïtés, cas limites, critères invérifiables. |
| `overfit-checker` | Après le passage au vert | Vérifie que le code résout la spec et ne surapprend pas les tests. |
| `reviewer` | À la clôture | Revue indépendante en sept dimensions, sans rien modifier. |

::: info `/atelier:slice`
Longtemps prévue pour implémenter tranche par tranche, elle a été abandonnée : `/atelier:build` couvre ce besoin.
:::
