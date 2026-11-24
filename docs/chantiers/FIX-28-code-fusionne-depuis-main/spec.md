---
id: FIX-28
type: FIX
title: Le code fusionné depuis main compte comme code du chantier
status: signed
tdd: yes
created_at: 2026-11-23
source: bilan FIX-26 §6 (OD1), constaté sur REF-16 et FIX-26
rel_origin: FIX-26
rel_depends_on: FIX-26
signed_by: Opack
signed_at: 2026-11-24
tests_commit: 016d13e
slice: 1
---

# FIX-28 Le code fusionné depuis main compte comme code du chantier

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : une fusion de la branche par défaut dans la branche d'un chantier fait compter le code de la branche par défaut comme code du chantier, à trois endroits :
  1. **Revue obsolète** : après une fusion de `main` postérieure à la revue, `status` déclare la revue obsolète dès que `main` a apporté un fichier de code, même sans conflit, et `close-check` refuse la clôture.
  2. **« Tranche vide »** de `atelier set-reviewed` : une tranche dont le seul commit est une fusion de `main` n'est pas vue comme vide.
  3. **Prochaine étape** (FIX-26) : en TDD, une fusion de `main` après le gel des tests fait annoncer la revue alors que rien n'est implémenté.
- Attendu : seul le code écrit pour le chantier compte : ses propres commits et, pour un commit de fusion, la **résolution** de la fusion (ce qui diffère de la fusion automatique, conflits compris). Le code que la branche par défaut apporte tel quel ne compte pas.
- Impact : tout chantier qui fusionne `main` en cours de route (cas courant dès que plusieurs chantiers avancent en parallèle). Revue à refaire pour rien, clôture bloquée, prochaine étape fausse. Gravité moyenne : coût en temps et en jetons, et règle qui pousse à ne pas fusionner `main` (donc à découvrir les conflits plus tard).
- Source : bilan de FIX-26, §6 (OD1) ; constaté sur REF-16 (fusion de `main` en cours de chantier).

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit : oui, sur un dépôt jetable (git 2.43).

1. Branche `fix/X` partie de `main` : un commit de code `feat.mjs`, revue enregistrée sur ce commit (`R`).
2. Sur `main` : un commit qui modifie `main.mjs`.
3. Sur `fix/X` : `git merge main`, sans conflit.
4. `git log --name-only --format= --diff-merges=first-parent R..HEAD` (calcul actuel de la revue) liste `main.mjs` : la revue est déclarée obsolète.
5. `git log --name-only --format= --diff-merges=remerge R..HEAD ^main` ne liste rien. Avec un conflit sur `shared.txt` résolu à la main, il ne liste que `shared.txt`.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance : forte.

- Revue : `reviewFacts` (`plugins/atelier/lib/cli.mjs`, vers la ligne 519) liste les fichiers par `git log --diff-merges=first-parent <reviewed_commit>..HEAD`. Avec `first-parent`, le commit de fusion porte tout le diff de la branche par défaut depuis la base de fusion. C'était un choix assumé de TEC-3 (`decisions.md` : « une fusion de la branche par défaut après la revue impose une nouvelle revue »), repris par le site (`site/cycle/revue.md`, « Une revue qui devient obsolète »). Ce FIX revient sur ce choix (voir §6).
- Tranche : `sliceCodeFiles` (`cli.mjs`, vers la ligne 702) liste par `git log <début>..HEAD` sans exclure la branche par défaut : les commits de `main` atteignables par la fusion sont listés un à un. Ce calcul sert `set-reviewed` (« tranche vide ») et, avec FIX-26, la prochaine étape (`codeCommittedFact`).
- `--first-parent` seul ne suffit pas : le commit de fusion porterait alors tout le diff de `main`. Il faut à la fois exclure les commits de la branche par défaut (`^<branche par défaut>`) et ne garder d'un commit de fusion que sa résolution (`--diff-merges=remerge`, git 2.36 ou plus).

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Correction de la cause : un seul calcul, partagé, des fichiers de code apportés par le chantier depuis un commit donné.

