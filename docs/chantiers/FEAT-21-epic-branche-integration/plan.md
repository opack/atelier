# Plan : FEAT-21 EPIC en branche d'intégration

## Approche

Un nouveau domaine `integration`, parce que la règle de base traverse relations, revue, tranches et clôture et qu'elle doit être calculée en un seul endroit :

- `lib/integration.mjs` (pur) : lecture de l'option, problèmes de l'option pour `check-spec`, `chantierBase(index, id | parent)` qui remonte `rel_parent` jusqu'au premier EPIC à l'option (cycle ou parent introuvable : branche par défaut + avertissement), choix de la référence git à partir des faits (locale, distante, ancêtres l'une de l'autre), problèmes d'intégrité des revues des enfants (CA-9).
- `lib/cli/integration.mjs` : lecture git de la référence (`rev-parse`, `merge-base --is-ancestor`), commande `atelier base --parent <ID>`, `baseBranch` pour `status --json`.
- Les autres domaines appellent ce module au lieu de `defaultBaseRef` là où la spec parle de base : `sliceCodeFiles`, `codeFilesSince` (refs à exclure), `chantierIdFromBranchCommits` (`--first-parent`).

Un seul ajout à l'existant qui n'est pas dans la spec : l'index des chantiers garde le **nom du dossier** de chaque chantier (aujourd'hui il ne garde que l'identifiant), sans quoi on ne peut pas construire `epic/<ID>-<slug>` depuis la branche par défaut (CA-4).

Pour éviter de construire l'index quand ce n'est pas nécessaire : un chantier sans `rel_parent` et pas EPIC prend directement la branche par défaut, sans lire les autres branches (CA-1, perf §6).

## Fichiers et couches touchés

- `lib/integration.mjs`, `lib/cli/integration.mjs` : nouveaux (logique et entrées / sorties de la base).
- `lib/relations.mjs`, `lib/cli/relations.mjs` : dossier dans l'index ; messages de `relationCloseProblems` qui nomment la branche d'intégration (CA-10).
- `lib/spec.mjs` ou `lib/cli/spec.mjs` : appel des problèmes de l'option dans `check-spec` (CA-2).
- `lib/write-guard.mjs` : `integration_branch` dans `FROZEN_AFTER_SIGNATURE_FIELDS` (CA-3).
- `lib/cli/slices.mjs` : `sliceCodeFiles` sur la base, refs à exclure étendues à la branche d'intégration (CA-7, CA-15).
- `lib/cli/identifiers.mjs` : détection par les commits en `--first-parent` (CA-13).
- `lib/close.mjs`, `lib/cli/close.mjs` : `isReviewExempt` (EPIC à l'option soumis à revue), intégrité des revues des enfants, message de refus (CA-8, CA-9).
- `lib/next-step.mjs` : étape suivante d'un EPIC à l'option (CA-14).
- `lib/cli/next-step.mjs`, `lib/cli.mjs` : `baseBranch` dans `status --json`, commande `base`.
- Skills `new`, `plan`, `review`, `close`, agent `reviewer`, template `spec-epic.md` ; site : `fondations/chantier.md`, `fondations/types.md`, `cycle/conception.md`, `cycle/revue.md`, `cycle/cloture.md`, `reference/commandes.md` (CA-11, CA-12).
- Tests : `test/integration.test.mjs` (scindé en `integration-close.test.mjs` au-delà de 400 lignes), plus un test chacun dans `write-guard`, `identifiers`, `slices`, `relations`, `next-step`, `docs`.

## Tranches

1. **L'option et la base** : lecture et contrôle de l'option, gel après signature, calcul de la base (EPIC imbriqués, cycle, parent introuvable), `atelier base --parent`, `baseBranch` dans `status --json`. CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5.
2. **La base dans git** : référence de la branche d'intégration (locale ou distante, divergence, absence), tranche 1 et revue comptées depuis cette base, fusion de la branche d'intégration traitée comme celle de la branche par défaut, détection du chantier en `--first-parent`. CA couverts : CA-6, CA-7, CA-13, CA-15.
3. **La clôture** : revue d'ensemble exigée pour l'EPIC à l'option, intégrité des revues des enfants (rebase, squash), messages des dépendances, étape suivante de l'EPIC. CA couverts : CA-8, CA-9, CA-10, CA-14.
4. **Skills, agent, template et site** : parent demandé avant la branche, point de départ, base de revue, `--first-parent` pour la règle des commits, cible et mode de fusion, revue d'ensemble et enfant correctif, fusion de la branche par défaut sans rebase. CA couverts : CA-11, CA-12.

## Risques et points d'attention

- **Conflits avec les branches ouvertes** : FIX-20 touche `slices`, `tdd` et `next-step` (tranches 2 et 3), FEAT-27 touche les skills `review`, `build`, `sign` (tranche 4). Parade : fusionner `main` au début de chaque tranche ; la tranche 4 attend idéalement que FEAT-27 soit fusionné.
- **Repli silencieux sur la branche par défaut** (CA-6) : à relire ligne à ligne, c'est lui qui gonflerait une revue de tout le travail des enfants frères. Toute erreur de résolution arrête la commande.
- **Non-régression** (CA-1) : la suite existante doit passer sans modification à chaque tranche ; un chantier sans `rel_parent` ne déclenche aucune lecture supplémentaire.
- **Coût de l'index** : une seule construction par commande, partagée entre `relationsSummary` et le calcul de la base (aujourd'hui `status` le construit déjà pour les relations).
- **Version** : FEAT-27 vise 0.6.0 ; la version de FEAT-21 se décide à la clôture selon l'ordre des fusions.
