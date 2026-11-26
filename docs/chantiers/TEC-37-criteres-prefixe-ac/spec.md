---
id: TEC-37
type: TEC
title: Préfixe AC pour les critères d'acceptation
status: draft
tdd: yes
created_at: 2026-11-26
signed_by:
signed_at:
rel_depends_on: REF-34, FEAT-35
---

# TEC-37 Préfixe AC pour les critères d'acceptation

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

Les critères d'acceptation s'écrivent `AC-1`, `AC-2`… (Acceptance Criterion) au lieu de `CA-1`, et les vérifications `V-n` d'anciens chantiers TEC disparaissent au profit des mêmes `AC-n`. Le code ne lit plus que `AC-n` ; ce dépôt, seul utilisateur d'atelier à ce jour, est migré dans le même chantier. Le site gagne une page qui recense la nomenclature de tous les identifiants.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

Les identifiants d'atelier suivent une règle : une lettre par information, en initiale anglaise, puis un chiffre qui dit lequel (`SB`/`SD` Spec + Blocking / to Discuss, `RB`/`RD` Review, `OB`/`OD` Overfit, `F` Follow-up à venir). `CA` est la seule exception, tirée du français. Les codes sont neutres et ne se traduisent pas (seuls leurs libellés passeront par le vocabulaire de REF-34) : avec EPIC-14, un projet en anglais écrirait sinon `CA-1` dans ses specs.

Sans double lecture : aucune commande ne relit les critères d'un chantier clos (seule la spec du chantier actif est analysée : `check-spec`, `check-plan`, couverture des tranches), et livré avant EPIC-14, ce chantier garantit que la forme `CA` n'existera jamais hors de ce dépôt. Un repli permanent serait du code sans appelant.

