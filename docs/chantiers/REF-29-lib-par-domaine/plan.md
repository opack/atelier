# Plan : REF-29 lib/ rangé par domaine

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

On déplace des déclarations entières, de bas en haut du graphe d'import : d'abord le socle, puis chaque domaine une fois que ce qu'il importe a déjà son module. Pendant tout le chantier, `core.mjs` et `cli.mjs` restent des points d'entrée qui fonctionnent : à chaque déplacement, ils importent et réexportent le nouveau module. Les tests ne sont donc touchés qu'à la fin, en une fois. La preuve de non-régression vient de `check-moves.mjs`, qui compare les déclarations une à une, et non de la relecture du diff, illisible pour un déplacement de 2800 lignes. La revue lit donc la table ci-dessous, la sortie du script et les nouveaux en-têtes d'import.

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

- `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs` : le contrôle du §4 (nombre de tests, fichiers de tests, déclarations, lignes hors déclarations, exports de la façade), lancé avec le hash de la base.
- `docs/chantiers/REF-29-lib-par-domaine/move.mjs` et `base-exports.txt` : déplace des déclarations entières entre modules et régénère les en-têtes d'import de tous les modules (imports directs depuis le module qui définit, `export ` posé sur ce qu'un autre module utilise, réexports de la façade depuis la liste des exports de la base).
- `docs/chantiers/REF-29-lib-par-domaine/measure-hook.mjs` : 20 lancements de `atelier hook-guard`, donne la médiane (CA-7).
- `plugins/atelier/lib/<domaine>.mjs` (14 modules purs) et `plugins/atelier/lib/cli/<domaine>.mjs` (13 modules d’entrées / sorties) : nouveaux.
- `plugins/atelier/lib/core.mjs` : réduit à la façade. `plugins/atelier/lib/cli.mjs` : réduit à `commands` et `main`.
- `plugins/atelier/test/*.mjs` : imports nommés, retrait du préfixe `core.`, renommage de `windows-launcher.test.mjs`.
- `plugins/atelier/test/architecture.test.mjs` : nouveau.
- `CLAUDE.md` : sections Structure et Conventions.

### Table déclaration → module

Les noms sont ceux de la base. `E` signale un export de la base, qui reste réexporté par la façade. Tout ce qui n'est pas marqué était privé : il devient un export de son module seulement si un autre module s'en sert.

**Modules purs**

