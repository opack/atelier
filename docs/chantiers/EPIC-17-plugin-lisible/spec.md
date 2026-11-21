---
id: EPIC-17
type: EPIC
title: Un plugin qui reste lisible en grandissant
status: draft
tdd: no              # un EPIC n'implémente rien : toujours no
created_at: 2026-11-21
signed_by:
signed_at:
---

# EPIC-17 Un plugin qui reste lisible en grandissant

<!-- Chantier d'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent
(rattachés par `rel_parent: EPIC-17` dans leur en-tête). Étapes : spec → signature → plan (découpage) → chantiers enfants → clôture.
Clôture possible quand tous les enfants sont clos et qu'au moins l'un d'eux est done ; sinon l'EPIC est abandonné. -->

## 1. Vision
<!-- Ce qui existera quand l'EPIC sera réalisé, du point de vue de l'utilisateur.
Questions si manquant : qui l'utilise, pour faire quoi ? À quoi reconnaît-on que c'est fini ? -->

Le code et les tests du plugin sont rangés par domaine : pour comprendre ou modifier un comportement (garde d'écriture, gel des tests, clôture, etc.), on ouvre un fichier de code et un fichier de tests qui portent son nom, et rien d'autre. Chaque test issu d'un critère dit de quel chantier il vient.

Le process maintient ce rangement de lui-même : un nouveau chantier range ses tests et son code dans le bon domaine, et la revue signale un fichier qui redevient un fourre-tout. Les utilisateurs du plugin en profitent aussi : les règles de rangement et d'étiquetage valent pour leurs projets.

## 2. Pourquoi
<!-- Le problème, le besoin, l'enjeu. Ce qui arrive si on ne fait rien. Pourquoi un ensemble de chantiers plutôt qu'un seul. -->

- `test/core.test.mjs` : 2067 lignes, 180 tests rangés par historique (`describe` nommés `FEAT-4 EPIC type`, `FEAT-7 review and next slice`), étiquettes `CA-x` ambiguës hors de leur bloc.
- `lib/core.mjs` : 1388 lignes ; `lib/cli.mjs` : 946 lignes. La convention « logique pure dans `core.mjs` » a été suivie à la lettre jusqu'au fourre-tout.
- Aucune revue ne l'a signalé : le reviewer lit le diff d'une tranche, jamais le fichier qu'il allonge, et sa grille ne parle pas de l'organisation des tests. `write-tests` demande de suivre les conventions existantes : il reconduit le fichier unique. Le gel des tests pénalise le déplacement d'un test comme une modification : réorganiser coûte, empiler non.
- Sans rien faire, chaque chantier allonge ces trois fichiers.
- Un seul chantier ne suffit pas : ranger les tests, ranger le code et corriger le process sont trois livrables de types différents, revus séparément, et le process ne se corrige bien qu'une fois le rangement cible en place.

## 3. Critères d'acceptation globaux
<!-- Ce que l'ensemble doit permettre, vérifiable une fois les chantiers enfants livrés.
Format : - CA-1 : Étant donné…, quand…, alors… -->

- CA-1 : Étant donné le dépôt à la clôture de l'EPIC, quand on liste `plugins/atelier/test/`, alors chaque fichier de tests couvre un seul domaine, aucun `describe` ne contient d'identifiant de chantier, et chaque test issu d'un critère se termine par l'étiquette `[<ID> CA-x]`.
- CA-2 : Étant donné le dépôt à la clôture de l'EPIC, quand on liste `plugins/atelier/lib/`, alors `core.mjs` et `cli.mjs` sont découpés en modules par domaine, et aucun module ne dépasse <SEUIL> lignes.
- CA-3 : Étant donné un nouveau chantier, quand `/atelier:write-tests` écrit ses tests, alors ses consignes disent de ranger chaque test dans le fichier de son domaine et de l'étiqueter `[<ID> CA-x]` en suffixe.
- CA-4 : Étant donné une tranche qui allonge un fichier au-delà de <SEUIL> lignes ou y mêle un second domaine, quand le reviewer la relit, alors il le signale.
- CA-5 : Étant donné des tests figés, quand un test est seulement déplacé (même nom, même corps, autre fichier ou autre position), alors `atelier freeze-tests` l'accepte sans réouverture ; quand son corps change, il refuse comme aujourd'hui.

## 4. Cadre
<!-- Le cadre commun aux chantiers enfants : choix fonctionnels (vocabulaire, parcours, règles métier) et techniques
(architecture, conventions, contraintes) qu'ils partagent. Ce qui n'est pas cadré ici se décide dans chaque enfant. -->

- **Domaine** : un comportement observable du plugin (identifiants, spec, garde d'écriture, contrôle de fin, TDD et gel, tranches, revue, clôture, prochaine étape, relations, documentation). Les fichiers de tests et les modules de `lib/` portent les mêmes noms de domaine quand c'est possible : `test/close.test.mjs` teste `lib/close.mjs`.
- **Étiquette** : en suffixe du nom du test, entre crochets, identifiant de chantier compris : `'refuse la clôture tant qu'une tranche est en cours [FEAT-7 CA-21]'`, `'le hook de démarrage affiche les enfants d'un EPIC [FEAT-4 CA-10, CA-11]'`. Un test qui ne vient d'aucun critère n'en porte pas. Les specs gardent `CA-1` sans préfixe.
- **Conventions inchangées** : Node ≥ 20, ESM, aucune dépendance ; logique en fonctions pures testées, la CLI ne fait que lire, écrire et afficher.
- **Les REF ne changent aucun comportement** : même suite, mêmes résultats, avant et après.

## 5. Hors périmètre
<!-- Ce que l'EPIC ne couvre pas, même si on pourrait l'y attendre. -->

- Le bug de `highestChantierNumber` (`lib/core.mjs:481`), qui prend `CA-27` pour un identifiant de chantier : FIX isolé.
- La durée de la suite de tests (environ 60 s).
- Le contenu des skills, agents et templates hors des règles de rangement et d'étiquetage.
- La réécriture des tests ou du code : on range, on n'améliore pas.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
