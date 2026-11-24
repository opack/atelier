# Décisions : REF-29 lib/ rangé par domaine

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-24 : `core.mjs` devient une façade de réexports, pas supprimé
- Contexte : FIX-20 (en pause), FEAT-21 et FEAT-27 importent `../lib/core.mjs`, FIX-20 depuis des tests figés.
- Écarté : supprimer `core.mjs`, parce que ces tests casseraient à la fusion et devraient être rouverts.
- Conséquence : façade sans logique, gardée par le test d'architecture ; une branche ouverte avant REF-29 peut y ajouter un réexport (SB6) ; suppression par un chantier ultérieur.

## 2026-11-24 : la preuve est une comparaison déclaration par déclaration, pas ligne à ligne
- Contexte : relecture de la spec (SD2) : un multiensemble de lignes laisse passer l'échange de deux lignes entre fonctions.
- Écarté : le contrôle par lignes de REF-16, parce que dans `cli.mjs` tout est privé et rien ne le rattraperait.
- Conséquence : `check-moves.mjs` découpe les déclarations de premier niveau, éprouvé sur la base et sur trois mutations fabriquées.

## 2026-11-24 : placements de déclarations hors de leur section d'origine
- Contexte : la table du plan range par comportement, pas par section de `core.mjs`.
- Écarté : suivre les sections telles quelles, parce que plusieurs mêlent deux domaines.
- Conséquence :
  - `specStatus` → `common` (garde, TDD, revue et clôture s'en servent) ;
  - amendements → `spec` ; `amendmentsDiffer` → `spec` (ne compare que des amendements) ;
  - `sliceLabel` → `slices` ; `setStatusRefusal` → `close` (refuse `done`) ; `setTddRefusal` → `tdd` ;
  - `applyToolEdit`, `shortRefName`, `parseCatFileBatch`, `parseTreeEntries` → `common` (tests dans `common.test.mjs`, analyse de sortie git) ; `chantierIdFromDirectoryName` → `identifiers` ;
  - `requireActiveChantier` → `cli/identifiers`, sinon cycle avec `cli/common` ;
  - `bypass` → `cli/write-guard` (débrayage de la garde) ; `status` et `hook-session-start` → `cli/next-step` ; `template` et `check-process` → `cli/docs` (SD9).

## 2026-11-24 : parade de latence prévue, pas appliquée d'avance
- Contexte : `hook-guard` chargera environ 28 modules au lieu de 2.
- Écarté : des `import()` paresseux dès le départ, parce que ça change la forme de `cli.mjs` sans mesure qui le justifie.
- Conséquence : mesure en tranche 1 (base) et en tranche 6 ; au-delà de +20 ms, amendement pour passer les commandes en `import()` paresseux.

## 2026-11-24 : base `f3ec902` (main après FIX-28), 340 tests
- Contexte : tranche 1, fusion de `main` dans la branche (`f192ef8`) après la PR #20 (FIX-28).
- Conséquence : `check-moves.mjs` compare à `f3ec902` : `core.mjs` 1799 lignes, `cli.mjs` 1096 lignes, 340 tests verts.

## 2026-11-24 : `codeFilesSince` et `defaultBranchRefsToExclude` (FIX-28) vont dans `cli/slices`, pas dans `cli/common`
- Contexte : le plan prévoyait `codeFilesSince` dans `cli/common` ; il appelle `defaultBranchRefsToExclude`, qui lit `defaultBaseRef` et `defaultBranchName` de `cli/identifiers`.
- Écarté : `cli/common`, parce que `cli/identifiers` importe `cli/common` (cycle). Écarté aussi : `cli/identifiers`, sans rapport avec le calcul du code d'une tranche.
- Conséquence : `cli/review` importe `codeFilesSince` depuis `cli/slices`, sens déjà prévu par le graphe.

## 2026-11-24 : latence de la base, médiane de `hook-guard` à 34 ms
- Contexte : tranche 1, `measure-hook.mjs` (20 lancements, édition de `lib/core.mjs`), trois séries dans le conteneur cloud : 34,3 / 34,2 / 33,2 ms.
- Conséquence : la mesure dépend de la machine. Depuis RD3 (revue de la tranche 1), `measure-hook.mjs` mesure les deux plugins dans la même séance : la base extraite par `git archive f3ec902 plugins/atelier` et la branche, lancés sur ce dépôt (même chantier actif), avec la même décision du hook exigée ; il échoue au-delà de +20 ms. Le seuil absolu de 54 ms n'est plus la référence.

## 2026-11-24 : `check-moves.mjs` accepte une ligne de test sous sa forme de base ou sa forme cible
- Contexte : les retouches tolérées des tests (préfixe `core.`, noms de `windows-launcher.test.mjs`) n'arrivent qu'en tranche 6 ; le script tourne à chaque tranche.
- Écarté : exiger la forme cible partout, parce que le script échouerait sur les tranches 1 à 5 sans régression.
- Conséquence : CA-5 et le renommage de `windows-launcher` se vérifient en tranche 6 (lecture des imports, test d’architecture pour les noms), pas par ce contrôle.

## 2026-11-24 : le socle passe en tranche 1, les domaines remontent d'un cran
- Contexte : `atelier set-reviewed` refuse une tranche sans code commité (« tranche vide ») ; la tranche 1 du plan ne touchait que `docs/`.
- Écarté : forcer la validation ou mettre l'outillage hors process, parce que le refus est la règle du plugin ; fusionner les tranches 1 et 2 en retirant la 2, parce qu'une tranche garde son numéro.
- Conséquence : six tranches toujours. Tranche 1 = outillage + socle ; tranche 2 = `identifiers`, `relations` ; 3 = `spec`, `docs`, `slices`, `tdd` ; 4 = `review-points`, `review`, `close`, `checks` ; 5 = `next-step`, `write-guard`, `stop-hook`, façade ; 6 inchangée.

## 2026-11-24 : imports régénérés par script, et `core.mjs` importe `cli/common` le temps du rangement
- Contexte : chaque déplacement change les imports de plusieurs modules ; à la main, un import manquant n'échoue qu'à l'appel.
- Écarté : écrire les imports à la main, parce qu'une omission passe `node --check` et ne casse qu'au premier appel (cas vu à l'essai : `...relationProblems` non détecté avant correction du script).
- Conséquence : `move.mjs` régénère tous les en-têtes après chaque déplacement ; sur la base, il redonne exactement les imports d'origine (vérifié avant le premier déplacement). Tant que `currentBranch` et les autres lectures git de `core.mjs` n'ont pas rejoint `cli/identifiers` (tranche 2), `core.mjs` importe `gitOutput` de `cli/common.mjs` : transitoire, la règle « pas de module pur qui importe `lib/cli/` » ne vaut qu'à la fin (test d'architecture, tranche 6).

## 2026-11-24 : `cli/slices` importe `reviewCodeFiles` depuis `core.mjs` le temps de la tranche 3
- Contexte : tranche 3, `sliceCodeFiles` (cli/slices) appelle `reviewCodeFiles`, qui ne rejoint `review.mjs` qu'en tranche 4.
- Conséquence : import transitoire d'un module de domaine vers `core.mjs`, sans cycle (`core.mjs` n'importe que `cli/common` et `cli/identifiers`) ; `move.mjs` le redirige vers `review.mjs` en tranche 4. Le test d'architecture de la tranche 6 pourra interdire tout import de `core.mjs` dans `lib/`.