Décisions de Didier du 2026-11-26 (fil « Ne plus oublier les suites des chantiers »).

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- **Un module pur `lib/criteria.mjs`**, testé, seule source du préfixe : identifiant de critère, critère en tête d'élément de liste, segment de couverture d'une tranche, étiquette finale d'un nom de test. `lib/slices.mjs`, `lib/spec.mjs` et `test/architecture.test.mjs` l'importent (SB2).
- **Lecture de `AC-n` seulement** : critères d'une spec (`specCriteria`), section obligatoire de critères (`checkSpec`, FEAT et FIX comme aujourd'hui), segment `AC couverts :` d'une tranche du plan, étiquette finale `[<ID> AC-n]` ou `[<ID> AC-n, AC-m]` des tests. Les lectures dans la spec et le plan ignorent la casse (`ac-2` est lu `AC-2`) ; l'étiquette d'un nom de test reste en majuscules (SD3).
- **Écriture en `AC-n`** : templates `spec-feat.md`, `spec-fix.md`, `spec-tec.md` (section Vérification), `spec-ref.md` (section Critère de fin), `spec-epic.md`, `plan.md`, `plan-epic.md` ; tous les skills et agents, y compris les mentions sans numéro (« les AC couverts », « AC globaux ») ; messages de `lib/` (« sans AC couvert », « AC globaux », « aucun critère numéroté (AC-1, AC-2…) ») ; `CLAUDE.md` et `README.md` ; site.
- **Migration de ce dépôt** :
  - tests (`plugins/atelier/test/`) : étiquettes `[… CA-n]` et `[… V-n]` renommées `[… AC-n]` de même numéro, et `CA-n` des specs et plans d'exemple renommés `AC-n`, mécaniquement, sans autre changement de nom ni de corps ; s'y ajoutent les expressions de `architecture.test.mjs` (remplacées par l'import de `lib/criteria.mjs`) et de `spec-ellipsis.test.mjs` qui cherchent `CA-1 :` dans les templates. Ces modifications de fichiers de test existants sont attendues et faites à l'étape tests (SB1) ;
  - specs des chantiers encore ouverts à la fusion, EPIC-14 et EPIC-17 : `CA-n` → `AC-n` de même numéro, avec une entrée datée dans leurs « Amendements » ;
  - `decisions.md` d'EPIC-17 : la partie templates de son CA-6 est livrée ici, et la forme devient `AC-n` (SD7).
- **Page de nomenclature** : `site/reference/nomenclature.md`, dans la barre latérale Référence. Elle pose la règle (une lettre par information, en initiale anglaise ; un chiffre dit lequel ; les codes ne se traduisent pas, leurs libellés si) puis un tableau, une ligne par identifiant : chantier `TYPE-n`, critère `AC-n`, points de relecture `SB`/`SD`, `OB`/`OD`, `RB`/`RD`, tranche « Tranche N », revue « Revue N ». Pour chacun : ce qu'il désigne, le fichier où il vit, la façon de le citer depuis un autre fichier. Une note donne les anciennes formes `CA-n` et `V-n`, que l'on trouve dans les documents des chantiers clos. Le glossaire renomme son entrée « AC (critère d'acceptation) » et y renvoie, ainsi que son entrée « Point de relecture » (SD5).
- Version mineure du plugin.

Hors périmètre :
- Les specs, plans, bilans, revues et `decisions.md` des chantiers clos, et l'historique des commits : archives, jamais relues par le code.
- Exiger des critères numérotés dans les sections Vérification (TEC) et Critère de fin (REF) dans `check-spec` : CA-6 d'EPIC-17 (lot 3), qui le fera en `AC-n`.
- La ligne `F` (suites) du tableau : elle viendra avec le chantier des suites.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

- Ordre : REF-34 et FEAT-35, en cours avec des tests figés en `CA`, fusionnent avant TEC-37. Un chantier encore ouvert sur une autre branche au moment de la fusion devra, en fusionnant `main`, amender sa spec et rouvrir ses tests pour les renommer.
- Les sessions sur ce dépôt utilisent le plugin de `main` : les skills n'écrivent `AC-n` qu'une fois TEC-37 fusionné et le plugin mis à jour.
- Amorçage : ce chantier rédige ses propres critères en `AC-n`. Avant l'implémentation, le plugin installé ne les lit pas : la couverture des tranches du plan se vérifie à la main, ou avec la CLI de la branche une fois la tranche de code livrée ; écart consigné dans `decisions.md`.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- AC-1 : Étant donné une spec dont les critères sont `- [ ] AC-1 : …`, `- AC-2 : …` et `- ac-3 : …`, quand on en extrait les critères, alors on obtient `AC-1`, `AC-2` et `AC-3` ; étant donné une spec dont les critères sont `- [ ] CA-1 : …` et `- V-2 : …`, alors on n'obtient aucun critère.
- AC-2 : Étant donné une spec FEAT dont la section « Critères d'acceptation » contient `- [ ] AC-1 : …`, quand on lance `check-spec`, alors aucun « aucun critère numéroté » n'est signalé ; si elle ne contient que `- [ ] CA-1 : …`, alors le problème est signalé et son message cite `AC-1, AC-2…`.
- AC-3 : Étant donné une tranche de plan `… — AC couverts : AC-1, AC-2 — TDD : oui`, quand on lit le plan, alors la tranche couvre `AC-1` et `AC-2` ; étant donné `… — CA couverts : CA-1 — TDD : oui`, alors elle ne couvre rien et `check-plan` signale une tranche « TDD : oui » sans AC couvert.
- AC-4 : Étant donné des noms de tests, quand la règle d'étiquette du test d'architecture s'applique, alors `… [FEAT-40 AC-3]` et `… [FEAT-40 AC-3, AC-4]` sont acceptés, et `… [FEAT-4 CA-3]`, `… [TEC-5 V-1]` et un `AC-3` cité hors de l'étiquette finale sont refusés.
- AC-5 : Étant donné le dépôt migré, quand on cherche `CA-\d` ou `V-\d` dans `plugins/atelier/test/` et dans les specs d'EPIC-14 et d'EPIC-17, alors on ne trouve rien, ces deux specs portent une entrée d'amendement datée qui le dit, et le test d'architecture passe sur le dépôt.
- AC-6 : Étant donné `plugins/atelier/` (templates, skills, agents, `lib/`), `CLAUDE.md`, `README.md` et `site/` hors de `site/reference/nomenclature.md` et `site/reference/glossaire.md`, quand on y cherche `\bCA\b`, `CA-\d` ou `\bV-\d`, alors on ne trouve rien (SD4).
- AC-7 : Étant donné le site, quand `docs.test.mjs` s'applique, alors `site/reference/nomenclature.md` existe, figure dans la barre latérale Référence, contient une ligne pour chacun de `TYPE-n`, `AC-n`, `SB`, `SD`, `OB`, `OD`, `RB`, `RD`, « Tranche N », « Revue N », mentionne les anciennes formes `CA-n` et `V-n`, et les entrées « AC (critère d'acceptation) » et « Point de relecture » du glossaire y renvoient (SD6).
- AC-8 : `npm test` est vert ; `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent ; `npm run build` dans `site/` passe ; la version de `plugins/atelier/.claude-plugin/plugin.json` monte d'un cran mineur (SD9).

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

Revert de la PR : code, tests et specs migrées reviennent ensemble à `CA-n`. Une spec ouverte entre-temps en `AC-n` serait à repasser en `CA-n` à la main.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
