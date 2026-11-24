---
id: REF-29
type: REF
title: lib/ rangé par domaine
status: signed
tdd: no
rel_parent: EPIC-17
rel_depends_on: REF-16, FIX-28
created_at: 2026-11-24
signed_by: Opack
signed_at: 2026-11-24
---

# REF-29 lib/ rangé par domaine

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

Ce chantier est le lot 2 d'EPIC-17 et couvre ses critères CA-2 et CA-7.

- `plugins/atelier/lib/core.mjs` : sa logique pure est répartie en modules `lib/<domaine>.mjs`. Ses fonctions qui lisent le disque ou git partent dans `lib/cli/<domaine>.mjs`.
- `plugins/atelier/lib/cli.mjs` : ses commandes, ses hooks et ses utilitaires d'entrées / sorties sont répartis en modules `lib/cli/<domaine>.mjs`.
- `plugins/atelier/test/*.mjs` : on ne touche qu'à leurs imports depuis `../lib/`, au préfixe `core.` dans leurs corps et aux noms de `windows-launcher.test.mjs` (§3, Tests).
- Un test d'architecture : `plugins/atelier/test/architecture.test.mjs`.
- `CLAUDE.md`, sections Structure et Conventions : elles décrivent le rangement de `lib/` et remplacent la règle « logique dans `lib/core.mjs` », qui ne vaut plus.

Hors périmètre :
- Les consignes de `write-tests` et `build`, la grille du reviewer, `check-spec` et les templates relèvent du lot 3 d'EPIC-17. Le gel qui tolère un déplacement relève du lot 4.
- Le contenu des fonctions. On déplace, on n'améliore pas : aucune fonction n'est renommée, fusionnée, scindée ou réécrite, même si elle est maladroite.
- `bin/atelier` et `bin/atelier.cmd`, qui chargent toujours `lib/cli.mjs`.
- Le site : il ne cite ni `core.mjs` ni `cli.mjs`, et le comportement ne change pas.
- `lib/agent-settings.mjs` (FEAT-27, non fusionné), qui suit déjà la règle.
- Les specs, plans et bilans des chantiers clos qui citent `lib/core.mjs:<ligne>` : on n'y touche pas.

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

- `lib/core.mjs` fait 1774 lignes et 80 exports, contre 1388 lignes à la signature d'EPIC-17 il y a trois jours. `lib/cli.mjs` fait 1054 lignes, contre 946. Chaque chantier les allonge : TEC-15, TEC-23, FIX-18, FIX-22 et FIX-26 y ont ajouté 534 lignes.
- REF-16 a rangé les tests par domaine, mais `test/close.test.mjs` teste du code dispersé dans deux fichiers de 1000 à 1800 lignes, pas un `lib/close.mjs`.
- Deux chantiers attendent ce lot. FEAT-21, signé, attend un `lib/` rangé. FIX-20 est en pause après sa tranche 1, pour écrire ses 5 tranches restantes dans les nouveaux modules.
- Le test d'architecture ne peut pas arriver avant ce lot : il échouerait aussitôt sur `core.mjs`.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

**Actuel** (SD1) :
- **`core.mjs`** :
  - ses constantes d'en-tête (l.8-46) servent plusieurs domaines, par exemple `ID_PATTERN` et `CRITERIA_SECTIONS` ;
  - viennent ensuite 16 sections `// ---------- <nom> ---------- `: configuration, front matter, identification, relations, prochain identifiant, complétude de la spec, section Process, amendements, revue, points de revue, clôture, prochaine étape, tranches, phases TDD, règles de chemins de la garde, hook Stop ;
  - des fonctions privées servent plusieurs domaines : `ENTRY_START` (amendements) est utilisé par les tranches, et `specStatus` (section de la garde) par TDD, la revue et la clôture ;
  - `core.mjs` n'est pas pur. `findProjectRoot`, `loadConfig`, `findChantierDirectory`, `readChantier`, `gitOutput`, `currentBranch`, `defaultBaseRef`, `branchCommitSubjects`, `activeChantier` et la collecte des identifiants utilisés lisent le disque ou git.
- **`cli.mjs`** :
  - une table de 19 entrées, soit 16 commandes et 3 hooks ;
  - une section Helpers (configuration requise, chantier actif, stdin, bypass) ;
  - une section Commands, qui contient aussi les utilitaires git (`git`, `gitRaw`, `gitPaths`, `committedFileText`, etc.) ;
  - une section Hooks ;
  - `pluginRoot` y est calculé à la ligne 66, relativement à `import.meta.url`.
- **Tests** :
  - tous importent `../lib/core.mjs`, certains en `import * as core` avec des appels `core.x` qui couvrent plusieurs domaines (`close.test.mjs` appelle `core.sliceState`) ;
  - `windows-launcher.test.mjs` (FIX-25, fusionné après REF-16) garde un `describe` nommé d'après son chantier et des noms `CA-n : …`.