**Calcul** : `git log --name-only -z --no-renames --diff-merges=remerge --format= <début>..HEAD ^<réf> …`, où les `<réf>` sont les références de la branche par défaut qui existent : la référence distante trouvée par `defaultBaseRef` (`origin/HEAD`, `origin/main`…) **et** la branche locale du même nom (`main`). Exclure aussi la branche locale couvre le cas d'un `origin/main` en retard sur un `main` local fusionné dans la branche.

**Repli sur le calcul actuel, sans erreur** (commande inchangée pour chaque appelant) quand :
- la version de git est inférieure à 2.36 ou illisible (`git --version`) ;
- aucune référence de la branche par défaut n'est connue ;

**Références exclues, par les commits et non par les noms** (SB1) : une référence n'est exclue que si elle ne contient aucun commit du chantier depuis le début : le plus ancien commit de la chaîne des premiers parents de HEAD après `<début>` n'en est pas un ancêtre (OD2 ; l'ascendance est monotone le long de cette chaîne). Cela couvre la branche courante qui est la branche par défaut, une HEAD détachée, et une branche de chantier déjà fusionnée dans `main` (PR fusionnée puis travail repris) : sans cette règle, `<début>..HEAD ^main` serait vide et du code commité après la revue passerait inaperçu ; avec un commit de plus après la fusion, `^main` cacherait encore ce code. Si aucune référence ne reste à exclure, c'est le repli.

**Répartition** :
- `lib/core.mjs` : fonctions pures testées, lecture de la version de git (`2.36.0`, `2.39.3 (Apple Git-146)`, `2.45.1.windows.1`) et construction des arguments de `git log` à partir de la version, du début, des références à exclure et du calcul de repli.
- `lib/cli.mjs` : une fonction qui exécute ce calcul, appelée par `reviewFacts` (revue obsolète), `sliceCodeFiles` (« tranche vide », et prochaine étape via `codeCommittedFact` de FIX-26). Version de git lue une fois par commande.

**Comportement résultant** :
- une fusion de `main` sans conflit ne rend plus la revue obsolète, ne remplit pas une tranche et ne fait pas annoncer la revue ;
- une fusion dont la résolution diffère de la fusion automatique (conflit résolu, retouche dans le commit de fusion) compte : les fichiers de la résolution sont du code du chantier ;
- les règles hors fusion sont inchangées (`.claude/**` compte pour la revue, tests compris, chemins libres exclus).

**Site** : `site/cycle/revue.md` (« Une revue qui devient obsolète » : la fusion de `main` ne compte que par sa résolution), `site/reference/limites.md` (git 2.36 pour ce calcul, repli en dessous ; le paragraphe « Référence distante périmée » à revoir), `site/reference/commandes.md` si la ligne `set-reviewed` le demande.

**Limites (SD3)** : `site/reference/limites.md` remplace « git 2.31 pour `first-parent` » par : git 2.36 ou plus pour ignorer le code apporté par la branche par défaut ; en dessous, une fusion de `main` compte comme avant (revue à refaire). Seule la branche par défaut est exclue : le code apporté par une autre branche d'intégration (`develop`, `upstream/main` d'un fork) compte toujours.

