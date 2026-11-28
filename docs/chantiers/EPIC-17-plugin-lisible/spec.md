---
id: EPIC-17
type: EPIC
title: Un plugin qui reste lisible en grandissant
status: signed
tdd: no              # un EPIC n'implémente rien : toujours no
created_at: 2026-11-21
signed_by: Opack
signed_at: 2026-11-21
---

# EPIC-17 Un plugin qui reste lisible en grandissant

<!-- Chantier d'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent
(rattachés par `rel_parent: EPIC-17` dans leur en-tête). Étapes : spec → signature → plan (découpage) → chantiers enfants → clôture.
Clôture possible quand tous les enfants sont clos et qu'au moins l'un d'eux est done ; sinon l'EPIC est abandonné. -->

## 1. Vision
<!-- Ce qui existera quand l'EPIC sera réalisé, du point de vue de l'utilisateur.
Questions si manquant : qui l'utilise, pour faire quoi ? À quoi reconnaît-on que c'est fini ? -->

Le code et les tests du plugin sont rangés par domaine : pour comprendre ou modifier un comportement (garde d'écriture, gel des tests, clôture, etc.), on ouvre le module qui porte sa logique et le fichier qui porte ses tests, tous deux à son nom. Son code d'entrées / sorties est rangé à part, sous le même nom. Chaque test issu d'un critère dit de quel chantier et de quel critère il vient.

Le process maintient ce rangement de lui-même : un nouveau chantier range ses tests et son code dans le bon domaine, la revue signale un fichier qui redevient un fourre-tout, et dans ce dépôt un test d'architecture fait échouer la suite. Les utilisateurs du plugin profitent des mêmes règles de rangement et d'étiquetage dans leurs projets, appliquées par les skills et le reviewer.

## 2. Pourquoi
<!-- Le problème, le besoin, l'enjeu. Ce qui arrive si on ne fait rien. Pourquoi un ensemble de chantiers plutôt qu'un seul. -->

- `test/core.test.mjs` : 2067 lignes, 180 tests rangés par historique (`describe` nommés `FEAT-4 EPIC type`, `FEAT-7 review and next slice`), étiquettes ambiguës hors de leur bloc (FEAT-4 et FEAT-7 ont chacun un critère numéro 1, TEC-5 et TEC-6 chacun une vérification numéro 2).
- `lib/core.mjs` : 1388 lignes ; `lib/cli.mjs` : 946 lignes. La convention « logique pure dans `core.mjs` » a été suivie à la lettre jusqu'au fourre-tout.
- Aucune revue ne l'a signalé : le reviewer lit le diff d'une tranche, jamais le fichier qu'il allonge, et sa grille ne parle pas de l'organisation des tests. `write-tests` demande de suivre les conventions existantes : il reconduit le fichier unique. À partir de la tranche 2, `freeze-tests` refuse toute ligne de test d'une tranche précédente retirée, même quand elle n'a fait que changer de place : réorganiser coûte, empiler non.
- Seuls FEAT et FIX doivent numéroter leurs critères (`CRITERIA_SECTIONS`, `lib/core.mjs:43-46`) : TEC-5 et TEC-6 ont improvisé des vérifications numérotées, TEC-1 à TEC-3 n'étiquettent rien.
- Sans rien faire, chaque chantier allonge ces trois fichiers.
- Un seul chantier ne suffit pas : ranger les tests, ranger le code et corriger le process sont trois livrables de types différents, revus séparément, et le process ne se corrige bien qu'une fois le rangement cible en place.

## 3. Critères d'acceptation globaux
<!-- Ce que l'ensemble doit permettre, vérifiable une fois les chantiers enfants livrés.
Format : - AC-1 : Étant donné…, quand…, alors… -->

- AC-1 : Étant donné le dépôt à la clôture de l'EPIC, quand on liste `plugins/atelier/test/`, alors chaque fichier de tests couvre un seul domaine (ou sous-domaine) et ne dépasse pas 400 lignes, aucun `describe` ne contient d'identifiant de chantier, chaque test qui portait un identifiant de critère ou de vérification se termine par l'étiquette `[<ID> AC-x]`, et aucun identifiant de vérification ne subsiste.
- AC-2 : Étant donné le dépôt à la clôture de l'EPIC, quand on liste `plugins/atelier/lib/`, alors `core.mjs` et `cli.mjs` sont découpés par domaine, logique pure et entrées / sorties séparées, et aucun module ne dépasse 400 lignes.
- AC-3 : Étant donné un nouveau chantier, quand `/atelier:write-tests` ou `/atelier:build` écrit des tests, alors leurs consignes disent de ranger chaque test dans le fichier de son domaine et de l'étiqueter `[<ID> AC-x]` en suffixe de son nom, ou dans un commentaire sur le test quand le framework n'admet pas de crochets dans un nom ; `/atelier:build` dit aussi de ranger le code dans le module de son domaine.
- AC-4 : Étant donné une tranche qui fait passer un fichier de code ou de tests au-delà de 400 lignes, ou qui y mêle un second domaine, quand le reviewer la relit, alors il le signale « à discuter » ; un fichier déjà au-delà de 400 lignes avant la tranche ne déclenche pas de remarque à chaque tranche.
- AC-5 : Étant donné une tranche 2 ou suivante en phase « tests d'abord », quand des lignes de tests d'une tranche précédente sont seulement déplacées (chaque ligne retirée réapparaît ajoutée dans le même diff, espaces ignorés, y compris dans un autre fichier et y compris quand le fichier d'origine est supprimé), alors `atelier freeze-tests` accepte sans réouverture et le reviewer ne signale pas le déplacement comme une modification ; quand une ligne retirée ne réapparaît pas (test modifié, renommé ou supprimé), `freeze-tests` refuse comme aujourd'hui.
- AC-6 : Étant donné une spec TEC ou REF, quand `atelier check-spec` la vérifie, alors il exige au moins un critère numéroté `AC-x` dans sa section « Vérification » (TEC) ou « Critère de fin » (REF), comme pour FEAT et FIX ; les templates `spec-tec.md` et `spec-ref.md` le demandent.
- AC-7 : Étant donné le dépôt, quand `npm test` tourne, alors un test d'architecture échoue si un fichier de `lib/` ou de `test/` dépasse 400 lignes, si un `describe` contient un identifiant de chantier, ou si un nom de test contient un identifiant de critère hors d'une étiquette finale de la forme `[<ID> AC-n]` ou `[<ID> AC-n, AC-m]`.

## 4. Cadre
<!-- Le cadre commun aux chantiers enfants : choix fonctionnels (vocabulaire, parcours, règles métier) et techniques
(architecture, conventions, contraintes) qu'ils partagent. Ce qui n'est pas cadré ici se décide dans chaque enfant. -->

- **Domaine** : un comportement observable du plugin (identifiants, spec, garde d'écriture, contrôle de fin, TDD et gel, tranches, revue, clôture, prochaine étape, relations, documentation), ou le **socle** qui regroupe les utilitaires partagés (front matter, chemins et motifs, sortie git). Les noms de domaine sont en anglais. REF-16 fixe la liste en rangeant les tests ; le REF de `lib/` la reprend : `test/close.test.mjs` teste `lib/close.mjs`. Un domaine qui dépasse 400 lignes se scinde en `<domaine>-<sous-domaine>`.
- **Code d'entrées / sorties** : rangé à part du module pur, sous le même nom de domaine. Son emplacement, le sort de `core.mjs` (façade de réexport ou suppression) et les fonctions internes qu'il faut désormais exporter se décident dans le REF de `lib/`.
- **Critères** : tout type de chantier qui a des tests numérote ses critères vérifiables `AC-x` (FEAT, FIX, TEC, REF, EPIC) ; les sections gardent leur nom propre au type. Le SPIKE, au code jetable, n'en a pas.
- **Étiquette** : `[<ID> AC-x]` en suffixe du nom du test, identifiant de chantier compris : `'refuse la clôture tant qu'une tranche est en cours [FEAT-7 AC-21]'`, `'le hook de démarrage affiche les enfants d'un EPIC [FEAT-4 AC-10, AC-11]'`. Un test qui ne vient d'aucun critère n'en porte pas. Les specs gardent `AC-1` sans préfixe. Les 17 tests de vérification de TEC-5 et TEC-6 deviennent des tests étiquetés par critère, de même numéro, dans REF-16, qui note la correspondance entre les deux numérotations ; les specs de TEC-5 et TEC-6 ne changent pas.
- **Seuil de 400 lignes** : fichiers de code et de tests ; ni Markdown, ni JSON, ni fichiers générés.
- **REF de rangement** : en `tdd: no`. Preuve de non-régression : même nombre de tests rapporté par `node --test`, tous verts, mêmes noms (étiquette ramenée à l'ancienne forme) et mêmes corps, comparés par script.
- **Ordre** : les deux REF de rangement, puis le FIX du process. En `tdd: no`, les REF ne passent pas par le gel et n'attendent pas AC-5.
- **Clôture** : l'EPIC se clôt quand ses critères globaux sont tenus ; un enfant abandonné est repris par un autre chantier (`rel_replaces`) plutôt que de laisser un critère non tenu.
- **Conventions inchangées** : Node ≥ 20, ESM, aucune dépendance ; logique en fonctions pures testées, la CLI ne fait que lire, écrire et afficher.

## 5. Hors périmètre
<!-- Ce que l'EPIC ne couvre pas, même si on pourrait l'y attendre. -->

- Le bug de `highestChantierNumber` (`lib/core.mjs:481`), qui prend `AC-27` pour un identifiant de chantier : FIX isolé.
- La durée de la suite de tests (environ 60 s).
- Les specs et bilans des chantiers clos : ils gardent les anciens noms de tests et de fichiers.
- Un seuil configurable, et un test d'architecture dans les projets des utilisateurs : chez eux, les règles passent par les skills et le reviewer.
- Le contenu des skills, agents et templates hors des règles de rangement, d'étiquetage et de numérotation des critères.
- La réécriture des tests ou du code : on range, on n'améliore pas.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-28 : TEC-37 : les critères s'écrivent AC-n (CA-n → AC-n de même numéro, dans la spec et le plan) ; les mentions des anciennes vérifications de TEC-5 et TEC-6 sont reformulées sans leur ancienne forme. Aucun critère ne change de sens.
