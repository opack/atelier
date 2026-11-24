---
id: REF-29
type: REF
title: lib/ rangé par domaine
status: draft
tdd: no
rel_parent: EPIC-17
rel_depends_on: REF-16, FIX-28
created_at: 2026-11-24
signed_by:
signed_at:
---

# REF-29 lib/ rangé par domaine

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

Lot 2 d'EPIC-17 (CA-2, CA-7).

- `plugins/atelier/lib/core.mjs` : sa logique pure est répartie en modules `lib/<domaine>.mjs`, un par domaine.
- `plugins/atelier/lib/cli.mjs` : ses commandes, ses hooks et ses utilitaires d'entrées / sorties sont répartis en modules `lib/cli/<domaine>.mjs`, sous le même nom de domaine que le module pur.
- Les lignes d'import de `plugins/atelier/test/*.mjs` : chaque fichier de tests importe le module de son domaine.
- Un test d'architecture : `plugins/atelier/test/architecture.test.mjs`.
- `CLAUDE.md`, sections Structure et Conventions : le rangement de `lib/` et la règle « logique dans `lib/core.mjs` » qui ne vaut plus.

Hors périmètre :
- Les consignes de `write-tests` et `build`, la grille du reviewer, `check-spec` et les templates (lot 3 d'EPIC-17), le gel qui tolère un déplacement (lot 4).
- Le contenu des fonctions : on déplace, on n'améliore pas. Aucune fonction renommée, fusionnée, scindée ou réécrite, même maladroite.
- `bin/atelier` et `bin/atelier.cmd` : ils chargent toujours `lib/cli.mjs`.
- Le site : il ne cite ni `core.mjs` ni `cli.mjs`, et le comportement ne change pas.
- `lib/agent-settings.mjs` (FEAT-27, non fusionné) : il suit déjà la règle.
- Les specs, plans et bilans des chantiers clos, qui citent `lib/core.mjs:<ligne>` : inchangés.

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

- `lib/core.mjs` fait 1774 lignes et 80 exports, contre 1388 à la signature d'EPIC-17 trois jours plus tôt. `lib/cli.mjs` fait 1054 lignes, contre 946. Chaque chantier les allonge : TEC-15, TEC-23, FIX-18, FIX-22 et FIX-26 y ont ajouté 534 lignes.
- REF-16 a rangé les tests par domaine. `test/close.test.mjs` teste du code dispersé dans deux fichiers de 1000 à 1800 lignes, et non `lib/close.mjs`.
- Ce lot bloque deux chantiers : FEAT-21, signé, attend explicitement un `lib/` rangé, et FIX-20 est en pause après sa tranche 1 pour écrire ses 5 tranches restantes dans les nouveaux modules.
- Le test d'architecture ne peut pas arriver avant ce lot, parce qu'il échouerait aussitôt sur `core.mjs`.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

**Actuel** : `core.mjs` est découpé en 16 sections `// ---------- <nom> ----------` (configuration, front matter, identification, relations, prochain identifiant, complétude de la spec, section Process, amendements, revue, points de revue, clôture, prochaine étape, tranches, phases TDD, règles de chemins de la garde, hook Stop). `cli.mjs` comporte trois sections : Helpers (configuration requise, chantier actif, stdin, git), Commands (19 commandes) et Hooks (garde, gate, démarrage). Tous les tests importent `../lib/core.mjs`.

**Cible** :
- **Modules purs** : `lib/<domaine>.mjs`. Les noms de domaine sont ceux des fichiers de tests de REF-16 : `identifiers`, `spec`, `write-guard`, `stop-hook`, `checks`, `tdd`, `slices`, `review`, `review-points`, `close`, `next-step`, `relations`, `docs`, `common`. `test/<domaine>.test.mjs` teste `lib/<domaine>.mjs`. Un domaine sans logique pure n'a pas de module pur (par exemple `docs`, si rien n'y tombe). Un domaine qui dépasse 400 lignes se scinde en `<domaine>-<sous-domaine>.mjs`, comme les tests. Le socle `common.mjs` regroupe configuration, front matter, chemins et motifs, et lecture de sortie git.
- **Entrées / sorties** : `lib/cli/<domaine>.mjs` contient les commandes, les hooks et les lectures git ou disque du domaine. Les utilitaires partagés (`git`, `requireConfig`, `requireActiveChantier`, `readStandardInput`, etc.) vont dans `lib/cli/common.mjs`. `lib/cli.mjs` ne garde que la table des commandes et `main`.
- **`core.mjs`** : il devient une façade qui ne contient que des lignes `export { … } from './<domaine>.mjs'`, sans aucune logique, et il exporte exactement les mêmes noms qu'avant. Raison : les branches ouvertes (FIX-20, FEAT-21, FEAT-27) importent `../lib/core.mjs`, et dans le cas de FIX-20 c'est depuis des tests figés. Supprimer `core.mjs` casserait ces tests à la fusion et forcerait à les rouvrir. Le test d'architecture garantit que la façade reste vide de logique. Sa suppression fera l'objet d'un chantier ultérieur, une fois qu'aucune branche ouverte ne l'importera.
- **Exports internes** : une fonction privée de `core.mjs` qu'un autre module doit appeler devient un export de son module de domaine, mais pas de la façade. La façade garde exactement la liste d'exports de la base.
- **Tests** : seules leurs lignes d'import changent. Chaque fichier importe le module de son domaine, et `helpers.mjs` importe les modules dont il se sert. Aucun nom de test, aucun corps de test ne change.
- **Imports entre modules** : pas de cycle. Le plan donne le graphe, `common` n'importe aucun autre module de domaine.
- **Test d'architecture** (`test/architecture.test.mjs`, EPIC-17 CA-7) : il échoue si un fichier `.mjs` de `lib/` (sous-dossiers compris) ou de `test/` dépasse 400 lignes, si un titre de `describe` contient un identifiant de chantier, si un nom de test contient un identifiant de critère (`CA-n`, `V-n`) ailleurs que dans une étiquette finale `[<ID> CA-n]` ou `[<ID> CA-n, CA-m]`, ou si `core.mjs` contient autre chose que des réexports, des commentaires et des lignes vides. Les noms sont lus dans les sources (premier argument littéral de `describe` et de `it`/`test`). Le plan précise comment sont traités les noms générés.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