| Module | Déclarations | Lignes (≈) |
|---|---|---|
| `common.mjs` | `CHANTIER_TYPES` E, `DEFAULT_CONFIG` E, `parseFrontMatter` E, `setFrontMatterValues` E, `normalize`, `globToRegExp`, `matchesAny` E, `toProjectRelativePath` E, `parsePorcelainPaths` E, `applyToolEdit` E, `shortRefName` E, `parseCatFileBatch` E, `parseTreeEntries` E, `specStatus`, `parseGitVersion` E, `supportsRemergeDiff`, `codeLogArguments` E | 185 |
| `identifiers.mjs` | `ID_PATTERN`, `BRACKETED_ID_PATTERN`, `chantierIdFromText` E, `chantierIdFromCommitSubjects` E, `chantierIdFromDirectoryName` E, `highestChantierNumber` E, `commitSubjectIdentifiers` E, `branchNameIdentifiers` E, `nextChantierId` E | 70 |
| `relations.mjs` | `RELATION_FIELDS` E, `RELATION_ID_PATTERN`, `CLOSED_STATUSES`, `relationValues`, `parseRelations` E, `hasRelations` E, `chantierTreesOf` E, `buildChantierIndex` E, `statusHere` E, `isClosedHere` E, `versions`, `typeOf`, `linksOf`, `childrenOf` E, `describeRelation` E, `findCycle`, `relationProblems` E, `openChildren` E, `openChildProblem`, `relationCloseProblems` E | 210 |
| `spec.mjs` | `TDD_RECOMMENDATION` E, `REQUIRED_SECTIONS` E, `CRITERIA_SECTIONS`, `splitSections` E, `meaningfulContent` E, `UNFINISHED_TEXT`, `hideCode` E, `checkSpec` E, `AMENDMENTS_HEADING`, `SECTION_END`, `ENTRY_START`, `amendmentSectionRanges`, `parseAmendments` E, `appendAmendmentEntry` E, `amendmentsDiffer` E | 200 |
| `docs.mjs` | `checkProcessProblems` E | 25 |
| `slices.mjs` | `planSliceCount` E, `sliceState` E, `sliceLabel` | 50 |
| `tdd.mjs` | `testDrivenPhase` E, `reopenTestsEntry` E, `refreezeTestsEntry` E, `isRefreeze` E, `reopenTestsRefusal` E, `removedTestLines` E, `freezeTestsRefusal` E, `freezeTestsValues` E, `setTddRefusal` E | 110 |
| `review-points.mjs` | `POINT_TABLES`, `POINT_COLUMNS`, `POINT_PATTERN`, `EMPTY_POINT_PATTERN`, `tableCells`, `parsePointCell`, `isDelimiterRow`, `visibleLines`, `parseReviewPoints` E, `isNearPointTableTitle`, `TREATMENTS`, `isTreatment` E, `isPostponedToSlice`, `requalifiedTarget`, `reviewPointProblems` E, `REVIEW_ID_PREFIXES`, `nextReviewIds` E | 295 |
| `review.mjs` | `reviewCodeFiles` E, `reviewProblems` E, `reviewState` E, `setReviewedRefusal` E, `setReviewedUpdate` E | 100 |
| `close.mjs` | `isReviewExempt` E, `sliceCloseProblems`, `closeProblems` E, `setStatusRefusal` E | 75 |
| `next-step.mjs` | `nextStep` E, `codeCommittedMatters` E, `phaseStep` | 85 |
| `write-guard.mjs` | `COMMAND_SPEC_FIELDS` E, `FROZEN_AFTER_SIGNATURE_FIELDS`, `specWriteRefusal`, `amendmentRefusal`, `decideWrite` E | 150 |
| `checks.mjs` | `checksGreenOn` E, `withGreen` E | 15 |
| `stop-hook.mjs` | `decideStop` E | 55 |

**Modules d'entrées / sorties**

| Module | Déclarations | Lignes (≈) |
|---|---|---|
| `cli/common.mjs` | `findProjectRoot` E, `configPath` E, `loadConfig` E, `gitOutput`, `pluginRoot` (modifié, SB3), `requireConfig`, `readStandardInput`, `today`, `gitUserName`, `git`, `gitRaw`, `gitPaths`, `gitObjectExists`, `committedFileText`, `uncommittedFiles`, `isAncestor`, `isAncestorOfHead`, `cachedGitVersion`, `gitVersion`, `chantierFilePath`, `samePath` | 190 |
| `cli/identifiers.mjs` | `currentBranch` E, `findChantierDirectory` E, `readChantier` E, `BASE_REF_CANDIDATES`, `defaultBaseRef` E, `branchCommitSubjects` E, `defaultBranchName` E, `chantierIdFromBranchCommits`, `activeChantier` E, `requireActiveChantier`, `gitLines`, `collectUsedIdentifiers` E, `commandNextId` | 120 |
| `cli/relations.mjs` | `chantiersHere`, `catFileBatch`, `chantierIndex`, `isEpic`, `needsIndex`, `relationsSummary`, `formatRelation`, `formatRelations` | 90 |
| `cli/spec.mjs` | `updateSpec`, `appendAmendment`, `specProblems`, `commandCheckSpec`, `commandSign` | 60 |
| `cli/docs.mjs` | `commandCheckProcess`, `commandTemplate` | 30 |
| `cli/slices.mjs` | `slicePosition`, `codeFilesSince`, `defaultBranchRefsToExclude`, `sliceCodeFiles` | 45 |
| `cli/tdd.mjs` | `uncommittedTestFiles`, `testFilesChangedSince`, `testFilesWithRemovedLines`, `commandFreezeTests`, `commandReopenTests`, `commandSetTdd`, `commandTestsChanged` | 130 |
| `cli/review.mjs` | `reviewFacts`, `reviewSummary`, `commandSetReviewed` | 75 |
| `cli/review-points.mjs` | `commandReviewIds` | 25 |
| `cli/close.mjs` | `closeCheckProblems`, `formatCloseProblems`, `commandCloseCheck`, `commandSetStatus` | 80 |
| `cli/checks.mjs` | `runChecks`, `runChecksOnce`, `commandChecks`, `gateStatePath`, `readGateState`, `cachedGateState`, `currentTreeId`, `workingTreeId` | 110 |
| `cli/write-guard.mjs` | `bypassPath`, `readBypass`, `commandBypass`, `denyWrite`, `hookGuard`, `guardWrite` | 95 |
| `cli/stop-hook.mjs` | `hookGate`, `gate` | 45 |
| `cli/next-step.mjs` | `commandStatus`, `formatStatus`, `codeCommittedFact`, `hookSessionStart` | 125 |
| `cli.mjs` | `commands`, `main` | 50 |

