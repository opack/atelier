# Plan : REF-16 Tests rangés par domaine

## Approche
- `test/helpers.mjs` reçoit les utilitaires partagés par plusieurs fichiers, définitions inchangées, exportés par un seul bloc `export { … }` en fin de fichier (pas de `export` devant chaque définition : les lignes de définition restent identiques pour le contrôle de lignes). Le `after` de nettoyage y est déplacé tel quel : `node --test` lance chaque fichier dans son processus, chacun nettoie ses dossiers.
- Un utilitaire utilisé par un seul fichier reste dans ce fichier.
- Chaque `describe` d'origine reste un `describe`, renommé sans identifiant de chantier ; un `describe` scindé donne un `describe` par fichier de destination. Pas de fusion de tests dans un `describe` d'une autre origine.
- `check-moves.mjs` : `git worktree` temporaire à la base (`8c1a799` depuis l'amendement de la fusion de `main`, `ae55ab5` avant) (supprimé même en cas d'échec), suite de base et suite actuelle lancées en parallèle en `--test-reporter=tap`, tests distingués des suites par `type: 'suite'`, nom attendu dérivé du nom et du `describe` d'origine, comparaison en multiensembles, table ancien → nouveau nom affichée.

## Table describe → fichier
Fichiers dans `plugins/atelier/test/`. En gras, les `describe` scindés (tests concernés).

| Fichier | `describe` d'origine → nouveau nom |
|---|---|
| `common.test.mjs` | front matter ; project relative paths ; git output ; tool edits ; path patterns |
| `identifiers.test.mjs` | chantier identifiers ; chantier id from commit subjects ; active chantier deduced from commits ; chantier source shown to the user ; default branch resolved through origin/HEAD (V-10 compris) ; **FEAT-4 EPIC type, CA-6** → `EPIC identifiers` ; Next identifier: where the counter reads identifiers (FIX-18, avec `makeCounterRepository`) |
| `spec.test.mjs` | spec completeness ; amendments section ; FEAT-4 relations checked before signature ; **FEAT-4 EPIC type, les 4 tests CA-7** → `EPIC spec and templates` |
| `spec-ellipsis.test.mjs` | `check-spec-ellipsis.test.mjs` renommé (FIX-22, fichier entier) ; FIX-22 : « … » dans checkSpec → `« … » dans checkSpec` |
| `relations.test.mjs` | FEAT-4 relations read from the spec header ; FEAT-4 children of an EPIC across branches |
| `write-guard.test.mjs` | write guard ; write guard on a spec that is no longer a draft ; write guard on a spec whose committed version is a draft ; FEAT-7 write guard and stop hook per slice (en entier, CA-13 compris) ; **FEAT-7 plan and current slice, CA-5** → `slice fields written by the command` ; **FEAT-4 EPIC type, CA-8** → `write guard on an EPIC` |
| `stop-hook.test.mjs` | stop hook |
| `checks.test.mjs` | TEC-23 checks run once per working tree |
| `tdd.test.mjs` | test-driven phases ; refreeze detection ; reopen tests ; FEAT-7 freezing the tests of a slice |
| `slices.test.mjs` | FEAT-7 plan and current slice (sauf CA-5) |
| `review.test.mjs` | review state ; FEAT-7 review and next slice |
| `review-points-reading.test.mjs` | TEC-15 reading revue.md |
| `review-points-checks.test.mjs` | TEC-15 checking the review points |
| `review-points-numbering.test.mjs` | TEC-15 numbering the review points |
| `review-points-refusal.test.mjs` | TEC-15 refusing open review points in the CLI |
| `close.test.mjs` | close decision ; FEAT-4 dependencies checked at close ; FEAT-4 closing an EPIC ; **FEAT-7 close and next step, CA-21, CA-22, CA-23, CA-25** (avec `reviewedChantier`) → `close of a sliced chantier` |
| `next-step.test.mjs` | next step ; FEAT-4 next step of an EPIC ; FEAT-4 relations shown by status ; **FEAT-7 close and next step, CA-24, CA-26** → `next step of a sliced chantier` |
| `docs.test.mjs` | FEAT-4 process section of CLAUDE.md ; FEAT-4 site → `site chantier types` ; FEAT-7 vocabulary of the review ; TEC-15 prefixes in agents, skills and templates ; TEC-15 site reference pages |