Comportement inchangé, donc pas de TDD, comme le fixe le cadre d'EPIC-17 pour les REF de rangement. Le risque est de perdre, de modifier ou de dupliquer une fonction en la déplaçant, de casser un import, ou d'introduire un cycle d'import qui ne casse qu'à certains chemins de chargement.

**Base** : le commit de `main` d'où part la tranche 1, une fois FIX-28 fusionné. Le plan note son hash et son nombre de tests (331 sur `main` au 2026-11-24, avant FIX-28).

**Script de contrôle** : `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs`. Il est rangé hors de `npm test`, rejouable par le relecteur, et sa sortie est jointe à chaque revue. Il vérifie :
- **nombre** : `npm test` rapporte le nombre de tests de la base plus ceux de `architecture.test.mjs`, tous verts, sans aucune suite en échec ;
- **tests** : les fichiers de `test/` de la base sont identiques à ceux d'après, à l'exception de leurs lignes d'import depuis `../lib/` ;
- **code** : le multiensemble des lignes non vides de `lib/` (espaces de tête retirés) est le même avant et après, aux seules différences suivantes près : lignes d'import et d'export entre modules (et accolades ou noms d'une liste d'import multiligne), mot-clé `export` ajouté devant une déclaration déjà présente, commentaires d'en-tête de module et de section `// ---------- … ----------`, et lignes de la façade `core.mjs`. Un corps de fonction modifié en route fait échouer ce contrôle ;
- **exports** : en important `lib/core.mjs` avant et après, on obtient la même liste de noms exportés, et chacun a le même `typeof` et, pour une fonction, le même `toString()`.

Vérification manuelle : `bin/atelier status` et un hook (`hook-session-start`) lancés sur ce dépôt donnent la même sortie avant et après.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Écrire `check-moves.mjs` et le faire passer sur la base, sans aucun déplacement.
2. Sortir le socle : `lib/common.mjs` et `lib/cli/common.mjs`, `core.mjs` et `cli.mjs` les importent et les réexportent.
3. Déplacer les domaines un par un, modules pur et d'entrées / sorties ensemble, en commençant par les feuilles du graphe d'import. Un commit par domaine, avec la suite et `check-moves.mjs` verts à chaque commit. Le plan regroupe ces commits en tranches.
4. Basculer les imports des tests vers les modules de domaine.
5. Réduire `core.mjs` à la façade et `cli.mjs` à `main`, puis ajouter `architecture.test.mjs` et mettre à jour `CLAUDE.md`.