**Placements à justifier** (une ligne chacun dans `decisions.md`) :
- `specStatus` va dans `common` : il est utilisé par la garde, TDD, la revue et la clôture.
- Les amendements vont dans `spec` : la tranche les lit, mais c'est une section de la spec.
- `amendmentsDiffer` va dans `spec`, alors qu'il était rangé sous « Review » : il ne compare que des amendements.
- `sliceLabel` va dans `slices`, et non dans « Close ».
- `setStatusRefusal` va dans `close`, et non dans la garde, parce qu'il refuse `done` ; `setTddRefusal` va dans `tdd`.
- `applyToolEdit` va dans `common`, parce que ses tests sont dans `common.test.mjs`.
- `chantierIdFromDirectoryName` va dans `identifiers`, et `shortRefName`, `parseCatFileBatch` et `parseTreeEntries` dans `common` (analyse de sortie git).
- `requireActiveChantier` va dans `cli/identifiers` plutôt que dans `cli/common`, sinon il y aurait un cycle `cli/common` ↔ `cli/identifiers`.
- `bypass` va dans `cli/write-guard` : c'est le débrayage de la garde, que `gate` et `status` se contentent de lire (SD9).
- `status` et `hook-session-start` vont dans `cli/next-step` : ils affichent la prochaine étape (SD9).
- `template` et `check-process` vont dans `cli/docs` (SD9).

### Graphe d'import (pas de cycle)

- **Modules purs** :
  - `common` n'importe rien ;
  - `identifiers` et `spec` importent `common` ;
  - `relations` importe `common` et `identifiers` ;
  - `slices` importe `spec` ;
  - `tdd` importe `common`, `spec` et `slices` ;
  - `review-points` importe `common` ;
  - `review` importe `common`, `review-points`, `tdd` et `slices` ;
  - `close` importe `relations`, `review`, `review-points`, `slices` et `tdd` ;
  - `next-step` importe `close`, `slices` et `tdd` ;
  - `write-guard` importe `common`, `spec` et `tdd` ;
  - `checks` n'importe rien ;
  - `stop-hook` importe `common`, `checks` et `tdd`.
- **Modules d'entrées / sorties** : chacun importe des modules purs et `cli/common`, et ses dépendances suivent le même sens :
  - `cli/identifiers` vient en premier ;
  - `cli/relations` et `cli/spec` dépendent de lui ;
  - `cli/slices`, puis `cli/review` ;
  - `cli/checks`, puis `cli/close` ;
  - `cli/write-guard`, puis `cli/stop-hook` ;
  - `cli/next-step` vient en dernier.

**Déclarations apportées par FIX-28** (placées en tranche 1, base `f3ec902`) : `parseGitVersion`, `supportsRemergeDiff` et `codeLogArguments` (purs) → `common.mjs` ; `isAncestor`, `gitVersion` et `cachedGitVersion` → `cli/common.mjs` ; `codeFilesSince` et `defaultBranchRefsToExclude` → `cli/slices.mjs`, parce que `defaultBranchRefsToExclude` lit `defaultBaseRef` et `defaultBranchName` (`cli/identifiers`) : dans `cli/common`, il ferait un cycle ; `cli/review` importe déjà `cli/slices`. `defaultBranchName`, exporté par FIX-28, reste dans `cli/identifiers`.

