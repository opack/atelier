# Bilan : FIX-28 Le code fusionné depuis main compte comme code du chantier

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
Le code qu'une fusion de la branche par défaut apporte dans la branche d'un chantier ne compte plus comme code du chantier : une fusion de `main` sans résolution propre ne rend plus la revue obsolète, ne remplit pas une tranche (« tranche vide » de `set-reviewed`) et ne fait plus annoncer la revue comme prochaine étape. Seule compte la résolution de la fusion (conflit résolu, retouche). Un seul calcul partagé, avec repli sur l'ancien (git < 2.36, branche par défaut inconnue ou contenant déjà des commits du chantier). Essai réel sur ce chantier : la fusion de `main` (FIX-25) après la revue l'a laissée à jour.

**Cause réelle** : confirmée. `reviewFacts` listait les fichiers par `--diff-merges=first-parent` (le commit de fusion porte tout le diff de `main`), et `sliceCodeFiles` par `<début>..HEAD` sans exclure `main`. Le premier était un choix assumé de TEC-3, révisé ici avec l'accord de Didier.

**Autres endroits où le schéma existe** : `branchCommitSubjects` (chantier déduit des commits) compte aussi les commits apportés par une branche d'intégration, mais n'inspecte que les sujets ; limite déjà documentée (« Référence distante périmée »), hors périmètre (OD4).

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/merged-code.test.mjs`.

| Critère | Statut | Test |
|---|---|---|
| CA-1 : fusion sans conflit → revue à jour | Livré | `une fusion sans conflit de la branche par défaut ne rend pas la revue obsolète` |
| CA-2 : conflit résolu → obsolète, seuls les fichiers résolus | Livré | `un conflit résolu après la revue la rend obsolète…` |
| CA-3 : tranche dont le seul commit est une fusion → vide | Livré | `une tranche dont le seul commit est une fusion de la branche par défaut est vide` |
| CA-4 : TDD, fusion après le gel → « Implémenter » | Livré | `en TDD, une fusion de la branche par défaut après le gel…` |
| CA-5 : `main` local en avance sur `origin/main` | Livré | `les commits d’un main local en avance sur origin/main ne comptent pas` |
| CA-6 : version de git, repli sous 2.36 | Livré | `lit la version de git et ne prend le nouveau calcul qu’à partir de 2.36` |
| CA-7 : sans référence à exclure → calcul actuel | Livré | `sans référence à exclure, le calcul actuel s’applique sans erreur` |
| CA-8 : branche fusionnée dans main puis reprise | Livré | `une branche fusionnée dans main puis reprise garde le code commité après la revue` |
| CA-9 : retouche sans conflit dans la fusion | Livré | `une retouche sans conflit dans le commit de fusion rend la revue obsolète…` |

Écarts : la spec a été amendée une fois (OD2, OD3 : règle d'exclusion sur le plus ancien commit du chantier, CA-8 et CA-9), tests rouverts puis regelés (`016d13e`).

## 3. Choix techniques
- `git log --diff-merges=remerge <début>..HEAD ^<réfs de main>` : commits propres du chantier, et d'une fusion seulement sa résolution.
- Réfs exclues : distante et locale, seulement si elles ne contiennent pas le plus ancien commit de la chaîne des premiers parents de HEAD après le début (SB1, OD2).
- Repli : commande d'origine de chaque appelant (`first-parent` pour la revue, sans option pour la tranche).
- Version de git lue une fois par processus.

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` : `parseGitVersion`, `codeLogArguments` (choix des arguments, pur et testé), `defaultBranchName` exporté.
- `plugins/atelier/lib/cli.mjs` : `codeFilesSince` (le calcul partagé), `defaultBranchRefsToExclude` (règle d'exclusion), `gitVersion`, `isAncestor` ; appelés par `reviewFacts` et `sliceCodeFiles`.
- Site : `site/cycle/revue.md`, `site/reference/limites.md`.

## 5. Pistes écartées
- `--first-parent` seul : le commit de fusion porte tout le diff de `main`.
- `--first-parent` sans `^main` : cacherait les commits du chantier apportés par un `git pull` de la même branche poussée ailleurs.
- Exclusion décidée par le nom de la branche courante, ou par « HEAD ancêtre de main » : ne couvre pas une branche fusionnée puis reprise (OD2).
- Garde-fou sur les sujets `[<ID>]` pour RD2 : nouveau cycle pour un cas déjà interdit par le process.

## 6. Dette et suites
- RD2 (limite assumée) : code commité après la revue depuis un autre poste, PR fusionnée avant la clôture, puis `git pull` : ce code peut échapper à la revue obsolète. Documenté dans `limites.md`.
- Fusion de `main` en avance rapide (branche sans commit propre depuis le début) : repli sur l'ancien calcul, le code de `main` compte.
- Constaté sur ce chantier (conséquence de SD1 de FIX-26) : après le regel des tests, l'implémentation commitée avant ne compte plus, et `status` renvoyait à `/atelier:build` alors qu'elle était faite.

## 7. Verdict de revue
Une revue, chantier à tranche unique (base `94423a3`, commit revu `016d13e` puis documentation `6eb1094` et `28e4296`, revue enregistrée au commit `9075ff4`) : aucun bloquant.

| Point | Traitement |
|---|---|
| RD1. plan.md n'a pas suivi l'amendement OD2 / CA-8 / CA-9 | corrigé (6eb1094) |
| RD2. Un commit du chantier arrivé par un second parent peut être caché par `^main` | exception acceptée (Didier : cas exigeant une PR fusionnée avant la clôture, déjà exclu par le process ; limite documentée, 28e4296) |

Exceptions acceptées : RD2.

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-24