## 2026-11-24 : renvois à `lib/core.mjs` dans les commentaires déplacés, reportés au bilan (RD8)
- Contexte : revue de la tranche 3 ; des commentaires de déclarations renvoient à « lib/core.mjs » (`cli/slices.mjs` pour `codeLogArguments`, `cli.mjs` pour `reviewProblems`, `closeProblems`, `decideStop`).
- Écarté : les corriger ici, parce que la spec interdit de retoucher le texte d'une déclaration (`check-moves.mjs` le refuserait).
- Conséquence : recensement par `grep -rn "lib/core.mjs" plugins/atelier/lib` dans « Dette et suites » du bilan, pour le chantier qui supprimera la façade.

## 2026-11-24 : le test d'architecture interdit aussi d'importer la façade (RD14)
- Contexte : revue de la tranche 6 ; CA-5 est tenu (aucun test n'importe `lib/core.mjs`), mais rien ne le gardait, et un module de `lib/` pouvait encore l'importer sans cycle (`cli.mjs`).
- Décision : règle de plus dans `architecture.test.mjs`, hors de la lettre de CA-4 : aucun fichier de `test/` ni de `lib/` n'importe `lib/core.mjs`, avec son exemple fabriqué. Accord de Didier.
- Conséquence : la façade ne sert plus qu'aux branches ouvertes avant REF-29, et sa suppression ne dépendra que d'elles.

## 2026-11-24 : messages de commit sans scope en tranche 6 (RD15)
- Contexte : quatre commits de la tranche 6 (10ecc98, 975aaa1, 102dddf, 10b3005) écrits `test:` ou `docs:` sans scope, contre la convention de `CLAUDE.md`.
- Décision : exception acceptée par Didier ; l'historique est déjà poussé et la PR est fusionnée en squash. Les commits suivants portent un scope.
