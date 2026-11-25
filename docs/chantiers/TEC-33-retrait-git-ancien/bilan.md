# Bilan : TEC-33 Retirer le support de git avant 2.36

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
atelier ne lit plus la version de git : le calcul du code du chantier (`codeLogArguments`) prend toujours `git log --diff-merges=remerge` dès qu'une référence de la branche par défaut est à exclure. Le repli pour git < 2.36 introduit par FIX-28, son test (FIX-28 CA-6) et sa description sur le site disparaissent. git 2.36 devient un prérequis documenté (Démarrage rapide, Installation, section « La version de git » des limites).

## 2. Livré vs spécifié
Chantier TEC sans critères d'acceptation : la spec fixe une vérification (§5).

| Critère | Statut | Test |
|---|---|---|
| `npm test` vert, tous les tests FIX-28 sauf CA-6 inchangés sur le fond | Livré | 383 tests verts après fusion de `main` ; `merged-code.test.mjs` |
| Couverture unitaire du nouveau calcul conservée (SD2) | Livré | `sans référence à exclure, le calcul actuel s’applique sans erreur [FIX-28 CA-7]` : trois `deepEqual` sur `codeLogArguments` |
| `git grep "parseGitVersion\|gitVersion\|supportsRemergeDiff\|2\.36" -- plugins` vide, y compris après fusion de FIX-32 (SD7) | Livré | vérifié sur 5ecfe4d |
| Site : 2.36 seulement comme version requise, sans repli ; build sans lien mort | Livré | `npm run build` dans `site/` |

Aucun écart à la spec, aucun amendement.

## 3. Choix techniques
- `fallbackDiffMerges` reste : il sert au repli sans référence de la branche par défaut (FIX-28 CA-7, CA-8), sans rapport avec la version de git.
- Aucune vérification de version à l'exécution : avec un git plus ancien, `git log --diff-merges=remerge` échoue, cas non supporté.
- `lib/core.mjs` perd le réexport de `parseGitVersion` : exception assumée au contrat de la façade, aucune branche ouverte avant REF-29 ne l'utilise (SD1).

## 4. Éléments de code principaux
- `plugins/atelier/lib/common.mjs` : `codeLogArguments({ from, excludedRefs, fallbackDiffMerges })`, deux branches.
- `plugins/atelier/lib/cli/slices.mjs` : `codeFilesSince`, seul appelant.
- `site/reference/limites.md`, « La version de git » : pourquoi 2.36 est requis.

## 5. Pistes écartées
- Supprimer la section « La version de git » du site : écarté par Didier, la version requise doit rester expliquée.
- Retirer `fallbackDiffMerges` : il sert encore au repli sans référence.

## 6. Dette et suites
Aucune.

## 7. Verdict de revue
Revue unique (chantier à tranche unique) du 2026-11-25, commit revu 0bb0ff3 puis fusion de `main` en 5ecfe4d : aucun point. Relecture de spec : SD1 à SD7 intégrés avant signature.

| Point | Traitement |
|---|---|
| Aucun | |

- Verdict :
- Validé par :
- Date :
