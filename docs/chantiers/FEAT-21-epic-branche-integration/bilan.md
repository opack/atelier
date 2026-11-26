# Bilan : FEAT-21 EPIC en branche d'intégration

## 1. Résumé
Un EPIC peut déclarer `integration_branch: yes` : sa branche `epic/<ID>-<slug>` devient la base de ses enfants, qui en partent, y sont revus et fusionnés par commit de fusion, puis une revue d'ensemble précède une seule fusion dans la branche par défaut. Sans l'option, rien ne change. Livré en 4 tranches TDD (option et base, base dans git, clôture, skills et site) et une revue du chantier ; 498 tests verts, plugin en 0.8.0.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : sans EPIC à l'option, base = branche par défaut | Livré | `test/integration.test.mjs` (base of a chantier, status --json) |
| CA-2 : `check-spec` contrôle l'option | Livré | `test/integration.test.mjs` (integration_branch in the spec header) |
| CA-3 : option figée après signature | Livré | `test/write-guard.test.mjs` |
| CA-4 : enfant direct, base `epic/<dossier>`, `status --json`, `atelier base --parent` | Livré | `test/integration.test.mjs` |
| CA-5 : EPIC imbriqués, EPIC non ancêtre de lui-même | Livré | `test/integration.test.mjs` |
| CA-6 : référence locale ou distante la plus avancée, divergence et absence refusées | Livré | `test/integration-git.test.mjs`, `test/integration.test.mjs` (integrationRefChoice) |
| CA-7 : tranche 1 d'un enfant comptée depuis la branche d'intégration | Livré | `test/integration-git.test.mjs` |
| CA-8 : revue d'ensemble exigée pour l'EPIC à l'option | Livré | `test/integration-close.test.mjs` (dont fusion de main sans conflit après la revue, amendement OD6) |
| CA-9 : revues des enfants perdues (squash, rebase) signalées | Livré | `test/integration-close.test.mjs` |
| CA-10 : messages des dépendances (branche d'intégration, attente de la clôture de l'EPIC) | Livré | `test/integration-close.test.mjs` (dont le cas OD5, RD10) |
| CA-11 : règle des commits en `--first-parent` depuis `baseBranch` | Livré | `test/docs.test.mjs` |
| CA-12 : skills, agent, template et site | Livré | `test/docs.test.mjs` (mots-clés seulement, OD13) |
| CA-13 : détection du chantier en `--first-parent` | Livré | `test/integration-git.test.mjs` |
| CA-14 : étape suivante de l'EPIC à l'option | Livré | `test/integration-close.test.mjs` |
| CA-15 : fusion de la branche d'intégration dans un enfant revu sans périmer sa revue | Livré | `test/integration-git.test.mjs` (dont RD1 et OD4) |

Écarts, tous tracés : deux amendements (2026-11-25 : dépendance à REF-29, recalage des chemins, CA-15 ; 2026-11-26 : §3 `reviewFacts` exclut aussi les refs de la branche d'intégration (RD2), §2 fusion de main après la revue d'ensemble selon la règle de FIX-28 (OD6)). Deux réouvertures de tests (RD1 en tranche 2, RD10 en revue du chantier).

## 3. Choix techniques
- Nouveau domaine `integration` : la règle de base (`chantierBase`) est calculée en un seul endroit, pure, et reprise par `status`, `base`, la revue, les tranches et la clôture.
- Base d'un EPIC = base de son parent : un EPIC n'est pas son propre ancêtre, ce qui règle les EPIC imbriqués sans cas particulier.
- Nom de la branche d'intégration déduit du dossier de l'EPIC (`epic/<ID>-<slug>`), sans configuration ; l'index des chantiers garde le dossier pour pouvoir le calculer depuis la branche par défaut.
- Référence git : la plus avancée entre locale et `origin/…`, erreur nommant la branche sinon, jamais de repli silencieux sur la branche par défaut.
- Fusion de la branche d'intégration dans un enfant traitée comme celle de la branche par défaut depuis FIX-28 (refs exclues, seules les résolutions de conflits comptent) ; détection du chantier et règle des commits en `--first-parent`.
- EPIC à l'option sur le modèle « tranche unique » pour sa revue ; intégrité des revues des enfants vérifiée à la clôture de l'EPIC.

