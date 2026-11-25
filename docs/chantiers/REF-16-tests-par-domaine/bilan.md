# Bilan : REF-16 Tests rangés par domaine

## 1. Résumé
`plugins/atelier/test/core.test.mjs` (2672 lignes, 44 `describe`, un seul fichier rangé par historique) est découpé en 18 fichiers par domaine plus `helpers.mjs`. Plus aucun nom de chantier dans les `describe`, les étiquettes de critère sont en suffixe `[<ID> CA-x]`. Comportement inchangé : 314 tests avant, 314 après, prouvé par `check-moves.mjs`. Premier lot d'EPIC-17 ; sa table des domaines sert au découpage de `lib/` (lot 2).

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : `core.test.mjs` supprimé, table du plan respectée, aucun fichier au-delà de 400 lignes | livré | revues de tranche 4 et du chantier (table relue `describe` par `describe`) ; plus long fichier : `write-guard.test.mjs`, 322 lignes |
| CA-2 : aucun identifiant de chantier dans un `describe` | livré | recherche `(FEAT\|FIX\|TEC\|REF\|EPIC\|DOC\|OPS)-\d` sur les lignes `describe(`, revues de tranche 4 et du chantier |
| CA-3 : étiquettes en suffixe, plus de `V-x`, aucune étiquette ajoutée | livré | `check-moves.mjs` (forme nouvelle exigée pour chaque nom de la base) ; TAP relu en revue 3 de la tranche 2 : 237 étiquetés, 77 sans étiquette inchangés |
| CA-4 : `check-moves.mjs` vert sur la base `8c1a799` | livré | `check-moves.mjs` : 314 tests, 0 en échec, 232 renommés, écart de `describe` 4 (les 4 scissions) |
| CA-5 : rangement de `test/` décrit dans la section Structure de `CLAUDE.md` | livré | `CLAUDE.md:9`, relu en revue 2 du chantier |

Écarts par rapport à la spec initiale, tous tracés en amendements : fusion de `main` en cours de route (base déplacée à `8c1a799`, `check-spec-ellipsis.test.mjs` entré dans le périmètre, domaine `checks` ajouté) ; contrôle de lignes ajusté trois fois (scissions, titres normalisés, commentaires de section) ; tous les tests renommés sur place en tranche 2 avant les déplacements ; CA-5 ajouté par la revue du chantier.

## 3. Choix techniques
- Preuve par contrôle mécanique, pas par relecture : `check-moves.mjs` rejoue la base dans un `git worktree` temporaire, compare les noms de tests (TAP) en multiensembles et les lignes non vides aux seules différences tolérées du §4. Sabotages rejoués en tranche 1 (assertion modifiée, test supprimé, renommage hors règle, assertion déplacée) : tous refusés.
- Déplacement par script versionné (`move-tests.mjs`), un domaine par commit, `check-moves.mjs` après chaque domaine.
- `helpers.mjs` exporte par un bloc unique en fin de fichier, pour que les lignes de définition restent identiques au contrôle de lignes.
- Renommage de tous les tests sur place avant les déplacements des tranches 3 et 4 : le contrôle n'accepte plus que la forme nouvelle.
- `review-points` scindé en quatre sous-domaines (`reading`, `checks`, `numbering`, `refusal`), 546 lignes en tout.
- Correspondance `V-n` = `CA-n` pour TEC-5 et TEC-6, notée dans la spec de REF-16 sans toucher à celles de TEC-5 et TEC-6. Le compte réel de tests `V-x` est 30, pas 17 comme le disait EPIC-17.

## 4. Éléments de code principaux
- `CLAUDE.md` (section Structure) : la convention de rangement, à lire en premier avant d'ajouter un test.
- `plugins/atelier/test/helpers.mjs` : fixtures de chantiers, dépôts git temporaires et leur nettoyage (`after`), appel de la CLI (`atelier`, `atelierRun`, `atelierOk`).
- `plugins/atelier/test/<domaine>.test.mjs` : `common`, `identifiers`, `spec`, `spec-ellipsis`, `relations`, `write-guard`, `stop-hook`, `checks`, `tdd`, `slices`, `review`, `review-points-{reading,checks,numbering,refusal}`, `close`, `next-step`, `docs`.
- `plan.md`, table « describe → fichier » : où est passé chaque `describe` de l'ancien `core.test.mjs`.
- `docs/chantiers/REF-16-tests-par-domaine/check-moves.mjs` : la preuve, valable au commit de clôture seulement (base et nombre de tests en dur).
- `docs/chantiers/REF-16-tests-par-domaine/move-tests.mjs` : trace de la façon dont les fichiers ont été produits ; ne se rejoue plus depuis la suppression de `core.test.mjs`.

