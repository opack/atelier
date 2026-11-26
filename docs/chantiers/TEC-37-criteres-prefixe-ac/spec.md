---
id: TEC-37
type: TEC
title: Préfixe AC pour les critères d'acceptation
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-26
signed_by:
signed_at:
rel_depends_on: REF-34
---

# TEC-37 Préfixe AC pour les critères d'acceptation

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

Les critères d'acceptation s'écrivent désormais `AC-1`, `AC-2`… (Acceptance Criterion) au lieu de `CA-1`. Le code lit les deux formes ; tout ce qu'atelier écrit ou fait écrire (templates, skills, agents, site, nouveaux tests) passe à `AC-n`. L'historique n'est pas réécrit.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

Les identifiants d'atelier suivent une règle : une lettre (ou deux) dit ce qu'on désigne, en initiale anglaise, un chiffre dit lequel (`SB`/`SD` Spec, `RB`/`RD` Review, `OB`/`OD` Overfit, `B` Blocking, `D` to Discuss, `F` Follow-up à venir). `CA` est la seule exception, tirée du français. Les codes sont neutres et ne se traduisent pas (seuls leurs libellés passeront par le vocabulaire de REF-34) : avec EPIC-14, un projet en anglais écrirait sinon `CA-1` dans ses specs. Le corriger maintenant coûte quelques expressions régulières ; le faire après la sortie d'atelier sur d'autres dépôts coûterait une migration chez chacun.

Décision de Didier du 2026-11-26 (fil « Ne plus oublier les suites des chantiers »), préalable au tableau de nomenclature du site prévu avec le chantier des suites.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- Lecture des deux formes, sans distinction de casse comme aujourd'hui : critères d'une spec (`lib/slices.mjs`, `specCriteria`), section obligatoire de critères (`lib/spec.mjs`, `checkSpec`), segment de couverture d'une tranche du plan (`CA couverts :` et `AC couverts :`, `lib/slices.mjs`), règle d'étiquette finale des tests (`test/architecture.test.mjs` : `[<ID> AC-n]`, `[<ID> CA-n]`, `[<ID> V-n]`).
- Écriture en `AC-n` : templates `spec-feat.md`, `spec-fix.md`, `spec-tec.md`, `spec-ref.md`, `spec-epic.md`, `plan.md`, `plan-epic.md` ; skills `new`, `plan`, `amend`, `write-tests` et les autres qui citent un critère ; agent `reviewer` ; messages de la CLI (« aucun critère numéroté (AC-1, AC-2…) ») ; `CLAUDE.md` et `README.md` ; pages du site qui décrivent les critères (glossaire, cycle, fondations, référence).
- Un chantier garde la forme de sa spec signée : FEAT-21, FEAT-35, REF-34 et EPIC-14, déjà rédigés en `CA-n`, continuent en `CA-n`, tests compris. Le skill `write-tests` étiquette avec le préfixe des critères de la spec.
- Le glossaire du site signale `CA-n` comme ancienne forme, toujours lue.
- Version mineure du plugin (les specs et plans écrits changent de forme).

Hors périmètre :
- Réécrire les specs, plans, bilans, revues et commits des chantiers existants.
- Modifier une ligne d'un test existant (les étiquettes `[… CA-n]` restent).
- Le tableau de nomenclature complet du site : il vient avec le chantier des suites (`F1`).
- Exiger des critères numérotés dans les sections « Vérification » (TEC) et « Critère de fin » (REF) dans `check-spec` : c'est CA-6 d'EPIC-17 (lot 3), qui reprendra la forme `AC-n`. Ce chantier se limite à faire demander des `AC-n` par les templates `spec-tec.md` et `spec-ref.md`.
- Les critères de ce chantier restent en `CA-n` : ses tests doivent respecter le test d'architecture actuel, qui ne connaît pas encore `AC`.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

- Les specs ouvertes après la mise à jour du plugin s'écrivent en `AC-n` ; les anciennes restent valides sans rien faire.
- REF-34 (dernière tranche en cours) branche le vocabulaire dans `lib/slices.mjs` et `lib/spec.mjs`. TEC-37 dépend de lui : ses tests et son code s'écrivent après la fusion de REF-34 dans `main`, sur les expressions tirées du vocabulaire. Le préfixe (`CA|AC`) est un code, pas un terme du vocabulaire ; le mot « couverts » du segment de couverture, lui, en est un et reste dans le vocabulaire.
- Une spec qui mélange `CA-n` et `AC-n` est signalée par `check-spec` : deux critères de même numéro sous deux préfixes seraient indiscernables pour un lecteur.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- CA-1 : Étant donné une spec dont les critères sont `- [ ] AC-1 : …` et `- AC-2 : …`, quand on en extrait les critères, alors on obtient `AC-1` et `AC-2` ; la même spec en `CA-n` donne toujours `CA-1` et `CA-2`.
- CA-2 : Étant donné une spec FEAT dont la section de critères ne contient que des `AC-n`, quand on lance `check-spec`, alors aucun « aucun critère numéroté » n'est signalé ; sans aucun critère, le message cite `AC-1, AC-2…`.
- CA-3 : Étant donné une spec qui contient à la fois un `CA-n` et un `AC-n` en tête de critère, quand on lance `check-spec`, alors un problème le signale en citant les deux préfixes.
- CA-4 : Étant donné une tranche de plan `… — AC couverts : AC-1, AC-2 — TDD : oui`, quand on lit le plan, alors la tranche couvre `AC-1` et `AC-2` ; la forme `CA couverts : CA-1` reste lue à l'identique.
- CA-5 : Étant donné un nom de test qui se termine par `[FEAT-40 AC-3]`, quand le test d'architecture s'applique, alors il est accepté ; `[FEAT-4 CA-3]` et `[TEC-5 V-1]` (ancienne forme des vérifications de TEC) le restent ; un `AC-3` hors de l'étiquette finale est refusé comme un `CA-3`.
- CA-6 : Étant donné les templates, skills, agents, `CLAUDE.md`, `README.md` et le site (hors mention de l'ancienne forme dans le glossaire), quand on y cherche `CA-\d` ou « CA couverts », alors on ne trouve rien.
- CA-7 : `npm test` vert, sans qu'aucune ligne d'un fichier de test existant ait changé ; `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent ; `npm run build` dans `site/` passe.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

Revert de la PR. Les specs écrites entre-temps en `AC-n` ne seraient plus reconnues par l'ancienne version : à remettre en `CA-n` à la main (aucune n'existe aujourd'hui).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