**Cible** :
- **Modules purs** :
  - emplacement : `lib/<domaine>.mjs`, sans aucune lecture du disque, de git ou de l'environnement ;
  - noms de domaine : ceux des fichiers de tests de REF-16 (`identifiers`, `spec`, `write-guard`, `stop-hook`, `checks`, `tdd`, `slices`, `review`, `review-points`, `close`, `next-step`, `relations`, `docs`, `common`) ;
  - `test/<domaine>.test.mjs` teste `lib/<domaine>.mjs` et/ou `lib/cli/<domaine>.mjs` ;
  - un domaine sans logique pure n'a pas de module pur ;
  - au-delà de 400 lignes, un domaine se scinde en `<domaine>-<sous-domaine>.mjs` ;
  - le socle `common.mjs` regroupe le front matter, les chemins et motifs, et l'analyse de sortie git (`parsePorcelainPaths`, `parseCatFileBatch`, etc.) ;
  - les constantes et fonctions privées partagées par plusieurs domaines vont dans `common.mjs` ou dans le domaine qui les définit, exportées par lui. La table du plan les place une par une.
- **Entrées / sorties** (SB1) :
  - emplacement : `lib/cli/<domaine>.mjs`, qui contient les commandes, les hooks et les lectures du disque ou de git du domaine, y compris celles qui viennent de `core.mjs` (`loadConfig`, `activeChantier`, `readChantier`, etc.) ;
  - les utilitaires partagés par plusieurs domaines (`git`, `gitRaw`, `requireConfig`, `requireActiveChantier`, `readStandardInput`, `pluginRoot`, etc.) vont dans `lib/cli/common.mjs` ;
  - le code d'entrées / sorties sans domaine évident (`status`, `bypass`, `template`, `check-process`, `hook-session-start`, etc.) va dans un domaine que le plan nomme, et jamais dans `cli/common.mjs` (SD9) ;
  - `lib/cli.mjs` ne garde que la table des commandes et `main`.
- **`pluginRoot`** (SB3) :
  - il vit dans `lib/cli/common.mjs` et devient `join(dirname(fileURLToPath(import.meta.url)), '..', '..')` ;
  - c'est la seule ligne de code modifiée tolérée par le contrôle du §4 ;
  - les modules qui s'en servent l'importent.
- **Imports entre modules** (SD7) :
  - `lib/common.mjs` n'importe aucun autre module de `lib/` ;
  - aucun module pur `lib/*.mjs` n'importe `lib/cli/` ;
  - aucun module ne fait partie d'un cycle d'import ;
  - le test d'architecture vérifie ces trois règles.
- **`core.mjs`** devient une façade :
  - il ne contient que des réexports (`export { … } from './<domaine>.mjs'` ou `'./cli/<domaine>.mjs'`), des commentaires et des lignes vides ;
  - il exporte exactement les mêmes noms que la base ;
  - raison : les branches ouvertes (FIX-20, FEAT-21, FEAT-27) importent `../lib/core.mjs`, et pour FIX-20 depuis des tests figés. Supprimer la façade casserait ces tests à la fusion et forcerait à les rouvrir ;
  - le test d'architecture garantit que la façade reste vide de logique ;
  - **règle de la façade** (SB6) : une branche ouverte avant la fusion de REF-29 peut y ajouter une ligne de réexport pour un export qu'elle crée, jamais de la logique. Aucun chantier ouvert après REF-29 n'y touche ;
  - sa suppression fera l'objet d'un chantier ultérieur, quand plus aucune branche ouverte ne l'importera.
- **Exports internes** : une fonction privée de `core.mjs` ou de `cli.mjs` qu'un autre module doit appeler devient un export de son module de domaine, mais pas de la façade.
- **Tests** :
  - **imports** (SB2) : chaque fichier importe par noms (`import { … } from`) le ou les modules dont il se sert, ceux de son domaine en priorité ; un `import * as core` devient un import nommé, et ses appels `core.x` deviennent `x` ;
  - **ce qui ne change pas** : les noms et les corps de tests, à deux exceptions près ;
  - **exception 1, préfixe `core.`** : la seule retouche tolérée dans un corps est le retrait de ce préfixe ;
  - **exception 2, `windows-launcher.test.mjs`** (SB4) : il est renommé selon les règles de REF-16. Son `describe` perd l'identifiant `FIX-25`, et `'CA-n : <libellé>'` devient `'<libellé> [FIX-25 CA-n]'`.