Les autres `describe` perdent seulement leur préfixe `FEAT-4 `, `FEAT-7 `, `TEC-15 ` ou `TEC-23 `. Les `describe` imbriqués de `spec-ellipsis` perdent leur étiquette `CA-x : `, reportée sur chacun de leurs tests.

`helpers.mjs` : `templatesDirectory`, `template` ; `signedChantier`, `draftChantier`, `implementingChantier`, `signedTec`, `decide` ; `atelierBin`, `gitIdentity`, `temporaryDirectories` et son `after`, `temporaryDirectory`, `git`, `commit`, `makeRepository`, `atelier` ; `completeBodies`, `specText`, `chantierDirectoryOf`, `writeChantier`, `makeChantiersRepository`, `atelierRun`, `specData`, `assertLine`, `epicPlan` ; `planOf`, `threeSlices`, `slicedChantier`, `makeSlicedRepository`, `commitFiles`, `headOf`, `commitSpec`, `setHeader`, `specFileText`, `atelierOk`, `atSliceTwo`, `implementedSlice` ; `revueOf`. Un utilitaire de cette liste qui s'avère utilisé par un seul fichier reste dans ce fichier.

Restent locaux : `addChantierSpec`, `makeDeductionRepository`, `makeRepositoryWithOrigin` (identifiers) ; `amendmentEntries` s'il n'est utilisé que par `tdd` ; `pointsOf` (reading) ; `pointProblems`, `citing`, `revueWithBody`, `pointTable` (checks).

## Fichiers et couches touchés
- `docs/chantiers/REF-16-tests-par-domaine/check-moves.mjs` : script de contrôle (nouveau).
- `plugins/atelier/test/helpers.mjs` : utilitaires partagés (nouveau).
- `plugins/atelier/test/<domaine>.test.mjs` : 17 fichiers (nouveaux), plus `spec-ellipsis.test.mjs` (renommé depuis `check-spec-ellipsis.test.mjs`).
- `plugins/atelier/test/core.test.mjs` : vidé puis supprimé.
- Aucun fichier de `lib/`, `bin/`, skills, agents ou templates.

## Tranches
1. `check-moves.mjs` vert sur la base, puis extraction de `helpers.mjs` importé par `core.test.mjs`, suite verte — CA couverts : CA-4
2. Socle et lecture : `common`, `identifiers` (FIX-18 compris), `relations`, `spec` (première scission : `FEAT-4 EPIC type`), `spec-ellipsis`, un commit par domaine — CA couverts : CA-1, CA-2, CA-3, CA-4
3. Garde et TDD : `write-guard`, `stop-hook`, `checks`, `tdd`, `slices`, un commit par domaine — CA couverts : CA-1, CA-2, CA-3, CA-4
4. Revue, clôture, documentation : `review`, `review-points-*` (4 fichiers), `close`, `next-step`, `docs`, un commit par domaine, puis suppression de `core.test.mjs` — CA couverts : CA-1, CA-2, CA-3, CA-4

CA-1 à CA-3 ne sont tenus en entier qu'à la fin de la tranche 4.

## Risques et points d'attention
- Script trop permissif (zone critique, relue ligne à ligne en tranche 1) : en tranche 1, trois sabotages non commités doivent le faire échouer : une assertion modifiée, un test supprimé, un test renommé hors de la règle.
- Écart de `})` dû aux `describe` scindés : toléré seulement à hauteur de l'écart du nombre de `describe` (amendement de la spec à faire avant la tranche 1).
- Libellé de `cases` en template literal (`` `V-1 draft: reserved field ${field}` ``) : reconnu par sa position dans le tableau `cases`, pas par son contenu.
- `write-guard` à environ 340 lignes, proche du seuil : il tient ; on le scindera quand un chantier le fera déborder.
- Worktree temporaire laissé en place si le script plante : suppression dans un `finally`.