Pas de données à réparer : les `reviewed_commit` existants restent valides, le calcul est refait à chaque appel.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un chantier dont la revue est enregistrée (`reviewed_commit`), puis une fusion sans conflit de la branche par défaut qui apporte un fichier de code, quand on lance `atelier status --json`, alors `reviewState` est à jour (pas obsolète) et `close-check` ne signale pas de code commité depuis la revue.
- [ ] CA-2 : Étant donné la même situation, mais une fusion avec un conflit sur un fichier de code résolu à la main, quand on lance `atelier status --json`, alors la revue est obsolète et seuls les fichiers de la résolution sont cités, pas les autres fichiers apportés par la branche par défaut.
- [ ] CA-3 : Étant donné un chantier en tranches, tranche 2 en cours, dont le seul commit depuis `slice_base` est une fusion sans conflit de la branche par défaut apportant du code, quand on lance `atelier set-reviewed`, alors la commande refuse pour « tranche vide » ; avec en plus un commit de code du chantier, elle n'oppose pas ce refus.
- [ ] CA-4 : Étant donné un chantier TDD aux tests figés, dont le seul commit depuis `tests_commit` est une fusion sans conflit de la branche par défaut apportant du code, quand on lance `atelier status`, alors la prochaine étape est « Implémenter », pas la revue (dépend de FIX-26).
- [ ] CA-5 : Étant donné une branche qui a fusionné un `main` local en avance sur `origin/main` (commits de code non poussés), puis une revue enregistrée avant cette fusion, quand on lance `atelier status --json` et `atelier set-reviewed` (tranche en cours), alors les commits de ce `main` local ne comptent ni pour la revue (`reviewState` à jour) ni pour la tranche (« tranche vide » si rien d'autre).
- [ ] CA-6 : Étant donné une version de git inférieure à 2.36, ou une sortie de `git --version` illisible, quand on construit la commande, alors c'est la commande actuelle de chaque appelant (repli) ; à partir de 2.36 (formats `2.36.0`, `2.39.3 (Apple Git-146)`, `2.45.1.windows.1`), c'est le nouveau calcul.
- [ ] CA-7 : Étant donné un dépôt sans référence de la branche par défaut (ni `origin`, ni `main`, ni `master`), ou une HEAD ancêtre de toutes les références de la branche par défaut (branche courante = branche par défaut, ou branche de chantier déjà fusionnée dans `main`), quand un commit de code suit la revue et qu'on lance `atelier status --json`, alors la revue est obsolète (calcul actuel), sans erreur.
- [ ] CA-8 : Étant donné une revue enregistrée, puis un commit de code, puis la branche fusionnée dans la branche par défaut (`--no-ff`), puis un commit de documentation sur la branche, quand on lance `atelier status --json`, alors la revue est obsolète et cite le code commité après la revue.
- [ ] CA-9 : Étant donné une revue enregistrée, puis une fusion sans conflit de la branche par défaut dont le commit retouche un fichier de code (au-delà de la fusion automatique), quand on lance `atelier status --json`, alors la revue est obsolète et ne cite que le fichier retouché.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- **Retour sur un choix de TEC-3** : une fusion de `main` après la revue imposait une nouvelle revue. Argument pour l'ancien choix : le code du chantier côtoie du code de `main` qu'il n'a jamais vu. Réponse : ce code a été relu dans son propre chantier, et l'interaction est couverte par les contrôles, relancés sur le nouvel état du code à la clôture (`close-check`). Reste une revue à refaire toute fusion dont la résolution diffère de la fusion automatique sur un fichier de code (conflit résolu, y compris en gardant le côté `main`, ou retouche sans conflit) ; un conflit sur un fichier hors code ne compte pas (SD1). Décision validée par Didier le 2026-11-24, tracée dans `decisions.md` de FIX-28, avec un renvoi ajouté à l'entrée de TEC-3.
- Une résolution de conflit qui reprend tel quel le côté `main` apparaît quand même (la fusion automatique contenait des marqueurs) : accepté, c'est une décision du chantier.
- Première tranche sans `slice_base` (SD2) : la base reste la base de fusion avec la branche par défaut, et la liste passe par le nouveau calcul (exclusion de `main` local, résolutions de fusion). Hors périmètre : `branchCommitSubjects` (identifiant du chantier par ses commits), qui n'inspecte que les sujets.
- Dépend de FIX-26 (PR #18) pour CA-4 : à fusionner avant l'implémentation de ce FIX ; fusionner alors `main` dans cette branche.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-24 : exclusion décidée sur le plus ancien commit du chantier depuis le début, et non sur HEAD ; ajout de CA-8 (branche fusionnée dans main puis reprise) et CA-9 (retouche sans conflit dans un commit de fusion), suite à OD2 et OD3 de la vérification de surapprentissage.
- 2026-11-24 : tests rouverts (gel quitté : 99f4737) : OD2 et OD3 : ajout de CA-8 et CA-9
- 2026-11-24 : tests regelés : 016d13e
