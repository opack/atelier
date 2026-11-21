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
- `lib/core.mjs` (1388 lignes) et `lib/cli.mjs` (946 lignes) : leur découpage est un autre enfant d'EPIC-17.
- Le process qui a produit ce fichier (règle de rangement et d'étiquetage dans `write-tests`, contrôle de l'organisation des tests par le reviewer, gel qui distingue un test déplacé d'un test modifié) : autre enfant d'EPIC-17.
- `highestChantierNumber` (`lib/core.mjs:481`) prend `CA-27` d'un sujet de commit pour un identifiant de chantier (`atelier next-id REF` donne REF-28 au lieu de REF-16) : FIX isolé, hors EPIC-17.
- La durée de la suite (environ 60 s).

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

- Un seul fichier de 2067 lignes, 38 `describe`, 180 tests. Chaque chantier l'allonge par le bas.
- Les tests sont rangés par historique, pas par comportement : 16 `describe` portent un nom de chantier (`FEAT-4 EPIC type`, `FEAT-7 review and next slice`, etc.). Pour savoir ce qui garantit la garde d'écriture, il faut lire quatre blocs dispersés.
- Hors de leur `describe`, les étiquettes `CA-x` sont ambiguës : FEAT-4 et FEAT-7 ont chacun un CA-1 à CA-13.
- Les prochains chantiers ajouteront encore des tests : ranger maintenant évite de ranger plus tard un fichier encore plus gros.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

**Actuel** : `test/core.test.mjs`, utilitaires (fixtures, dépôts git temporaires, appel de la CLI) définis au fil du fichier, `describe` préfixés par `FEAT-4` ou `FEAT-7`, tests nommés `CA-x : <comportement>`.

**Cible** :
- un fichier `test/<domaine>.test.mjs` par domaine ; un domaine est un comportement observable du plugin. Découpage proposé, à confirmer au plan :
  - `identifiers` : identifiants, chantier actif (branche, commits, `origin/HEAD`), source affichée ;
  - `spec` : front matter, complétude, amendements, contrôles avant signature (relations, type EPIC) ;
  - `write-guard` : garde d'écriture, toutes variantes (brouillon, signée, par tranche, EPIC), chemins ;
  - `stop-hook` : contrôle de fin ;
  - `tdd` : phases, gel, regel, réouverture des tests ;
  - `slices` : plan et tranche en cours ;
  - `review` : état de revue, passage à la tranche suivante ;
  - `close` : clôture (dépendances, EPIC, tranches) ;
  - `next-step` : prochaine étape et affichage de `status` ;
  - `relations` : lecture des relations, enfants d'un EPIC ;
  - `docs` : section Process du `CLAUDE.md`, site, vocabulaire ;
- `test/helpers.mjs` (sans `.test.`) : utilitaires partagés par plusieurs fichiers ; un utilitaire utilisé par un seul fichier reste dans ce fichier ;
- aucun nom de chantier dans un `describe` ; un `describe` actuel qui mêle deux domaines est scindé ;
- un test lié à un critère porte l'étiquette en **suffixe**, entre crochets, identifiant de chantier compris : `'refuse la clôture tant qu'une tranche est en cours [FEAT-7 CA-21]'`, `'le hook de démarrage affiche les enfants d'un EPIC [FEAT-4 CA-10, CA-11]'` ; un test qui ne vient d'aucun critère n'en porte pas ;
- `core.test.mjs` disparaît.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

Aucun code de production ne change : le risque est de perdre, d'affaiblir ou de dupliquer un test en le déplaçant. Contrôles, avant et après :
- `npm test` : 180 tests, tous verts, avant comme après.
- Noms : la liste des noms de tests après, une fois l'étiquette remise sous l'ancienne forme (`<texte> [FEAT-7 CA-21]` → `CA-21 : <texte>`), est identique à la liste d'avant, sans doublon.
- Corps : chaque corps de `it` après est identique à celui d'avant, à l'indentation près.

Ces deux comparaisons se font par un script jetable (hors dépôt), dont la sortie est jointe à la revue.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Extraire les utilitaires partagés dans `test/helpers.mjs`, `core.test.mjs` les importe. Suite verte.
2. Déplacer les `describe` domaine par domaine vers leur fichier, en les renommant sans nom de chantier ; un commit par domaine, suite verte à chaque commit.
3. Renommer les tests liés à un critère vers la forme à étiquette en suffixe.
4. Supprimer `core.test.mjs` une fois vide.

Chaque étape laisse la suite verte et peut être fusionnée seule.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Un test perdu ou dupliqué au déplacement : couvert par la comparaison des noms et des corps (§4).
- Les chemins relatifs à `import.meta.url` (templates, site, `bin/atelier`) : inchangés tant que les fichiers restent à plat dans `test/`.
- Les `after` de nettoyage des dossiers temporaires : chaque fichier qui en crée doit nettoyer les siens.
- Plusieurs fichiers lancés en parallèle par `node --test` : les tests créent des dépôts dans des dossiers temporaires distincts, sans état partagé entre fichiers.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- `core.test.mjs` n'existe plus ; chaque fichier de `test/` couvre un seul domaine.
- Aucun `describe` ne contient d'identifiant de chantier ; chaque test issu d'un critère se termine par `[<ID> CA-x]`.
- Les contrôles du §4 passent.
- Laissé en l'état : le contenu des tests (aucune assertion ajoutée, retirée ou réécrite, même maladroite), la durée de la suite, `lib/`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