Chaque étape laisse la suite verte et peut être fusionnée seule. Aucun autre chantier ne touche `lib/` pendant REF-29 (plan d'EPIC-17). Si `main` avance quand même, il est fusionné dans la branche, pas rebasé, comme pour REF-16.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- **Cycle d'import** (A importe B qui importe A) : en ESM, il donne un `undefined` au chargement selon l'ordre d'entrée. Parade : graphe fixé au plan, `common` sans dépendance vers un domaine, et le test d'architecture peut le vérifier si le plan le juge utile.
- **Chemins relatifs à `import.meta.url`** (`pluginRoot` dans `cli.mjs`, templates) : un module déplacé dans `lib/cli/` gagne un niveau. Parade : `pluginRoot` est calculé à un seul endroit, puis vérifié par `atelier template spec-ref` et par les tests de `docs`.
- **Branches ouvertes** (FIX-20, FEAT-21, FEAT-27) : leurs modifications de `core.mjs` se rejouent dans les modules de domaine au rebase. La façade évite d'avoir à toucher à leurs tests.
- **Fonctions mêlant deux domaines** : elles vont dans le domaine du comportement qu'elles servent, et c'est la table du plan qui fait foi. Un doute se tranche dans `decisions.md`, pas par une réécriture.
- **Durée de chargement** : 30 modules au lieu de 2. C'est négligeable pour une CLI, mais à vérifier sur la durée de la suite (environ 6 s aujourd'hui).

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné le dépôt à la fin de REF-29, quand on liste `plugins/atelier/lib/`, alors chaque fonction de la base se trouve dans le module `lib/<domaine>.mjs` (pure) ou `lib/cli/<domaine>.mjs` (entrées / sorties) que lui donne la table du plan, aucun fichier `.mjs` de `lib/` ne dépasse 400 lignes, et `cli.mjs` ne contient que la table des commandes et `main` (EPIC-17 CA-2).
- CA-2 : Étant donné `lib/core.mjs` à la fin de REF-29, quand on l'importe, alors il exporte exactement les noms de la base, chacun identique (même `typeof`, même `toString()` pour une fonction), et il ne contient que des réexports, des commentaires et des lignes vides.
- CA-3 : Étant donné la base, quand on lance `check-moves.mjs`, alors `npm test` est vert avec le nombre de tests de la base plus ceux d'`architecture.test.mjs`, les fichiers de tests ne diffèrent que par leurs imports depuis `../lib/`, et les lignes de `lib/` ne diffèrent que par les différences tolérées du §4.
- CA-4 : Étant donné le dépôt, quand `npm test` tourne, alors `architecture.test.mjs` échoue si un fichier `.mjs` de `lib/` ou de `test/` dépasse 400 lignes, si un `describe` contient un identifiant de chantier, si un nom de test contient un identifiant de critère hors d'une étiquette finale `[<ID> CA-n]` ou `[<ID> CA-n, CA-m]`, ou si `core.mjs` contient autre chose que des réexports. Chaque règle a un test qui la fait échouer sur un exemple fabriqué (EPIC-17 CA-7).
- CA-5 : Étant donné les fichiers de tests à la fin de REF-29, quand on lit leurs imports, alors `test/<domaine>.test.mjs` importe `lib/<domaine>.mjs` (ou ses sous-domaines) et aucun n'importe `lib/core.mjs`.
- CA-6 : Étant donné le `CLAUDE.md` à la fin de REF-29, quand on lit ses sections Structure et Conventions, alors elles décrivent `lib/<domaine>.mjs` (logique pure), `lib/cli/<domaine>.mjs` (entrées / sorties), `core.mjs` comme une façade gelée, et la règle « une nouvelle logique va dans le module de son domaine, jamais dans `core.mjs` ».
- Laissé en l'état : le contenu des fonctions, les noms des exports, `bin/`, le site, la durée de la suite, les consignes des skills et du reviewer (lot 3).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
