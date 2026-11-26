---
id: REF-34
type: REF
title: Regrouper le vocabulaire des documents lu par le code
status: signed
tdd: no
created_at: 2026-11-25
signed_by: Opack
signed_at: 2026-11-25
rel_parent: EPIC-17
slice: 3
slice_base: a1402fc4c949c5a5635a3e273dd95e7cb6894c1f
tests_commit: 
slice_tdd: 
---

# REF-34 Regrouper le vocabulaire des documents lu par le code

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

Les termes français que le code de `plugins/atelier/lib/` lit ou écrit dans les documents d'un chantier, c'est-à-dire la grammaire des documents (SB1) :

- spec : titres de section exigés par type et sections de critères (`REQUIRED_SECTIONS`, `CRITERIA_SECTIONS` dans `lib/spec.mjs`) ; titre de la section « Amendements » (lecture et création) ;
- amendements écrits et relus par le code : « tests rouverts » et « tests regelés » (`lib/tdd.mjs`, relus aussi par `lib/slices.mjs`) ;
- plan : titre de la section « Tranches », et dans chaque tranche les segments « CA couverts : » et « TDD : oui|non » (`lib/slices.mjs`) ;
- la mention « gel quitté » des entrées « tests rouverts » écrites par `lib/tdd.mjs` ;
- revue (`lib/review-points.mjs`) : titres des tableaux « Bloquant » et « À discuter », et leurs formes normalisées en minuscules ; anciennes sections « Tour » ; colonnes « Point », « Fichier », « Traitement » ; mots-clés de traitement (« corrigé », « écarté »…) ; marqueurs de point « (repris) » et « (ex-RBn) » ; ligne vide « Aucun » ; formes « reporté (tranche N) » et « requalifié (RBn) » ;
- les citations de ces termes dans les messages (`lib/write-guard.mjs`, `lib/review-points.mjs`, et tout autre module de `lib/` ou `lib/cli/`) : un terme **cité** comme élément du document (« la section « ## Amendements » », la liste des mots-clés de traitement) est tiré du vocabulaire. Le texte du message ne change pas.

Hors périmètre :
- aucune traduction, aucun choix de langue, aucun réglage : le vocabulaire reste le seul français (EPIC-14) ;
- le texte des messages eux-mêmes, et tout mot employé dans une phrase plutôt que cité comme élément du document (« reporté à une tranche », « requalifiée ») : une phrase se traduit entière, jamais mot à mot, par le catalogue de messages d'EPIC-14 (SD4) ;
- skills, agents, templates, site, et les chaînes attendues par les tests existants, qui restent en français ;
- le front matter, déjà neutre (`status`, `tdd`, `rel_*`…) ;
- la typographie (SD2) : une seule convention pour toutes les langues, celle d'aujourd'hui (« Libellé : », entrée d'amendement « - AAAA-MM-JJ : »), sans clé de vocabulaire. Le format de date AAAA-MM-JJ n'est pas une question de langue (il se trie) et reste fixe.

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

EPIC-14 (atelier sur n'importe quel dépôt) doit permettre des documents dans une autre langue que le français (décision de Didier du 2026-11-25 : langue du projet distincte de la langue de l'utilisateur). Aujourd'hui, ces termes sont écrits en dur dans quatre modules, sous forme de tableaux, d'expressions régulières et de messages : une spec en anglais casserait `check-spec`, la garde d'écriture, le compte des tranches et la lecture des revues. Les regrouper d'abord, sans rien changer au comportement, rend l'ajout d'une langue presque mécanique et empêche que de nouveaux termes s'ajoutent en dur d'ici là.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

- **Actuel** : les termes sont dispersés dans `lib/spec.mjs`, `lib/tdd.mjs`, `lib/slices.mjs`, `lib/review-points.mjs` (tableaux, expressions régulières) et cités en dur dans les messages de `lib/write-guard.mjs` et `lib/review-points.mjs`.
- **Cible** : un module pur `lib/vocabulary.mjs`, sans import, exporte `VOCABULARY`, le vocabulaire français sous des clés canoniques en anglais : `sections.<TYPE>` (une clé par section exigée), `criteria.<TYPE>`, `amendments`, `amendmentEntries.reopened`, `amendmentEntries.refrozen`, `amendmentEntries.leftFreeze`, `slices`, `plan.coverage`, `plan.tdd`, `plan.yes`, `plan.no`, `review.tables.blocking`, `review.tables.discuss`, `review.legacyRound`, `review.columns.point`, `review.columns.file`, `review.columns.treatment`, `review.treatments.<clé>` (huit clés), `review.postponedSlice`, `review.markers.resumed`, `review.markers.formerly`, `review.empty`. Les autres modules le lisent au lieu d'écrire les termes. Les exports existants (`REQUIRED_SECTIONS`, etc.) restent disponibles et donnent les mêmes valeurs. Domaine du module et de son test : `vocabulary`.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

- Les tests existants couvrent tous ces termes avec des documents réels en français : `spec.test.mjs` (sections exigées, critères, amendements), `slices.test.mjs` (« Tranches »), `review-points-*.test.mjs` (tableaux, colonnes, mots-clés, messages), `write-guard.test.mjs` (messages sur « Amendements »). Ils ne sont pas modifiés.
- Comparaison par script, sur le modèle de `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs` : même nombre de tests rapporté par `node --test`, tous verts, mêmes noms et mêmes corps avant et après.
- Un test d'architecture ajouté (CA-2) empêche le retour d'un terme écrit en dur à une position de grammaire.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Créer `lib/vocabulary.mjs` et le test d'architecture (CA-2).
2. Brancher `spec.mjs`, puis `slices.mjs`, puis `review-points.mjs`, puis `write-guard.mjs` et les autres messages, un module à la fois, la suite verte à chaque étape.

Une seule PR ; chaque étape laisse la suite verte. Placement dans EPIC-17 : après les lots 3 et 4, sauf avis contraire (le lot 3 touche `CRITERIA_SECTIONS` pour TEC et REF).

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Conflits avec les branches ouvertes qui touchent `spec.mjs` ou `review-points.mjs` (lot 3 d'EPIC-17, FIX-20, FEAT-27) : d'où le placement après elles.
- Un terme courant (« Description », « Point », « Question ») ou un mot-clé employé dans une phrase peut apparaître légitimement dans un message : le test d'architecture ne vise que les positions de grammaire (CA-2), pas la prose.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné la branche du chantier, quand on compare `node --test` avant et après le chantier, alors le nombre de tests, leurs noms et leurs corps sont identiques hormis les tests ajoutés par ce chantier, et tous passent.
- CA-2 : Étant donné le dépôt, quand `npm test` tourne, alors un test d'architecture (SB2) lit chaque fichier de `lib/` et `lib/cli/` autre que `lib/vocabulary.mjs`, commentaires retirés, et échoue s'il trouve, pour l'un des termes de `VOCABULARY` (liste calculée depuis le module, pas figée dans le test), à l'une de ces positions de grammaire : un littéral de chaîne ou de gabarit dont le contenu entier est le terme ; une expression régulière qui contient le terme ; le terme cité entre « » dans une chaîne, seul ou précédé de `## ` ou `### `. La comparaison respecte la casse. Les mots courants exclus nommément (« Description », « Point », « Fichier », « Question », « Budget », « Cadre », « Quoi », « Pourquoi ») ne sont exclus que comme terme entier : « Pourquoi maintenant » reste visé. Le test échoue aussi si `lib/vocabulary.mjs` importe un module. Des exemples fabriqués montrent la règle en échec pour chaque position (chaîne, gabarit, expression régulière, citation entre « ») et pour l'import, et montrent qu'un mot-clé dans une phrase (« reporté à une tranche ») n'est pas signalé.
- CA-3 : Étant donné `lib/vocabulary.mjs`, quand un test le lit, alors `VOCABULARY` porte exactement les clés listées au §3 avec les valeurs françaises d'aujourd'hui (SD3), et `REQUIRED_SECTIONS`, ainsi que les listes de tableaux, de colonnes et de mots-clés de traitement lues par `lib/review-points.mjs`, gardent leurs valeurs actuelles.

Laissé en l'état : les textes des messages et les mots employés dans leurs phrases, les skills, agents, templates, le site, la typographie des deux-points et le format de date AAAA-MM-JJ, et tout choix de langue (EPIC-14).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-25 : clé `review.postponedSlice` (« tranche ») ajoutée à la liste du §3, pourquoi : la regex de « reporté (tranche N) » contient ce mot, et CA-3 fige exactement les clés du §3 (oubli relevé à la conception).
- 2026-11-26 : clés `plan.coverage` (« CA couverts »), `plan.tdd` (« TDD »), `plan.yes` (« oui »), `plan.no` (« non ») et `amendmentEntries.leftFreeze` (« gel quitté ») ajoutées au §1 et au §3, pourquoi : `slices.mjs` lit ces termes dans les tranches du plan et `tdd.mjs` écrit « gel quitté » ; un plan dans une autre langue perdrait en silence les CA et le TDD de chaque tranche (RD2, revue 1 de la tranche 1).