- **Test d'architecture** (`test/architecture.test.mjs`, EPIC-17 CA-7). Il échoue :
  - si un fichier `.mjs` de `lib/` (sous-dossiers compris) ou de `test/` dépasse 400 lignes ;
  - si un titre de `describe` contient un identifiant de chantier ;
  - si un nom de test contient un identifiant de critère (`CA-n`, `V-n`) ailleurs que dans une étiquette finale `[<ID> CA-n]` ou `[<ID> CA-n, CA-m, …]`, avec un ou plusieurs critères séparés par `, ` (SB5) ;
  - si `core.mjs` contient autre chose que des réexports, des commentaires et des lignes vides ;
  - si une règle d'import ci-dessus est violée.

  Un identifiant de chantier, c'est un type de `CHANTIER_TYPES` suivi d'un tiret et d'un numéro (SB5).

  Les noms sont lus dans les sources, dans le premier argument de `describe`, `it` et `test` (SD6) :
  - littéral : contrôlé entier ;
  - gabarit `` `…${x}…` `` : seule sa partie statique est contrôlée ;
  - variable : ignorée ;
  - `architecture.test.mjs` ne s'analyse pas lui-même : ses exemples fabriqués sont des textes passés à ses fonctions de contrôle.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

Le comportement est inchangé, donc pas de TDD : le cadre d'EPIC-17 le fixe pour les REF de rangement. Les risques sont :
- perdre, modifier ou dupliquer une fonction en la déplaçant ;
- casser un import ;
- introduire un cycle d'import, qui ne casse qu'à certains chemins de chargement ;
- ralentir les hooks.

**Base** :
- le commit de `main` d'où part la tranche 1, une fois FIX-28 fusionné ;
- le plan note son hash et son nombre de tests (331 sur `main` au 2026-11-24, avant FIX-28) ;
- si `main` est fusionné dans la branche en cours de route, la base suit le commit fusionné, et le changement est tracé dans `decisions.md` (SD5).

**Script de contrôle** : `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs`. Il est rangé hors de `npm test`, rejouable par le relecteur, et sa sortie est jointe à chaque revue. Il vérifie cinq choses.

- **Nombre** : `npm test` rapporte le nombre de tests de la base plus ceux d'`architecture.test.mjs`, tous verts, sans suite en échec.
- **Tests** (SD4) :
  - la liste des fichiers de `test/` est celle de la base plus `architecture.test.mjs`, exactement ;
  - chaque fichier est identique à sa version de la base, à trois différences près : ses instructions `import … from '../lib/…'`, le retrait du préfixe `core.` dans ses corps, et les noms de `windows-launcher.test.mjs` renommés selon la règle du §3.
