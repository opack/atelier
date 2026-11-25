---
id: TEC-33
type: TEC
title: Retirer le support de git avant 2.36
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-25
signed_by:
signed_at:
rel_origin: FIX-28
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

- `plugins/atelier/lib/common.mjs` : supprimer `parseGitVersion` et `supportsRemergeDiff` ; `codeLogArguments` perd le paramètre `gitVersion` et ne garde que deux branches : nouveau calcul si au moins une référence à exclure, sinon commande de l'appelant (`fallbackDiffMerges`).
- `plugins/atelier/lib/cli/common.mjs` : supprimer `gitVersion` et son cache.
- `plugins/atelier/lib/cli/slices.mjs` : `codeFilesSince` n'appelle plus `gitVersion` ; commentaires mis à jour.
- `plugins/atelier/lib/core.mjs` : retirer le réexport de `parseGitVersion` (aucun appelant hors des fichiers ci-dessus).
- `plugins/atelier/test/merged-code.test.mjs` : supprimer le test FIX-28 CA-6 (lecture de version, repli sous 2.36) ; adapter les appels de `codeLogArguments` du test CA-7.
- Site : `site/reference/limites.md`, section « La version de git » renommée (le code apporté par la branche par défaut) sans mention de version ; `site/cycle/revue.md` : lien et mention « git 2.36 ou plus » retirés.

Hors périmètre :
- Le repli sans référence de la branche par défaut, ou quand elle contient déjà des commits du chantier (FIX-28 CA-7, CA-8) : il reste, avec `fallbackDiffMerges`.
- Les documents des chantiers clos (`docs/chantiers/FIX-28…`, `FIX-31…`) : historiques, inchangés.
- Toute vérification ou documentation d'une version minimale de git.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

Avec git ≥ 2.36 : aucun changement. Avec un git plus ancien, `git log --diff-merges=remerge` échoue au lieu de revenir à l'ancien calcul : non supporté, assumé. Un appel de moins à `git --version` par commande.

FIX-32 (en cours) appelle `codeFilesSince` sans toucher à la version de git : ce chantier fusionne `main` après la fusion de FIX-32 pour vérifier qu'aucun nouvel appelant ne dépend de `gitVersion`.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- `npm test` vert, sans le test CA-6 de FIX-28 ; les tests CA-1 à CA-5, CA-7, CA-8 de FIX-28 passent inchangés sur le fond.
- `git grep -n "parseGitVersion\|gitVersion\|supportsRemergeDiff\|2\.36" -- plugins site` ne renvoie rien.
- `npm run build` dans `site/` sans lien mort (l'ancre `la-version-de-git` n'est plus citée).

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

`git revert` du commit de fusion de la PR.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
