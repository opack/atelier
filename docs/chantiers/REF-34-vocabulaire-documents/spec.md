---
id: REF-34
type: REF
title: Regrouper le vocabulaire des documents lu par le code
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-25
signed_by:
signed_at:
rel_parent: EPIC-17
---

# REF-34 Regrouper le vocabulaire des documents lu par le code

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

Les termes français que le code de `plugins/atelier/lib/` lit ou écrit dans les documents d'un chantier, c'est-à-dire la grammaire des documents :

- titres de section exigés par type de spec et sections de critères (`REQUIRED_SECTIONS`, `CRITERIA_SECTIONS` dans `lib/spec.mjs`) ;
- titre de la section « Amendements » (`AMENDMENTS_HEADING` et l'ajout d'une section dans `lib/spec.mjs`) ;
- titre de la section « Tranches » du plan (`lib/slices.mjs`) ;
- titres des tableaux de revue « Bloquant » et « À discuter », colonnes « Point », « Fichier », « Traitement » et mots-clés de traitement (« corrigé », « écarté »…) dans `lib/review-points.mjs` ;
- les messages qui citent l'un de ces termes (`lib/write-guard.mjs`, `lib/review-points.mjs`, et tout autre module de `lib/` ou `lib/cli/` qui en cite un) : le terme y est tiré du vocabulaire au lieu d'être écrit en dur, le texte du message ne change pas.

Hors périmètre :
- aucune traduction, aucun choix de langue, aucun réglage : le vocabulaire reste le seul français (EPIC-14) ;
- le texte des messages eux-mêmes (catalogue de messages : EPIC-14) ;
- skills, agents, templates, site, et les chaînes attendues par les tests existants, qui restent en français ;
- le front matter, déjà neutre (`status`, `tdd`, `rel_*`…).

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

EPIC-14 (atelier sur n'importe quel dépôt) doit permettre des documents dans une autre langue que le français (décision de Didier du 2026-11-25 : langue du projet distincte de la langue de l'utilisateur). Aujourd'hui, ces termes sont écrits en dur dans quatre modules, sous forme de tableaux, d'expressions régulières et de messages : une spec en anglais casserait `check-spec`, la garde d'écriture, le compte des tranches et la lecture des revues. Les regrouper d'abord, sans rien changer au comportement, rend l'ajout d'une langue presque mécanique et empêche que de nouveaux termes s'ajoutent en dur d'ici là.

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

- **Actuel** : les termes sont dispersés (`lib/spec.mjs:15-28`, `:128`, `:191` ; `lib/slices.mjs:12` ; `lib/review-points.mjs:8-10`, `:154` ; messages de `lib/write-guard.mjs:64`, `:74`, et de `lib/review-points.mjs`).
- **Cible** : un module pur `lib/vocabulary.mjs`, sans import, expose le vocabulaire français sous des clés canoniques en anglais (ex. `sections.REF.scope`, `amendments`, `slices`, `review.tables.blocking`, `review.columns.treatment`, `review.treatments.fixed`). Les autres modules le lisent au lieu d'écrire les termes. Les exports existants (`REQUIRED_SECTIONS`, etc.) restent disponibles et donnent les mêmes valeurs. Domaine du module et de son test : `vocabulary`.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

- Les tests existants couvrent tous ces termes avec des documents réels en français : `spec.test.mjs` (sections exigées, critères, amendements), `slices.test.mjs` (« Tranches »), `review-points-*.test.mjs` (tableaux, colonnes, mots-clés, messages), `write-guard.test.mjs` (messages sur « Amendements »). Ils ne sont pas modifiés.
- Comparaison par script, sur le modèle de `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs` : même nombre de tests rapporté par `node --test`, tous verts, mêmes noms et mêmes corps avant et après.
- Un test d'architecture ajouté (CA-2) empêche le retour d'un terme écrit en dur.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

1. Créer `lib/vocabulary.mjs` et le test d'architecture (CA-2).
2. Brancher `spec.mjs`, puis `slices.mjs`, puis `review-points.mjs`, puis `write-guard.mjs` et les autres messages, un module à la fois, la suite verte à chaque étape.

Une seule PR ; chaque étape laisse la suite verte. Placement dans EPIC-17 : après les lots 3 et 4, sauf avis contraire (le lot 3 touche `CRITERIA_SECTIONS` pour TEC et REF).

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Conflits avec les branches ouvertes qui touchent `spec.mjs` ou `review-points.mjs` (lot 3 d'EPIC-17, FIX-20, FEAT-27) : d'où le placement après elles.
- Un terme courant (« Description », « Point », « Question ») peut apparaître légitimement dans un message : le test d'architecture ne vise que les termes propres à la grammaire (CA-2).

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné la branche du chantier, quand on compare `node --test` avant et après le chantier, alors le nombre de tests, leurs noms et leurs corps sont identiques hormis les tests ajoutés par ce chantier, et tous passent.
- CA-2 : Étant donné le dépôt, quand `npm test` tourne, alors un test d'architecture échoue si un fichier de `lib/` ou de `lib/cli/` autre que `lib/vocabulary.mjs` contient, dans un littéral de chaîne ou une expression régulière, l'un des termes du vocabulaire, hormis les mots courants qu'il exclut nommément (« Description », « Point », « Fichier », « Question », « Budget », « Cadre », « Quoi », « Pourquoi ») ; et si `lib/vocabulary.mjs` importe un module.
- CA-3 : Étant donné `lib/vocabulary.mjs`, quand un test le lit, alors il contient sous des clés canoniques en anglais chaque titre de `REQUIRED_SECTIONS` et `CRITERIA_SECTIONS` de chaque type, « Amendements », « Tranches », « Bloquant », « À discuter », les trois colonnes de revue et les huit mots-clés de traitement, et `REQUIRED_SECTIONS` exporté par `lib/spec.mjs` garde ses valeurs actuelles.

Laissé en l'état : les textes des messages, les skills, agents, templates, le site, et tout choix de langue (EPIC-14).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
