---
id: REF-16
type: REF
title: Tests rangés par domaine
status: draft
tdd: no
rel_parent: EPIC-17
created_at: 2026-11-21
signed_by:
signed_at:
---

# REF-16 Tests rangés par domaine

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

- `plugins/atelier/test/core.test.mjs` : découpé en plusieurs fichiers de tests, un par domaine, plus un module d'utilitaires partagés.
- Noms des `describe` et des `it` de ce fichier.

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

**Actuel** : `test/core.test.mjs`, utilitaires (fixtures, dépôts git temporaires, appel de la CLI) définis au fil du fichier, `describe` préfixés par `FEAT-4`, `FEAT-7` ou `TEC-15`, tests nommés `CA-x : <comportement>` (133 tests) ou `V-x : <comportement>` (17 tests : 1 de TEC-5, 16 de TEC-6), les autres sans étiquette.

**Cible** :
- un fichier `test/<domaine>.test.mjs` par domaine, nom en anglais ; un domaine est un comportement observable du plugin, ou le socle (`common`) qui regroupe les utilitaires partagés (front matter, chemins et motifs, sortie git). Découpage proposé, confirmé au plan :
  - `identifiers` : identifiants, chantier actif (branche, commits, `origin/HEAD`), source affichée ;
  - `spec` : complétude, amendements, contrôles avant signature (relations, type EPIC) ;
  - `write-guard` : garde d'écriture, toutes variantes (brouillon, signée, par tranche, EPIC) ;
  - `stop-hook` : contrôle de fin ;
  - `tdd` : phases, gel, regel, réouverture des tests ;
  - `slices` : plan et tranche en cours ;
  - `review` : état de revue, passage à la tranche suivante ;
  - `review-points` : lecture, contrôle et numérotation des points de `revue.md`, refus des points ouverts ;
  - `close` : clôture (dépendances, EPIC, tranches) ;
  - `next-step` : prochaine étape et affichage de `status` ;
  - `relations` : lecture des relations, enfants d'un EPIC ;
  - `docs` : section Process du `CLAUDE.md`, site, vocabulaire, préfixes dans les agents, skills et templates ;
  - `common` : front matter, chemins et motifs, sortie git, éditions d'outils ;
- un domaine qui dépasse 400 lignes se scinde en `<domaine>-<sous-domaine>.test.mjs` (probable pour `review-points`, environ 560 lignes aujourd'hui) ;
- `test/helpers.mjs` (sans `.test.`) : utilitaires partagés par plusieurs fichiers ; un utilitaire utilisé par un seul fichier reste dans ce fichier ;
- aucun nom de chantier dans un `describe` ; un `describe` actuel qui mêle deux domaines est scindé ;
- un test lié à un critère porte l'étiquette `[<ID> CA-x]` en suffixe de son nom : `'refuse la clôture tant qu'une tranche est en cours [FEAT-7 CA-21]'`, `'le hook de démarrage affiche les enfants d'un EPIC [FEAT-4 CA-10, CA-11]'` ; un test qui ne vient d'aucun critère n'en porte pas ;
- les 17 tests `V-x` prennent le `CA-x` de même numéro : `V-n` de TEC-5 et de TEC-6 = `CA-n` (`'V-2/V-3 takes the signed working version'` devient `'takes the signed working version [TEC-5 CA-2, CA-3]'`) ; les specs de TEC-5 et TEC-6 ne changent pas, cette correspondance est notée ici ;
- `core.test.mjs` disparaît.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

Aucun code de production ne change : le risque est de perdre, d'affaiblir ou de dupliquer un test en le déplaçant, ou qu'un fichier mal nommé sorte de la suite sans bruit. Base mesurée avant le chantier : `npm test` rapporte 256 tests, tous verts. Contrôles après, par un script jetable (hors dépôt) dont la sortie est jointe à chaque revue :
- nombre : `npm test` rapporte 256 tests, tous verts ;
- noms : chaque nom d'avant correspond à exactement un nom d'après, par la règle de renommage du §3 (étiquette déplacée en suffixe, identifiant de chantier tiré du `describe` d'origine, `V-n` → `CA-n`) ; la table de correspondance ancien nom → nouveau nom est jointe ;
- corps : chaque corps de test d'après est identique à celui d'avant, à l'indentation près.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Extraire les utilitaires partagés dans `test/helpers.mjs`, `core.test.mjs` les importe. Suite verte.
2. Déplacer les `describe` domaine par domaine vers leur fichier, en les renommant sans nom de chantier et en étiquetant leurs tests ; un commit par domaine, suite verte et contrôles du §4 à chaque commit.
3. Supprimer `core.test.mjs` une fois vide.

Chaque étape laisse la suite verte et peut être fusionnée seule.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Un test perdu, dupliqué ou modifié au déplacement : couvert par les contrôles du §4.
- Un fichier hors du motif `plugins/atelier/test/*.test.mjs` (sous-dossier, nom sans `.test.`) ne tourne plus : couvert par le contrôle du nombre de tests.
- Les chemins relatifs à `import.meta.url` (templates, site, `bin/atelier`) : inchangés tant que les fichiers restent à plat dans `test/`.
- Les `after` de nettoyage des dossiers temporaires : chaque fichier qui en crée doit nettoyer les siens.
- Plusieurs fichiers lancés en parallèle par `node --test` : les tests créent des dépôts dans des dossiers temporaires distincts, sans état partagé entre fichiers.
- Un chantier ouvert pendant REF-16 qui ajoute des tests à `core.test.mjs` : à rebaser sur le découpage ; aucun autre chantier ne touche `test/` pendant REF-16.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné le dépôt à la fin de REF-16, quand on liste `plugins/atelier/test/`, alors `core.test.mjs` n'existe plus, et chaque fichier de tests couvre un seul domaine (ou sous-domaine) et ne dépasse pas 400 lignes (EPIC-17 CA-1).
- CA-2 : Étant donné les fichiers de tests à la fin de REF-16, quand on lit leurs `describe`, alors aucun ne contient d'identifiant de chantier.
- CA-3 : Étant donné les fichiers de tests à la fin de REF-16, quand on lit les noms de tests, alors chaque test qui portait un identifiant de critère se termine par `[<ID> CA-x]` ou `[<ID> CA-x, CA-y]`, aucun `V-x` ne subsiste, et aucun test sans critère n'a reçu d'étiquette.
- CA-4 : Étant donné la base mesurée avant le chantier, quand on lance les contrôles du §4, alors `npm test` rapporte 256 tests verts, chaque nom d'avant correspond à exactement un nom d'après et chaque corps est inchangé à l'indentation près.
- Laissé en l'état : le contenu des tests (aucune assertion ajoutée, retirée ou réécrite, même maladroite), leur langue, la durée de la suite, `lib/`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
