---
id: TEC-33
type: TEC
title: Retirer le support de git avant 2.36
status: signed
tdd: no
created_at: 2026-11-25
signed_by: Opack
signed_at: 2026-11-25
rel_origin: FIX-28
reviewed_commit: 5ecfe4ddb6b8761b0a764bbb2777b5941837b4fe
slice: 1
---

# TEC-33 Retirer le support de git avant 2.36

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

Supprimer le repli que FIX-28 a prévu pour un git antérieur à 2.36 : le calcul du code du chantier (`codeLogArguments`) ne dépend plus de la version de git, et `git --version` n'est plus lu. Aucune vérification de version ne le remplace.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

git 2.36 date d'avril 2022 : un git plus ancien n'est pas une cible d'atelier (décision de Didier, 2026-11-25). Le repli coûte du code, un test, une section du site, et revient en bruit à chaque relecture (FIX-28, FIX-31, FIX-32). Sans rien faire, ce bruit continue et chaque nouvel appelant de `codeFilesSince` hérite d'un cas que personne n'utilise.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- `plugins/atelier/lib/common.mjs` : supprimer `parseGitVersion` et `supportsRemergeDiff` ; `codeLogArguments` perd le paramètre `gitVersion` et ne garde que deux branches : nouveau calcul si au moins une référence à exclure, sinon commande de l'appelant (`fallbackDiffMerges`) ; son commentaire ne parle plus de git ancien ni de version inconnue (SD6).
- `plugins/atelier/lib/cli/common.mjs` : supprimer `gitVersion` et son cache.
- `plugins/atelier/lib/cli/slices.mjs` : `codeFilesSince` n'appelle plus `gitVersion` ; son commentaire renvoie à `codeLogArguments` dans `lib/common.mjs` (et non `lib/core.mjs`) et ne garde que le cas « sans référence à exclure » (SD5).
- `plugins/atelier/lib/core.mjs` : retirer le réexport de `parseGitVersion`. Exception assumée au contrat de la façade (« réexporte, inchangés, les noms de core.mjs ») : seul le test CA-6, supprimé, l'importait, et aucune branche distante ouverte avant REF-29 ne l'utilise (vérifié le 2026-11-25) (SD1).
- `plugins/atelier/test/merged-code.test.mjs` : supprimer le test FIX-28 CA-6 (lecture de version, repli sous 2.36) ; adapter les appels de `codeLogArguments` du test CA-7, et y ajouter une assertion `deepEqual` sur le nouveau calcul (`excludedRefs: ['origin/main', 'main']` → `--diff-merges=remerge`, `^origin/main`, `^main`), seule assertion unitaire que CA-6 portait (SD2).
- Site : `site/reference/limites.md`, section « La version de git » conservée : elle explique pourquoi atelier demande git 2.36 ou plus (`git log --diff-merges=remerge`, qui ne garde d'une fusion de la branche par défaut que sa résolution), sans plus décrire de comportement pour un git plus ancien ; le repli sans référence de la branche par défaut y reste décrit, sans la mention « git 2.31 ». `site/cycle/revue.md` : le lien « git 2.36 ou plus » vers cette section reste. Prérequis : « git 2.36 ou plus récent », avec un lien vers cette section, dans `site/guide/demarrage-rapide.md` et `site/projet/installation.md` (SD4).

Hors périmètre :
- Le repli sans référence de la branche par défaut, ou quand elle contient déjà des commits du chantier (FIX-28 CA-7, CA-8) : il reste, avec `fallbackDiffMerges`.
- Les documents des chantiers clos (`docs/chantiers/FIX-28…`, `FIX-31…`) : historiques, inchangés.
- Toute vérification de la version de git à l'exécution.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

Avec git ≥ 2.36 : aucun changement. Avec un git plus ancien, `git log --diff-merges=remerge` échoue au lieu de revenir à l'ancien calcul : non supporté, assumé. Un appel de moins à `git --version` par commande.

FIX-32 (en cours) appelle `codeFilesSince` sans toucher à la version de git.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- `npm test` vert : tous les tests de FIX-28 sauf CA-6 passent, inchangés sur le fond (SD3).
- `git grep -n "parseGitVersion\|gitVersion\|supportsRemergeDiff\|2\.36" -- plugins` ne renvoie rien ; sur le site, « 2.36 » n'apparaît plus que comme version requise (section « La version de git » et le lien de `revue.md`), jamais avec un comportement de repli. Après fusion de `main` contenant FIX-32, ce `git grep` reste vide côté `plugins` (SD7).
- `npm run build` dans `site/` sans lien mort.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

`git revert` du commit de fusion de la PR.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
