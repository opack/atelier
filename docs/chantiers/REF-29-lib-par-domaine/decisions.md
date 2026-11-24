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