## Tranches
<!-- Une entrée numérotée de premier niveau par tranche, dans l'ordre : atelier y lit le nombre de tranches.
Chaque tranche : livrable seule, relisible en moins de 15 minutes ; tests, build et revue se font par tranche.
Une tranche garde son numéro ; on ne retire du plan que des tranches à venir.
1. <tranche> — CA couverts : CA-1, CA-2 -->

1. Base, outillage et socle : fusion de `main` après FIX-28 et base notée dans `decisions.md` ; table complétée des déclarations de FIX-28 ; `check-moves.mjs` vert sur la base et sur trois mutations fabriquées ; `measure-hook.mjs` et médiane de la base notée ; `move.mjs` (déplacement de déclarations et régénération des imports) ; socle `common.mjs` et `cli/common.mjs`, réexporté par `core.mjs` et importé par `cli.mjs`, `pluginRoot` déplacé — CA couverts : CA-1, CA-3
2. Identifiants et relations : `identifiers`, `relations` et leurs modules `cli/`, un commit par domaine — CA couverts : CA-1, CA-3
3. Spec, documentation, tranches et TDD : `spec`, `docs`, `slices`, `tdd` et leurs modules `cli/`, un commit par domaine — CA couverts : CA-1, CA-3
4. Revue, points de revue et clôture : `review-points`, `review`, `close`, `checks` et leurs modules `cli/`, un commit par domaine — CA couverts : CA-1, CA-3
5. Prochaine étape, garde et hook Stop : `next-step`, `write-guard`, `stop-hook` et leurs modules `cli/` ; `core.mjs` réduit à la façade, en-tête réécrit (RD7), `cli.mjs` à `main` — CA couverts : CA-1, CA-2, CA-3
6. Tests et règles : imports nommés des tests, renommage de `windows-launcher.test.mjs`, `architecture.test.mjs`, mesure de latence, `CLAUDE.md` — CA couverts : CA-3, CA-4, CA-5, CA-6, CA-7

CA-1 n'est tenu en entier qu'à la fin de la tranche 5, et CA-2 aussi. CA-3 est vérifié à chaque tranche contre la même base.

## Risques et points d'attention
<!-- - risque : parade -->

- **L'extraction des déclarations par `check-moves.mjs`.** Elle suppose qu'une déclaration commence en colonne 0 et se ferme par une ligne en colonne 0. Les déclarations d'une seule ligne (`const specStatus = (spec) => …`) et les gabarits multilignes sont des cas à part. Parade : en tranche 1, le script s'éprouve sur la base. Il doit retrouver exactement les 193 déclarations de premier niveau (123 dans `core.mjs`, 70 dans `cli.mjs`, compte de l’inventaire préalable), et échouer sur trois mutations fabriquées : une ligne échangée entre deux fonctions, une ligne supprimée, une déclaration dupliquée.
- **Un import manquant n'échoue qu'à l'appel**, pas au chargement, parce que l'ESM ne vérifie pas les noms utilisés dans les corps. Parade : la suite complète à chaque commit, et un `node --check` ne suffit pas. Le test d'architecture peut ajouter, en tranche 6, un contrôle des identifiants libres par module si la revue le juge utile, sans le promettre ici.
- **Faux positifs du graphe** : `gate` et `git` apparaissent dans des chaînes. Parade : le graphe ci-dessus a été relu à la main, et les règles d'import du test d'architecture lisent les instructions `import`, pas les corps.
- **Branches ouvertes** : FIX-20 (en pause), FEAT-21 et FEAT-27 rebasent après la fusion. Parade : la table ci-dessus leur dit où va chaque fonction, et la règle de la façade (SB6) leur permet d'ajouter un réexport.
- **Latence** : 28 modules chargés par `hook-guard` via la table de `cli.mjs`. Si le seuil de 20 ms est dépassé en tranche 6, les commandes de `cli.mjs` passent en `import()` paresseux. C'est un amendement, car cela change la forme de `cli.mjs`.
