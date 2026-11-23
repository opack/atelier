---
id: FIX-18
type: FIX
title: next-id ne compte plus les CA-n des commits
status: signed
tdd: yes
created_at: 2026-11-22
source: constat sur ce dépôt (EPIC-14 attribué après FEAT-7) ; hors périmètre d'EPIC-17, spec §« Hors périmètre »
signed_by: Didier
signed_at: 2026-11-23
tests_commit: 2aee2d3
slice: 1
reviewed_commit: f791c96874769b5ef17f594961daa077e220a7b8
---

# FIX-18 next-id ne compte plus les CA-n des commits

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : après FEAT-7, `atelier next-id EPIC` a renvoyé `EPIC-14` au lieu de `EPIC-8`. Le compteur a pris `CA-13`, cité dans un sujet de commit, pour un identifiant de chantier.
- Attendu : le compteur ne suit que des identifiants de chantier : noms de dossier de `chantiersDir`, identifiants en tête de segment des noms de branche, et identifiants entre crochets dans les sujets de commit (convention `<prefix>(<scope>): [<ID>] <description>`, titres de PR squashées `[<ID>] <titre>`).
- Impact : tout projet qui utilise atelier. Chaque token `XX-n` d'un sujet de commit (`CA-n`, `UTF-8`, `ISO-8601`, `RFC-7231`, etc.) ou d'un nom de branche de bot (`renovate/node-20.x`) peut faire sauter le compteur. Un trou dans la numérotation est sans gravité, mais il est définitif et le saut peut être grand (`ISO-8601` donne `FEAT-8602`).
- Source : historique de ce dépôt, commit `a834c53` (`test(plugin): [TEC-15] add failing tests for CA-3..CA-7, CA-13, CA-14, CA-16, CA-17`), visible via `git log --all`.

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit en local : oui.

1. Dans un dépôt git vierge avec atelier installé, créer `docs/chantiers/FEAT-7-x/` et un commit `test(plugin): [FEAT-7] add failing tests for CA-13`.
2. Lancer `atelier next-id EPIC`.
3. Obtenu : `EPIC-14`. Attendu : `EPIC-8`.

En pur : `nextChantierId('EPIC', ['FEAT-7-X', 'TEST(PLUGIN): [FEAT-7] ADD FAILING TESTS FOR CA-13'])` renvoie `EPIC-14`.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance : forte.

`collectUsedIdentifiers` (`lib/core.mjs:490`) mélange dans une seule liste les dossiers de `chantiersDir`, les sujets de `git log --all` et les noms de branche, tous passés en majuscules. `highestChantierNumber` (`lib/core.mjs:480`) applique ensuite à chaque entrée `/\b[A-Z]{2,6}-(\d+)\b/g`. Cette regex accepte volontairement les préfixes historiques (`FEA-26`, `BUG-421`), mais elle attrape aussi n'importe quel token `XX-n` de la prose d'un sujet de commit, ou d'un nom de branche créé par un bot (`renovate/node-20.x` donne `NODE-20`). La provenance de chaque nom est perdue avant l'extraction, si bien qu'on ne peut pas appliquer une règle plus stricte aux seuls commits.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Corriger la cause : une règle d'extraction selon la source, appliquée à la collecte. `highestChantierNumber(names)` et `nextChantierId(type, usedNames)` gardent leur signature et leur règle (`/\b[A-Z]{2,6}-(\d+)\b/g`) ; ils ne reçoivent plus que des noms déjà filtrés.

- **Sujets de commit** : nouvelle fonction pure `commitSubjectIdentifiers(subject)`, qui renvoie les identifiants trouvés par `/\[([A-Z]{2,6})-(\d+)\b/g` sur tout le sujet (insensible à la casse, `]` fermant non exigé, préfixes historiques compris). `[FEAT-7]`, `[BUG-421]` et `[TEC-15 CA-3]` donnent `FEAT-7`, `BUG-421`, `TEC-15` ; `CA-13`, `UTF-8` ou `ISO-8601` hors crochets ne donnent rien. Un `[CA-3]` placé entre crochets dans la prose compte : accepté (voir §6).
- **Noms de branche** : nouvelle fonction pure `branchNameIdentifiers(name)`, qui ne retient un identifiant que s'il ouvre un segment du nom (début du nom ou après `/`) et s'il est suivi de `-` ou de la fin du nom : `/(?:^|\/)([A-Z]{2,6})-(\d+)(?=-|$)/gi`. `fix/BUG-421-x`, `origin/fix/FIX-18-next-id-crochets` et `feature/JIRA-123` comptent ; `renovate/node-20.x` et `dependabot/npm_and_yarn/vite-5.4.12` non.
- **Dossiers de `chantiersDir`** : inchangés, passés tels quels.
- `collectUsedIdentifiers(projectRoot, config)` garde sa signature : il passe chaque sujet de commit dans `commitSubjectIdentifiers` et chaque nom de branche dans `branchNameIdentifiers`, et ne renvoie que les identifiants obtenus avec les noms de dossier.
- `BRACKETED_ID_PATTERN` (`lib/core.mjs:29`, détection du chantier actif) reste inchangée.
- Pas de liste d'exclusion (`CA`, `UTF`, `ISO`, etc.) : elle ne serait jamais complète.