- **Code, déclaration par déclaration** (SD2) :
  - chaque déclaration de niveau 0 de `core.mjs` et de `cli.mjs` dans la base (`function`, `const`, `let`, `class`, de sa ligne en colonne 0 jusqu'à la ligne qui la referme en colonne 0) se retrouve exactement une fois dans `lib/` après le rangement, avec un texte identique ;
  - deux différences sont tolérées : le mot-clé `export ` ajouté ou retiré en tête, et la ligne `pluginRoot` (SB3) ;
  - il n'apparaît aucune déclaration nouvelle, en dehors des réexports de la façade et du `main` de `cli.mjs`.
- **Hors déclarations** (SD3), seules ces lignes peuvent changer :
  - toute instruction `import … from '…'`, y compris une liste multiligne entre `import {` et `} from`, imports `node:*` compris ;
  - les instructions `export { … } from` de la façade ;
  - les commentaires de section `// ---------- … ----------` et les commentaires d'en-tête de module, ajoutés ou retirés ;
  - les lignes vides.
- **Exports** : on importe `lib/core.mjs` avant et après. On doit obtenir la même liste de noms exportés, plus les réexports ajoutés par une branche fusionnée selon la règle de la façade. Chaque nom de la base a le même `typeof` et, pour une fonction, le même `toString()`.

**Latence** (SD8) :
- on mesure `atelier hook-guard`, lancé 20 fois sur ce dépôt avec la même entrée, avant et après ;
- la médiane après ne dépasse pas la médiane avant de plus de 20 ms ;
- la mesure est jointe à la revue du chantier.

**Vérification manuelle** : `bin/atelier status` et `hook-session-start`, lancés sur ce dépôt, donnent la même sortie avant et après.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Écrire `check-moves.mjs` et le faire passer sur la base, sans aucun déplacement.
2. Sortir le socle : `lib/common.mjs` et `lib/cli/common.mjs`. `core.mjs` et `cli.mjs` les importent, et `core.mjs` réexporte.
3. Déplacer les domaines un par un, module pur et module d'entrées / sorties ensemble, en commençant par les feuilles du graphe d'import. Un commit par domaine, avec la suite et `check-moves.mjs` verts à chaque commit. Le plan regroupe ces commits en tranches et donne la table fonction → module.
4. Basculer les imports des tests vers les modules, et renommer `windows-launcher.test.mjs`.
5. Réduire `core.mjs` à la façade et `cli.mjs` à `main`, ajouter `architecture.test.mjs`, mesurer la latence, puis mettre à jour `CLAUDE.md`.

Chaque étape laisse la suite verte et peut être fusionnée seule. Aucun autre chantier ne touche `lib/` pendant REF-29, comme le prévoit le plan d'EPIC-17. Si `main` avance quand même, il est fusionné dans la branche, pas rebasé, comme pour REF-16.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- **Cycle d'import.** En ESM, il donne un `undefined` au chargement selon l'ordre d'entrée. Parade : les règles d'import du §3, vérifiées par le test d'architecture.
- **Chemins relatifs à `import.meta.url`.** Parade : `pluginRoot` est calculé une seule fois dans `lib/cli/common.mjs`, et vérifié par `atelier template spec-ref` et par les tests de `docs`.
- **Branches ouvertes** (FIX-20, FEAT-21, FEAT-27). Leurs modifications de `core.mjs` se rejouent dans les modules de domaine au rebase. La façade et sa règle évitent de toucher à leurs tests.
- **Fonctions qui mêlent deux domaines.** Elles vont dans le domaine du comportement qu'elles servent, et la table du plan fait foi. Un doute se tranche dans `decisions.md`, pas par une réécriture.
- **Durée de chargement des hooks.** On passe d'environ 2 modules à environ 30. Parade : le seuil de latence du §4.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné le dépôt à la fin de REF-29, quand on liste `plugins/atelier/lib/`, alors chaque déclaration de la base se trouve dans le module `lib/<domaine>.mjs` (pur, sans lecture du disque, de git ni de l'environnement) ou `lib/cli/<domaine>.mjs` (entrées / sorties) que lui donne la table du plan, aucun fichier `.mjs` de `lib/` ne dépasse 400 lignes, et `cli.mjs` ne contient que la table des commandes et `main` (EPIC-17 CA-2).
- CA-2 : Étant donné `lib/core.mjs` à la fin de REF-29, quand on l'importe, alors il exporte exactement les noms de la base, chacun identique (même `typeof`, même `toString()` pour une fonction), et il ne contient que des réexports, des commentaires et des lignes vides.
- CA-3 : Étant donné la base, quand on lance `check-moves.mjs`, alors `npm test` est vert avec le nombre de tests de la base plus ceux d'`architecture.test.mjs`, les fichiers de tests sont ceux de la base plus `architecture.test.mjs` et ne diffèrent que par les différences tolérées du §4, et chaque déclaration de la base se retrouve une seule fois, identique au `export ` de tête et à la ligne `pluginRoot` près.
- CA-4 : Étant donné le dépôt, quand `npm test` tourne, alors `architecture.test.mjs` échoue dans chacun de ces cas : un fichier `.mjs` de `lib/` ou de `test/` dépasse 400 lignes ; un `describe` contient un identifiant de chantier ; un nom de test contient un identifiant de critère hors d'une étiquette finale `[<ID> CA-n]` ou `[<ID> CA-n, CA-m, …]` ; `core.mjs` contient autre chose que des réexports ; `lib/common.mjs` importe un module de `lib/` ; un module pur importe `lib/cli/` ; un cycle d'import existe. Chaque règle a un test qui la fait échouer sur un exemple fabriqué, et la suite de ce dépôt passe (EPIC-17 CA-7).
- CA-5 : Étant donné les fichiers de tests à la fin de REF-29, quand on lit leurs imports, alors aucun n'importe `lib/core.mjs`, et chacun importe par noms les modules `lib/<domaine>.mjs` ou `lib/cli/<domaine>.mjs` dont il se sert.
- CA-6 : Étant donné le `CLAUDE.md` à la fin de REF-29, quand on lit ses sections Structure et Conventions, alors elles décrivent `lib/<domaine>.mjs` (logique pure), `lib/cli/<domaine>.mjs` (entrées / sorties), `core.mjs` comme une façade de réexports, et deux règles : une nouvelle logique va dans le module de son domaine, jamais dans `core.mjs` ; seule une branche ouverte avant REF-29 peut ajouter un réexport à la façade.
- CA-7 : Étant donné 20 lancements de `atelier hook-guard` avec la même entrée sur ce dépôt, quand on compare la base et la fin de REF-29, alors la médiane après ne dépasse pas la médiane avant de plus de 20 ms.
- Laissé en l'état : le contenu des fonctions, les noms des exports, `bin/`, le site, la durée de la suite, les consignes des skills et du reviewer (lot 3).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
