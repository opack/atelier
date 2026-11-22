---
id: FIX-18
type: FIX
title: next-id ne compte plus les CA-n des commits
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-22
source: constat sur ce dépôt (EPIC-14 attribué après FEAT-7) ; hors périmètre d'EPIC-17, spec §« Hors périmètre »
signed_by:
signed_at:
---

# FIX-18 next-id ne compte plus les CA-n des commits

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : après FEAT-7, `atelier next-id EPIC` a renvoyé `EPIC-14` au lieu de `EPIC-8`. Le compteur a pris `CA-13`, cité dans un sujet de commit, pour un identifiant de chantier.
- Attendu : le compteur ne suit que des identifiants de chantier : noms de dossier de `chantiersDir`, noms de branche, et identifiants entre crochets dans les sujets de commit (convention `<prefix>(<scope>): [<ID>] <description>`, titres de PR squashées `[<ID>] <titre>`).
- Impact : tout projet qui utilise atelier. Chaque token `XX-n` d'un sujet de commit (`CA-n`, `V-12`, `UTF-8`, `ISO-8601`, `RFC-7231`, etc.) peut faire sauter le compteur. Un trou dans la numérotation est sans gravité, mais il est définitif et le saut peut être grand (`ISO-8601` donne `FEAT-8602`).
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

`collectUsedIdentifiers` (`lib/core.mjs:488`) mélange dans une seule liste les dossiers de `chantiersDir`, les sujets de `git log --all` et les noms de branche, tous passés en majuscules. `highestChantierNumber` (`lib/core.mjs:478`) applique ensuite à chaque entrée `/\b[A-Z]{2,6}-(\d+)\b/g`. Cette regex accepte volontairement les préfixes historiques (`FEA-26`, `BUG-421`), mais elle attrape aussi n'importe quel token `XX-n` de la prose d'un sujet de commit. La provenance de chaque nom est perdue avant l'extraction, si bien qu'on ne peut pas appliquer une règle plus stricte aux seuls commits.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Corriger la cause : une règle d'extraction selon la source.

- **Sujets de commit** : seuls les identifiants qui suivent immédiatement un `[` comptent (`[<PRÉFIXE>-<n>`, préfixe de 2 à 6 lettres, historiques compris). `[FEAT-7]`, `[BUG-421]` et `[TEC-15 CA-3]` comptent pour leur premier identifiant ; `CA-13`, `UTF-8` ou `ISO-8601` hors crochets ne comptent plus.
- **Noms de branche et dossiers de `chantiersDir`** : règle actuelle inchangée (token nu), parce que les préfixes historiques y apparaissent sans crochets.
- Pas de liste d'exclusion (`CA`, `UTF`, `ISO`, etc.) : elle ne serait jamais complète.

Fichiers touchés :
- `plugins/atelier/lib/core.mjs` : `collectUsedIdentifiers` garde la provenance de chaque nom (ou extrait les numéros par source), `highestChantierNumber` applique la règle de la source. La forme exacte (signature, structure renvoyée) se décide à l'implémentation, tant que les deux fonctions restent pures ou que l'accès à git reste confiné à la collecte.
- `plugins/atelier/test/core.test.mjs` : tests du CA-1 au CA-3, étiquetés `[FIX-18 CA-n]` (format d'EPIC-17, CA-7).
- `site/reference/commandes.md` : la ligne `atelier next-id` dit d'où vient le compteur (dossiers, branches, identifiants entre crochets des commits).

Données déjà corrompues : aucune réparation. `CA-17` reste dans l'historique et égale aujourd'hui EPIC-17 ; les identifiants déjà attribués (EPIC-14 à FIX-18) sont valides. Les trous restent.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un dossier `FEAT-7-x` et des sujets de commit `test(plugin): [FEAT-7] add failing tests for CA-13`, `fix: support UTF-8 and ISO-8601 dates` et `docs: V-12 checked`, quand on calcule `next-id EPIC`, alors on obtient `EPIC-8`.
- [ ] CA-2 : Étant donné des sujets de commit `feat(envelopes): [FEA-26] add`, `[BUG-421] fix` et `test(plugin): [TEC-437 CA-3] cover`, quand on calcule `next-id FIX`, alors on obtient `FIX-438` (les identifiants entre crochets, préfixes historiques compris, continuent le compteur).
- [ ] CA-3 : Étant donné un dépôt git dont la seule trace du chantier est une branche `fix/BUG-421-x` et un dossier `FEA-26-y` dans `chantiersDir`, et dont un sujet de commit contient `CA-900` hors crochets, quand on lance `atelier next-id FEAT`, alors on obtient `FEAT-422`.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- **Hors périmètre, accepté (D1)** : un sujet de merge `Merge pull request #4 from opack/tec/TEC-5-commit-spec-draft` ne compte plus, car l'identifiant n'y est pas entre crochets. Ici, le dossier du chantier le couvre. Un dépôt ancien dont seuls ces merges portent l'identifiant perd ces numéros : risque de collision, accepté.
- **Hors périmètre, laissé à EPIC-14 (D2)** : sur un dépôt client, des `[JIRA-4521]` ou des branches `feature/JIRA-123` font sauter le compteur. La parade est une liste blanche de préfixes (types de chantier + `legacyPrefixes` configurés) : elle touche la configuration, `/atelier:init` et le site, donc elle relève d'EPIC-14.
- **Calendrier (EPIC-17)** : ce FIX touche `lib/core.mjs` et `test/core.test.mjs`. Il doit être fusionné avant que REF-16 déplace les tests et avant l'ouverture du lot 2, qui interdit tout autre chantier sur `lib/`. Faute de quoi, il attend la fin du lot 2.
- Même schéma ailleurs : `RELATION_ID_PATTERN` (`lib/core.mjs:229`) accepte aussi tout `XX-n`, mais il valide une valeur écrite volontairement dans un champ `rel_*` : pas de faux positif possible, rien à changer.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