Fichiers touchés :
- `plugins/atelier/lib/core.mjs` : `commitSubjectIdentifiers`, `branchNameIdentifiers` (exportées), `collectUsedIdentifiers`.
- `plugins/atelier/test/core.test.mjs` : tests du CA-1 au CA-4, étiquetés `[FIX-18 CA-n]` (format d'EPIC-17, CA-7), en pur sur les deux nouvelles fonctions et via la CLI sur un dépôt temporaire (`makeChantiersRepository`, `atelier(directory, 'next-id', 'FEAT')`). Les tests existants du compteur (`continues the shared counter, legacy prefixes included` et le CA-6 de FEAT-4) ne changent pas.
- `site/reference/commandes.md` : la ligne `atelier next-id` dit d'où vient le compteur (dossiers, identifiants en tête de segment des branches, identifiants entre crochets des commits).

Données déjà corrompues : aucune réparation. `CA-17` reste dans l'historique et égale aujourd'hui EPIC-17 ; les identifiants déjà attribués (EPIC-14 à FIX-18) sont valides. Les trous restent.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un dépôt avec un dossier `FEAT-7-x` et les sujets de commit `test(plugin): [FEAT-7] add failing tests for CA-13`, `fix: support UTF-8 and ISO-8601 dates` et `docs: follow RFC-7231`, quand on lance `atelier next-id EPIC`, alors on obtient `EPIC-8` (aujourd'hui : `EPIC-8602`). En pur, `commitSubjectIdentifiers` renvoie `['FEAT-7']` pour le premier sujet et `[]` pour les deux autres.
- [ ] CA-2 (garde de non-régression, passe déjà avant la correction) : Étant donné des sujets de commit `feat(envelopes): [FEA-26] add`, `[BUG-421] fix` et `test(plugin): [TEC-437 CA-3] cover`, quand on lance `atelier next-id FIX`, alors on obtient `FIX-438` : les identifiants entre crochets, préfixes historiques compris, continuent le compteur.
- [ ] CA-3 : Étant donné un dépôt avec une branche `fix/BUG-421-x` et un dossier `FEA-26-y` dans `chantiersDir`, et dont aucun sujet de commit ne porte d'identifiant entre crochets (le seul sujet est `docs: CA-900 checked`), quand on lance `atelier next-id FEAT`, alors on obtient `FEAT-422`.
- [ ] CA-4 : Étant donné un dépôt avec un dossier `FEAT-7-x` et des branches `renovate/node-20.x` et `dependabot/npm_and_yarn/vite-5.4.12`, quand on lance `atelier next-id FEAT`, alors on obtient `FEAT-8` (aujourd'hui : `FEAT-21`). En pur, `branchNameIdentifiers` renvoie `[]` pour ces deux noms et `['BUG-421']` pour `origin/fix/BUG-421-x`.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- **Hors périmètre, accepté (D1)** : un sujet de merge `Merge pull request #4 from opack/tec/TEC-5-commit-spec-draft` ne compte plus, car l'identifiant n'y est pas entre crochets. Ici, le dossier du chantier le couvre. Un dépôt ancien dont seuls ces merges portent l'identifiant perd ces numéros : risque de collision, accepté.
- **Accepté** : un `[CA-3]` écrit seul entre crochets dans un sujet de commit compte comme un identifiant. La convention place l'identifiant du chantier en premier crochet ; le cas est rare et ne produit qu'un trou.
- **Hors périmètre, laissé à EPIC-14 (D2)** : sur un dépôt client, des `[JIRA-4521]` ou des branches `feature/JIRA-123` font sauter le compteur. La parade est une liste blanche de préfixes (types de chantier + `legacyPrefixes` configurés) : elle touche la configuration, `/atelier:init` et le site, donc elle relève d'EPIC-14.
- **Calendrier (EPIC-17)** : ce FIX touche `lib/core.mjs` et `test/core.test.mjs`. Il doit être fusionné avant que REF-16 déplace les tests et avant l'ouverture du lot 2, qui interdit tout autre chantier sur `lib/`. Faute de quoi, il attend la fin du lot 2.
- Même schéma ailleurs : `RELATION_ID_PATTERN` (`lib/core.mjs:229`) accepte aussi tout `XX-n`, mais il valide une valeur écrite volontairement dans un champ `rel_*` : pas de faux positif possible, rien à changer.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-23 : tests rouverts (gel quitté : b396098) : OD2 : couvrir la casse, le crochet fermant non exigé et l'identifiant en fin de nom de branche
- 2026-11-23 : tests regelés : 2aee2d3