## 4. Éléments de code principaux
- `plugins/atelier/lib/integration.mjs` : option, `chantierBase`, `integrationRefChoice`, `integrationDeliveries`. À lire en premier.
- `plugins/atelier/lib/cli/integration.mjs` : lecture git de la référence (`baseRefOf`, `integrationBranchOf`), commande `atelier base --parent`.
- `plugins/atelier/lib/close.mjs` : `isReviewExempt`, `childReviewProblems` ; `lib/relations.mjs` : messages des dépendances et des enfants.
- `plugins/atelier/lib/cli/slices.mjs`, `lib/cli/review.mjs`, `lib/cli/tdd.mjs` : refs de la branche d'intégration exclues ; `lib/cli/identifiers.mjs` : `--first-parent`.
- `plugins/atelier/lib/next-step.mjs` : étape suivante de l'EPIC à l'option.
- Skills `new`, `plan`, `review`, `close`, agent `reviewer` (portée « revue d'ensemble de l'EPIC »), template `spec-epic.md`, site (`fondations/types.md#epic-a-branche-d-integration` en page de référence).

## 5. Pistes écartées
- Configuration au-delà du booléen (nom de branche, cible, stratégie) : hors périmètre.
- Repli sur la branche par défaut quand la branche d'intégration manque ou a divergé : une base fausse gonflerait la revue en silence ; erreur claire à la place.
- Cache de l'index des chantiers entre commandes : index construit une fois par commande et passé en paramètre.
- Périmer la revue d'ensemble à toute fusion de main (texte initial de §2) : remplacé par la règle de FIX-28 (OD6).
- Exiger `[<EPIC-ID>]` sur les fusions d'enfants (messages de PR non maîtrisés) et `--no-merges` (ne vérifierait plus la fusion de main) : dispense des fusions d'enfants à la place.
- `git pull` pour synchroniser une branche d'intégration divergente : rebase avec `pull.rebase=true` (RD7) ; fusion explicite à la place.

## 6. Dette et suites
- Aucun test ne couvre le parcours `set-reviewed` puis `close-check` d'un EPIC à l'option de bout en bout (vérifié à la main, idée de la revue du chantier).
- Les tests de CA-12 ne vérifient que des mots-clés (OD13, accepté).
- Le message de divergence de `integrationRefChoice` laisse l'ID de l'EPIC en gabarit (confort, revue 4 de la tranche 4).
- Branche distante orpheline `feat/FEAT-20-epic-branche-integration` à supprimer à la main.
- Relire le cadre pointeur d'EPIC-14 maintenant que l'option existe.

## 7. Verdict de revue
Revues de tranche : tranche 1 (1 revue, aucun point), tranche 2 (2 revues), tranche 3 (2 revues), tranche 4 (4 revues) ; revue du chantier (3 revues, la dernière pour la version). Vérifications de surapprentissage : OD1 à OD6 (tranches 1 à 3) et OB1, OB2, OD7 à OD13 (tranche 4), voir `decisions.md`.

| Point | Traitement |
|---|---|
| RD1. Tests apportés par la fusion de la branche d'intégration comptés comme tests du chantier | corrigé (8863dfe), test ajouté (64aa051) |
| RD2. §3 de la spec disait que `reviewFacts` ne change pas | spec amendée (0cf8e18) |
| RB1. Message « enfant pas fusionné » modifié sans l'option | corrigé (d078d02) |
| RD3. Débrayage sur la branche de l'EPIC sans commande ni levée | corrigé (3137c2b) |
| RD4. Traitements de revue d'ensemble non adaptés à l'EPIC | corrigé (3137c2b) |
| RD5. Branche d'intégration supposée présente et à jour en local | corrigé (3137c2b) |
| RD6. Virgule et description de review | corrigé (3137c2b) |
| RD7. Synchronisation par `git pull` | corrigé (e6f6ae4) |
| RD8. Message de divergence sans `[<ID>]` | corrigé (557c731) |
| RD9. Consigne de synchronisation citant l'EPIC pour la branche par défaut | corrigé (557c731) |
| RD10. Correctif OD5 sans test | test ajouté (d9746c1) |
| RD11. Deux règles pour la référence de `baseBranch` | corrigé (0c21128) |

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-26
