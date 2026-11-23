---
id: REF-16
type: REF
title: Tests rangés par domaine
status: signed
tdd: no
rel_parent: EPIC-17
created_at: 2026-11-21
signed_by: Opack
signed_at: 2026-11-23
slice: 2
slice_base: 7c65a01f297caa481563369bfaa0f1c7a505461a
tests_commit: 
---

# REF-16 Tests rangés par domaine

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

- `plugins/atelier/test/core.test.mjs` : découpé en plusieurs fichiers de tests, un par domaine, plus un module d'utilitaires partagés.
- Noms des `describe` et des `it` de ce fichier.
- `plugins/atelier/test/check-spec-ellipsis.test.mjs` (FIX-22, arrivé par la fusion de `main`) : renommé `spec-ellipsis.test.mjs`, noms de ses `describe` et de ses `it`.

Hors périmètre :
- `lib/core.mjs` et `lib/cli.mjs` : leur découpage est le lot 2 d'EPIC-17.
- Les consignes de `write-tests` et `build`, la grille du reviewer, `check-spec` et le gel des tests : lots 3 et 4 d'EPIC-17.
- Le test d'architecture (EPIC-17 CA-7) : lot 2, une fois `lib/` découpé.
- Les specs et bilans des chantiers clos, qui citent les anciens noms de tests : inchangés.
- La langue des noms de tests (certains en anglais, d'autres en français) et la durée de la suite (environ 60 s).

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

- Un seul fichier de 2672 lignes, 44 `describe`, 256 tests (mesuré après la fusion de TEC-15, qui y a ajouté environ 600 lignes). Chaque chantier l'allonge par le bas.
- Les tests sont rangés par historique, pas par comportement : 22 `describe` portent un nom de chantier (`FEAT-4 EPIC type`, `FEAT-7 review and next slice`, `TEC-15 checking the review points`, etc.). Pour savoir ce qui garantit la garde d'écriture, il faut lire quatre blocs dispersés.
- Hors de leur `describe`, les étiquettes sont ambiguës : FEAT-4, FEAT-7 et TEC-15 ont chacun un `CA-1`, TEC-5 et TEC-6 chacun un `V-2`.
- EPIC-17 commence par ce rangement : sa liste de domaines sert ensuite au découpage de `lib/`.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

**Actuel** : `test/core.test.mjs`, utilitaires (fixtures, dépôts git temporaires, appel de la CLI) définis au fil du fichier, `describe` préfixés par `FEAT-4`, `FEAT-7` ou `TEC-15`, tests nommés `CA-x : <comportement>` (133 dans le source) ou `V-x` (30 à l'exécution : 14 de TEC-5, dont 13 générés par le tableau `cases` du `describe` de la ligne 309 avec des libellés `'V-1 draft: <cas>'` et `'V-2 signed, not committed: <cas>'`, et 16 de TEC-6), les autres sans étiquette. Le cadre d'EPIC-17 parle de 17 tests `V-x` : le compte juste est 30, la règle ne change pas.

Depuis la fusion de `main` (`8c1a799`) : `core.test.mjs` se termine par `TEC-23 checks run once per working tree` (tests `CA-x :`) et `Next identifier: where the counter reads identifiers` (FIX-18, déjà étiqueté `[FIX-18 CA-x]`) ; `check-spec-ellipsis.test.mjs` contient un `describe` `FIX-22 : « … » dans checkSpec` dont plusieurs `describe` imbriqués portent l'étiquette (`describe('CA-2 : …')`) à la place de leurs tests.

**Cible** :
- un fichier `test/<domaine>.test.mjs` par domaine, nom en anglais ; un domaine est un comportement observable du plugin, ou le socle (`common`) qui regroupe les utilitaires partagés (front matter, chemins et motifs, sortie git). Découpage proposé, confirmé au plan :
  - `identifiers` : identifiants, chantier actif (branche, commits, `origin/HEAD`), source affichée ;
  - `spec` : complétude, amendements, contrôles avant signature (relations, type EPIC) ;
  - `write-guard` : garde d'écriture, toutes variantes (brouillon, signée, par tranche, EPIC) ;
  - `stop-hook` : contrôle de fin ;
  - `checks` : contrôles lancés une seule fois par état du code (commande `checks`, hook de fin de tour, clôture) ;
  - `tdd` : phases, gel, regel, réouverture des tests ;
  - `slices` : plan et tranche en cours ;
  - `review` : état de revue, passage à la tranche suivante ;
  - `review-points` : lecture, contrôle et numérotation des points de `revue.md`, refus des points ouverts ;
  - `close` : clôture (dépendances, EPIC, tranches) ;
  - `next-step` : prochaine étape, affichage de `status` et du hook de démarrage ;
  - `relations` : lecture des relations, enfants d'un EPIC ;
  - `docs` : section Process du `CLAUDE.md`, site, vocabulaire, préfixes dans les agents, skills et templates ;
  - `common` : front matter, chemins et motifs, sortie git, éditions d'outils ;
- un test qui touche deux domaines va dans celui du comportement que son nom affirme ; le plan fixe la table `describe` (ou test, pour un `describe` scindé) → fichier ;
- un domaine qui dépasse 400 lignes se scinde en `<domaine>-<sous-domaine>.test.mjs` (probable pour `review-points`, environ 560 lignes aujourd'hui) ;
- `test/helpers.mjs` (sans `.test.`) : utilitaires partagés par plusieurs fichiers ; un utilitaire utilisé par un seul fichier reste dans ce fichier ;
- aucun nom de chantier dans un `describe` ; un `describe` actuel qui mêle deux domaines est scindé ;
- un test lié à un critère porte l'étiquette `[<ID> CA-x]` en suffixe de son nom : `'refuse la clôture tant qu'une tranche est en cours [FEAT-7 CA-21]'`, `'le hook de démarrage affiche les enfants d'un EPIC [FEAT-4 CA-10, CA-11]'` ; un test qui ne vient d'aucun critère n'en porte pas ;
- l'identifiant de chantier d'une étiquette vient du `describe` d'origine : `FEAT-4`, `FEAT-7`, `TEC-15`, `TEC-23` ou `FIX-22` pour les `describe` préfixés (`FIX-22 : ` avec deux-points) ; pour les `V-x`, rangés dans des `describe` sans préfixe, TEC-5 pour `write guard on a spec whose committed version is a draft` (ligne 309), TEC-6 pour `chantier id from commit subjects`, `active chantier deduced from commits`, `chantier source shown to the user` et `default branch resolved through origin/HEAD` (lignes 729 à 987) ;
- les 30 tests `V-x` prennent mécaniquement le `CA-x` de même numéro, sans critère ajouté ni retiré : `V-n` de TEC-5 et de TEC-6 = `CA-n`. `'V-2/V-3 takes the signed working version'` devient `'takes the signed working version [TEC-5 CA-2, CA-3]'` ; dans le tableau `cases`, `'V-1 draft: full rewrite'` devient `'draft: full rewrite [TEC-5 CA-1]'` et `'V-2 signed, not committed: back to draft'` devient `'signed, not committed: back to draft [TEC-5 CA-2]'`. Les specs de TEC-5 et TEC-6 ne changent pas, cette correspondance est notée ici ;
- un `describe` imbriqué étiqueté (`describe('CA-2 : un bloc de code délimité fermé n’est pas contrôlé')`) perd son étiquette, que chacun de ses tests reçoit en suffixe : `'text after a closed block is still checked [FIX-22 CA-2]'` ; un test déjà étiqueté en suffixe (`[FIX-18 CA-x]`) garde son nom ;
- seuls les noms de tests changent : les `V-x` des corps (messages d'assertion, commentaires), les préfixes `décision :` et `compatibilité :` et les références de points de revue dans les noms (`RD6`, `OB2`, etc.) restent tels quels ;
- `core.test.mjs` disparaît ; `check-spec-ellipsis.test.mjs` devient `spec-ellipsis.test.mjs`.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

Aucun code de production ne change : le risque est de perdre, d'affaiblir ou de dupliquer un test, une fixture ou un utilitaire en le déplaçant, ou qu'un fichier mal nommé sorte de la suite sans bruit.

**Base** : les fichiers `plugins/atelier/test/*.test.mjs` au commit `8c1a799` (`main` fusionné dans la branche pendant la tranche 2), `core.test.mjs` et `check-spec-ellipsis.test.mjs`. `npm test` y rapporte 314 tests, tous verts.

**Script de contrôle** : `docs/chantiers/REF-16-tests-par-domaine/check-moves.mjs`, rangé dans le dossier du chantier, hors de `npm test`, rejouable par le relecteur. Sa sortie est jointe à chaque revue. Il vérifie :
- nombre : `npm test` rapporte 314 tests, tous verts, et aucune suite en échec ;
- noms : lus dans la sortie TAP du runner (`node --test --test-reporter=tap`), y compris ceux des tests générés en boucle ; chaque nom de la base correspond à exactement un nom d'après, par la règle de renommage du §3, quel que soit le fichier où il se trouve ; aucun nom n'est accepté sous sa forme ancienne ; la table de correspondance ancien nom → nouveau nom est jointe ;
- lignes : le multiensemble des lignes non vides, espaces de tête retirés, de la base est égal à celui de l'ensemble des fichiers de `test/`, aux seules différences suivantes : titres des `describe`, titres des `it` et libellés du tableau `cases` qui ne diffèrent que par leur étiquette (règle de renommage du §3), lignes d'import et d'export entre fichiers, en-têtes d'import des nouveaux fichiers, commentaires de section par chantier de la base (`// ---------- <ID>: … ----------`), et lignes d'ouverture de `describe` et `})` en surplus ou en moins, chacune à hauteur exacte de l'écart du nombre de `describe` entre la base et l'après. Une fixture, un utilitaire ou une assertion modifié en route fait échouer ce contrôle.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Écrire `check-moves.mjs` et le faire passer sur la base. Extraire les utilitaires partagés dans `test/helpers.mjs`, `core.test.mjs` les importe. Suite verte.
2. Renommer sur place tous les tests encore dans `core.test.mjs` (étiquette en suffixe, libellés du tableau `cases` compris), en un commit, suite verte et `check-moves.mjs` vert.
3. Déplacer les `describe` domaine par domaine vers leur fichier, en les renommant sans nom de chantier (et en étiquetant leurs tests s'ils ne le sont pas encore) ; un commit par domaine, suite verte et `check-moves.mjs` vert à chaque commit.
4. Supprimer `core.test.mjs` une fois vide.

Chaque étape laisse la suite verte et peut être fusionnée seule.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Un test perdu, dupliqué ou modifié au déplacement : couvert par les contrôles du §4.
- Un fichier hors du motif `plugins/atelier/test/*.test.mjs` (sous-dossier, nom sans `.test.`) ne tourne plus : couvert par le contrôle du nombre de tests.
- Les chemins relatifs à `import.meta.url` (templates, site, `bin/atelier`) : inchangés tant que les fichiers restent à plat dans `test/`.
- Les `after` de nettoyage des dossiers temporaires : chaque fichier qui en crée doit nettoyer les siens.
- Plusieurs fichiers lancés en parallèle par `node --test` : les tests créent des dépôts dans des dossiers temporaires distincts, sans état partagé entre fichiers.
- Un chantier fusionné dans `main` pendant REF-16 qui ajoute ou modifie des tests : `main` est fusionné dans la branche (pas de rebase, qui changerait les commits cités par `slice_base` et `revue.md`), la base du §4 avance au commit fusionné par amendement, et ses tests sont rangés par la tranche qui couvre leur domaine. Une fusion sans conflit peut casser un fichier de tests (import déplacé dans `helpers.mjs`) : suite relancée après chaque fusion.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné le dépôt à la fin de REF-16, quand on liste `plugins/atelier/test/`, alors `core.test.mjs` n'existe plus, chaque `describe` (ou test, pour un `describe` scindé) est dans le fichier que lui donne la table du plan, et chaque fichier de `test/`, `helpers.mjs` compris, ne dépasse pas 400 lignes (EPIC-17 CA-1).
- CA-2 : Étant donné les fichiers de tests à la fin de REF-16, quand on lit leurs `describe`, alors aucun ne contient d'identifiant de chantier.
- CA-3 : Étant donné la sortie TAP de `npm test` à la fin de REF-16, quand on lit les noms de tests, alors chaque test qui portait un identifiant de critère se termine par `[<ID> CA-x]` ou `[<ID> CA-x, CA-y]`, aucun nom ne contient de `V-x`, et aucun test sans critère n'a reçu d'étiquette.
- CA-4 : Étant donné la base `8c1a799`, quand on lance `check-moves.mjs`, alors `npm test` rapporte 314 tests verts sans suite en échec, chaque nom de la base correspond à exactement un nom d'après, et les lignes ne diffèrent que par les différences tolérées du §4.
- Laissé en l'état : le contenu des tests (aucune assertion ajoutée, retirée ou réécrite, même maladroite), leur langue, la durée de la suite, `lib/`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-23 : §4, l'écart du nombre de lignes `})` est toléré à hauteur de l'écart du nombre de `describe`, parce que scinder un `describe` (prévu par le §3) ajoute une ligne `})` que le contrôle de lignes refusait.
- 2026-11-23 : §4, revue de la tranche 1. Trois corrections du contrôle de lignes. Les commentaires de section par chantier de la base (`// ---------- <ID>: … ----------`) sont tolérés, parce qu'un fichier rangé par domaine n'a pas d'en-tête de chantier (D5). Le titre d'un `it` et le libellé du tableau `cases` sont comparés sans leur étiquette au lieu d'être ignorés, parce que l'échange de deux titres passait le contrôle (D1). Les lignes d'ouverture de `describe`, comme les `})`, sont tolérées à hauteur de l'écart du nombre de `describe`, parce qu'une scission en ajoute une (B1).
- 2026-11-23 : fusion de `main` (`8c1a799`) pendant la tranche 2, qui apporte des tests de TEC-23, FIX-18 et FIX-22. Base `8c1a799` à 314 tests, lue sur tous les `*.test.mjs` (§4, CA-4). `check-spec-ellipsis.test.mjs` (FIX-22) entre dans le périmètre et devient `spec-ellipsis.test.mjs` (§1). TEC-23 et FIX-22 rejoignent les identifiants tirés du `describe` d'origine ; l'étiquette d'un `describe` imbriqué passe sur chacun de ses tests (§3), parce qu'un `describe` ne peut porter d'identifiant (CA-2). Le contrôle du nombre refuse aussi une suite en échec, parce qu'une erreur à la construction d'un `describe` est rapportée sans test en échec (§4). Les chantiers fusionnés dans `main` pendant REF-16 sont intégrés par fusion, pas par rebase (§6), parce que `slice_base` et `revue.md` citent les commits revus.
- 2026-11-23 : §3, ajout du domaine `checks` (contrôles lancés une seule fois par état du code, tests de TEC-23), fait avec l'amendement de la fusion de `main` mais omis de son entrée ; tracé ici (revue de la tranche 2, D3).
- 2026-11-23 : §4 et §5, revue 2 de la tranche 2 (D1). Plus de nom ancien toléré : tous les tests encore dans `core.test.mjs` sont renommés sur place pendant la tranche 2, avant les déplacements des tranches 3 et 4, et chaque nom de la base doit avoir sa forme nouvelle, quel que soit son fichier. La tolérance des noms anciens laissait passer un test déplacé sans renommage, puis s'écartait du contrôle corrigé ; renommer d'abord la supprime.
