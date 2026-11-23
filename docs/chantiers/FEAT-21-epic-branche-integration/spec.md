---
id: FEAT-21
type: FEAT
title: EPIC en branche d'intégration
status: draft
tdd: yes
created_at: 2026-11-23
signed_by:
signed_at:
---

# FEAT-21 EPIC en branche d'intégration

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

Modèle actuel (celui d'EPIC-17) : la branche de l'EPIC est courte. Sa spec et son plan sont fusionnés dans la branche par défaut (`plan` §5), puis chaque enfant part de la branche par défaut, est revu contre elle (`git merge-base HEAD <branche par défaut>`, `review` §2 et `sliceCodeFiles` dans `lib/cli.mjs`) et y est fusionné seul. L'EPIC se clôt ensuite sur une branche `epic/<ID>-<slug>` recréée pour l'occasion, sans revue (`isReviewExempt`).

Problème : certains EPIC ont des lots qui n'ont de sens qu'ensemble. Fusionner un enfant seul livre aux utilisateurs du plugin un état intermédiaire incohérent, voire cassé. Sans rien faire, on a le choix entre ce risque et un chantier unique trop gros pour être découpé, revu et testé par tranches.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

Un EPIC peut déclarer dans l'en-tête de sa spec `integration_branch: yes`. Sa branche `epic/<ID>-<slug>` devient alors la **branche d'intégration** de ses enfants, du début à la fin de l'EPIC :

- **Ouverture d'un enfant** (`/atelier:new`) : la branche de l'enfant part de la branche d'intégration à jour, pas de la branche par défaut.
- **Revue d'un enfant** (`/atelier:review`, tranche 1, revue du chantier ou tranche unique ; contrôle « tranche vide » de `set-reviewed`) : la base est `git merge-base HEAD <branche d'intégration>`.
- **Clôture d'un enfant** (`/atelier:close`) : la PR vise la branche d'intégration, fusionnée par un commit de fusion (ni squash, ni rebase). Les messages de `close-check` sur les dépendances parlent de la branche d'intégration.
- **Clôture de l'EPIC** : une **revue d'ensemble** de l'EPIC est obligatoire (base : la branche par défaut), puis une seule PR fusionne la branche d'intégration dans la branche par défaut.
- **La branche par défaut avance** : on la fusionne dans la branche d'intégration (`git merge`), jamais de rebase. Les enfants ouverts fusionnent ensuite la branche d'intégration dans leur propre branche s'ils en ont besoin.
- **Enfant qui dépend d'un chantier hors EPIC** : rien de nouveau. La dépendance est livrée dans la branche par défaut, qu'on fusionne dans la branche d'intégration, puis celle-ci dans l'enfant ; `close-check` exige comme aujourd'hui la dépendance `done` dans la branche de l'enfant.

**Règle de résolution de la base** (lue partout, calculée en un seul endroit) : la base d'un chantier est la branche d'intégration de l'EPIC ancêtre le plus proche (en remontant `rel_parent`) qui déclare `integration_branch: yes` ; à défaut, la branche par défaut. Un EPIC n'est pas son propre ancêtre : la base d'un EPIC à branche d'intégration est celle de son parent. Cette règle couvre les EPIC imbriqués sans cas particulier.

**Pourquoi merge et jamais rebase** : les enfants clos portent dans leur spec un `reviewed_commit`, et les enfants ouverts un `reviewed_commit`, un `slice_base` ou un `tests_commit`. Un rebase réécrit ces commits : les revues des enfants clos ne prouvent plus rien et celles des enfants ouverts deviennent introuvables. Un merge garde tous les hashes. Après une fusion de la branche d'intégration dans un enfant déjà revu, sa revue est périmée comme aujourd'hui après une fusion de la branche par défaut (fichiers de code dans `--diff-merges=first-parent`), et la nouvelle revue ne montre que le diff propre de l'enfant puisque sa base a avancé.

**Pourquoi une revue d'ensemble obligatoire** : chaque enfant a été revu seul, contre une base qui bougeait. Personne n'a relu l'assemblage, ni les résolutions de conflits faites en fusionnant la branche par défaut dans la branche d'intégration. La revue d'ensemble porte sur la cohérence entre lots, l'atteinte des CA globaux et ces résolutions ; elle ne refait pas la revue ligne à ligne de chaque enfant.

**Sans l'option** (champ absent ou `no`) : rien ne change, ni code, ni skills, ni messages.

Hors périmètre :
- Toute configuration au-delà du booléen (nom de branche libre, cible autre que la branche par défaut, stratégie de fusion choisie).
- Changer l'option d'un EPIC qui a déjà des enfants : la bascule en cours de route n'est pas outillée (voir §4).
- Le rebase automatique ou assisté d'une branche d'intégration, et la création ou la fusion des PR par le plugin.
- Les EPIC sans l'option : leur clôture reste sans revue.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- **Un seul calcul de la base** : une fonction pure dans `lib/core.mjs` (index des chantiers, identifiant) → `{ branch, epic }` ou la branche par défaut. `atelier status --json` l'expose (`baseBranch`, et l'EPIC qui l'impose) pour les skills ; `sliceCodeFiles` et `reviewFacts` l'utilisent côté CLI. Le nom de la branche d'intégration se déduit du dossier de l'EPIC (`epic/<ID>-<slug>`), sans configuration.
- **Référence git de la base** : la branche de suivi distante (`<remote>/epic/<ID>-<slug>`) si elle existe, sinon la branche locale ; aucune des deux → erreur explicite (« récupère ou pousse la branche d'intégration »), jamais un repli silencieux sur la branche par défaut, qui gonflerait la revue de tout le travail des autres enfants.
- **EPIC à branche d'intégration et revue** : aujourd'hui `isReviewExempt` exempte tout EPIC et `sliceState` le classe sans modèle de revue. Avec l'option, l'EPIC suit le modèle « tranche unique » pour sa clôture : `reviewed_commit` exigé, à jour, ancêtre de `HEAD`. Le reviewer reçoit la portée « revue d'ensemble de l'EPIC ».
- **Intégrité des revues des enfants** : `close-check` d'un EPIC à branche d'intégration vérifie que le `reviewed_commit` de chaque enfant `done` (hors enfants exemptés de revue) est ancêtre de `HEAD`. Un rebase de la branche d'intégration ou une fusion d'enfant par squash casse cette propriété : c'est ce qui la rend détectable de façon déterministe.
- **Détection du chantier par les commits** (`chantierIdFromBranchCommits`) : elle prend le commit `[<ID>]` le plus récent de `<branche par défaut>..HEAD`. Sur une branche imposée (`claude/…`) partie de la branche d'intégration, avant le premier commit de l'enfant, elle trouverait l'EPIC ou un enfant frère. Le commit immédiat du brouillon (`new` §3.6) ferme cette fenêtre ; à vérifier au plan, sans élargir le périmètre.
- **Commits de l'EPIC** : la règle « chaque commit porte `[<ID>]` » de `close` ne peut pas s'appliquer aux commits des enfants fusionnés dans la branche d'intégration. Pour l'EPIC, elle porte sur les commits du premier parent (`--first-parent`) : ses propres documents, les fusions d'enfants et les fusions de la branche par défaut, ces dernières écrites `[<EPIC-ID>] merge <branche par défaut>`.
- **Garde d'écriture** : sur la branche d'un EPIC, les écritures de code restent refusées. Une résolution de conflits lors de la fusion de la branche par défaut passe par le débrayage (`atelier bypass`) ; la revue d'ensemble la couvre.
- **Skills à modifier** : `new` (point de départ), `plan` (§5 : avec l'option, pousser la branche de l'EPIC au lieu de la fusionner dans la branche par défaut), `review` (base, portée « revue d'ensemble »), `close` (cible de PR, fusion sans squash, revue d'ensemble de l'EPIC, fusion de la branche par défaut), template `spec-epic.md` (champ commenté). Site : pages du cycle de vie et de l'EPIC, dans la même PR.
- **Conflit avec EPIC-17** : son lot 2 (`lib/` rangé par domaine) demande qu'aucun autre chantier ne touche `lib/` pendant qu'il tourne, et ce chantier touche `core.mjs` et `cli.mjs`. Ordre à fixer (§4).

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

Tranchées par Didier le 2026-11-23 (recommandations retenues) :

- Q1. Revue d'ensemble de l'EPIC obligatoire avec l'option : **oui** (§2, CA-8).
- Q2. Rebase interdit dans la branche d'intégration et fusion des enfants sans squash, vérifiés par `close-check` de l'EPIC : **oui**, refus sans autre échappatoire que rétablir l'historique (reflog, branche distante) (CA-9).
- Q3. Changer l'option après l'ouverture du premier enfant : **hors périmètre**, refusé par `check-spec` (CA-3).
- Q4. Ordre vis-à-vis d'EPIC-17 : **après son lot 2** (`lib/` rangé par domaine). `rel_depends_on` sera ajouté par `/atelier:amend` quand ce lot aura un identifiant ; pas d'implémentation avant.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné un chantier sans EPIC ancêtre, ou dont les EPIC ancêtres n'ont pas `integration_branch` ou l'ont à `no`, quand on calcule sa base, alors c'est la branche par défaut ; `status --json`, la base de la tranche 1, `close-check` et ses messages sont identiques à aujourd'hui, et la suite de tests existante passe sans modification.
- [ ] CA-2 : Étant donné une spec, quand `atelier check-spec` la vérifie, alors il signale `integration_branch` sur un chantier qui n'est pas un EPIC, et toute valeur autre que `yes` ou `no`.
- [ ] CA-3 : Étant donné un EPIC qui a au moins un enfant (sur n'importe quelle branche), quand sa spec change la valeur de `integration_branch` par rapport à sa version signée, alors `atelier check-spec` le signale et `close-check` de l'EPIC refuse.
- [ ] CA-4 : Étant donné un enfant direct d'un EPIC `EPIC-n` à `integration_branch: yes` dont le dossier est `EPIC-n-slug`, quand on calcule sa base, alors c'est `epic/EPIC-n-slug`, et `status --json` expose `baseBranch: "epic/EPIC-n-slug"` et l'EPIC qui l'impose.
- [ ] CA-5 : Étant donné des EPIC imbriqués, quand on calcule la base, alors : l'enfant d'un sous-EPIC sans l'option dont le parent a l'option a pour base la branche d'intégration du parent ; l'enfant d'un sous-EPIC à l'option a pour base celle du sous-EPIC ; un EPIC à l'option a pour base celle de son propre parent, ou la branche par défaut s'il n'en a pas.
- [ ] CA-6 : Étant donné une base qui est une branche d'intégration, quand sa référence git est résolue, alors la branche de suivi distante est préférée à la branche locale ; quand aucune des deux n'existe, la commande qui en a besoin s'arrête avec un message qui nomme la branche à récupérer ou pousser, sans se replier sur la branche par défaut.
- [ ] CA-7 : Étant donné un enfant parti de la branche d'intégration, dans laquelle un enfant frère a déjà été fusionné avec du code, quand `set-reviewed` contrôle la tranche 1, alors seuls les fichiers de code commités par l'enfant comptent ; une tranche 1 sans code propre est refusée comme vide.
- [ ] CA-8 : Étant donné un EPIC à `integration_branch: yes`, quand `close-check` tourne, alors une revue est exigée comme pour un chantier à tranche unique (`reviewed_commit` présent, ancêtre de `HEAD`, aucun commit de code ni amendement depuis) ; un EPIC sans l'option reste exempté de revue.
- [ ] CA-9 : Étant donné un EPIC à `integration_branch: yes` dont un enfant `done` et soumis à revue a un `reviewed_commit` absent de l'historique de `HEAD` (branche d'intégration rebasée, enfant fusionné par squash), quand `close-check` tourne, alors il refuse en nommant l'enfant et la cause probable ; un enfant `done` exempté de revue (SPIKE sans TDD) n'est pas vérifié.
- [ ] CA-10 : Étant donné un enfant d'un EPIC à `integration_branch: yes` dont une dépendance n'est pas fusionnée dans sa branche, quand `close-check` tourne, alors le message dit de fusionner la branche d'intégration (nommée) et non la branche par défaut.
- [ ] CA-11 : Étant donné un EPIC à `integration_branch: yes`, quand la règle « chaque commit porte `[<ID>]` » est vérifiée à sa clôture, alors seuls les commits du premier parent depuis la base comptent ; les commits des enfants fusionnés ne sont pas signalés.
- [ ] CA-12 : Étant donné le dépôt, quand on lit les skills `new`, `plan`, `review`, `close`, le template `spec-epic.md` et le site, alors chacun décrit le comportement avec l'option (point de départ, base de revue, cible et mode de fusion, revue d'ensemble, fusion de la branche par défaut sans rebase) en se référant à `baseBranch` de `status --json` ; un test vérifie la présence de `baseBranch` dans `new`, `review` et `close`.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, aucun accès nouveau ; le plugin lit des refs git locales.
- Performance : la résolution de la base réutilise l'index des chantiers déjà construit par `status` et `close-check` ; pas d'appel git par niveau d'imbrication au-delà de la résolution de la référence finale.
- Accessibilité : N/A, sortie texte de CLI.
- Données personnelles : N/A.
- Compatibilité : Node ≥ 20, aucune dépendance ; specs existantes sans le champ inchangées (CA-1).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Dépôts git temporaires construits par les tests : branche par défaut, `epic/EPIC-1-demo` à l'option, deux enfants dont un fusionné par commit de fusion, un fusionné par squash, une branche d'intégration rebasée, un sous-EPIC avec et sans l'option, une branche d'intégration seulement locale, seulement distante, absente.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