## 5. Pistes écartées
- Garder une liste figée des noms de base dans le dossier du chantier : ne se revérifie pas ; remplacée par le rejeu de la base dans un worktree.
- Ignorer en entier les lignes de titre ou toute ligne `export` : laisserait passer un changement du reste de la ligne.
- Réunir les tests d'un `describe` scindé dans un `describe` existant de la destination : mêle des origines.
- Refaire la fusion de `main` pour donner `[REF-16]` à son commit : réécrit l'historique d'une branche déjà poussée.
- Déplacer à la main, hors script versionné : le relecteur ne voit plus comment les fichiers ont été produits.
- `review-points` en deux fichiers : le contrôle des points seul fait environ 300 lignes.

## 6. Dette et suites
Pour le lot 2 d'EPIC-17 (découpage de `lib/` et test d'architecture, CA-7), restes de la revue 1 du chantier :
- D1 : `spec-ellipsis.test.mjs:9-13` duplique `templatesDirectory` et `template` de `helpers.mjs` (hérité de FIX-22, que le contrôle de lignes empêchait de retirer).
- D2 : `spec-ellipsis.test.mjs:69` cite « CA-17 et CA-18 » hors de son étiquette finale ; il fera échouer la règle de CA-7 d'EPIC-17 : reformuler le nom ou préciser la règle.
- D6 : `spec-ellipsis.test.mjs:1` garde le dernier commentaire d'en-tête par chantier (`// FIX-22:`).

Autres :
- `write-guard.test.mjs` (322 lignes) et `identifiers.test.mjs` (314) approchent du seuil de 400 : à scinder par le premier chantier qui les fait déborder.
- Consignes de rangement dans les skills `write-tests` et `build` : lots 3 et 4 d'EPIC-17 (`CLAUDE.md` sert de repère d'ici là).
- `check-moves.mjs` échouera dès qu'un test sera ajouté après REF-16 : c'est attendu, ce n'est pas une régression.
- Le commit de fusion `6585ba5` ne porte pas `[REF-16]` (décision de la revue de la tranche 2, D2).
- Hors périmètre, constatés pendant le chantier : `atelier status` signale à tort deux « … » cités dans la spec (FIX-22) ; sous Windows, `atelier` lancé depuis PowerShell ouvre « Ouvrir avec… » (`bin/atelier` sans extension) ; pour un chantier sans TDD, la prochaine étape reste « Implémenter » alors que la tranche est commitée. Deux chantiers FIX à ouvrir pour les deux derniers.

## 7. Verdict de revue
11 revues, toutes consignées dans `revue.md` :
- tranche 1 : 3 revues ; 1 bloquant (le contrôle de lignes refusait l'ouverture ajoutée par une scission), corrigé (65812e3) et spec amendée ; 9 à discuter, traités ou écartés avec raison ;
- tranche 2 : 4 revues ; aucun bloquant ; 7 à discuter : 6 traités, dont deux amendements de la spec, 1 écarté par décision de l'utilisateur ;
- tranche 3 : 1 revue ; aucun bloquant ; 4 à discuter portant sur l'outil, reportés à la tranche 4 et traités (ef5a709) ;
- tranche 4 : 1 revue ; aucun point ;
- chantier : 2 revues ; aucun bloquant ; 7 à discuter : D3, D4, D5 corrigés (D5 par amendement et CA-5), D1, D2, D6 reportés au lot 2 d'EPIC-17, mise en forme de `revue.md` corrigée.

Aucune exception acceptée. Revue enregistrée au commit `6b2a81b`.

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-23
