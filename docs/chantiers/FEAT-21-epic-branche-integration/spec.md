---
id: FEAT-21
type: FEAT
title: EPIC en branche d'intégration
status: signed
tdd: yes
created_at: 2026-11-23
rel_depends_on: REF-29
signed_by: Opack
signed_at: 2026-11-23
tests_commit: 64aa051
slice: 2
slice_base: 7e4dec9e6ab43cb5ae9dcebe22659f6904047468
---

# FEAT-21 EPIC en branche d'intégration

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

Modèle actuel (celui d'EPIC-17) : la branche de l'EPIC est courte. Sa spec et son plan sont fusionnés dans la branche par défaut (`plan` §5), puis chaque enfant part de la branche par défaut, est revu contre elle (`git merge-base HEAD <branche par défaut>`, `review` §2 et `sliceCodeFiles` dans `lib/cli/slices.mjs`) et y est fusionné seul. L'EPIC se clôt ensuite sur une branche `epic/<ID>-<slug>` recréée pour l'occasion, sans revue (`isReviewExempt`).

Problème : certains EPIC ont des lots qui n'ont de sens qu'ensemble. Fusionner un enfant seul livre aux utilisateurs du plugin un état intermédiaire incohérent, voire cassé. Sans rien faire, on a le choix entre ce risque et un chantier unique trop gros pour être découpé, revu et testé par tranches.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

Un EPIC peut déclarer dans l'en-tête de sa spec `integration_branch: yes`. Sa branche `epic/<ID>-<slug>` devient alors la **branche d'intégration** de ses enfants, du début à la fin de l'EPIC :

- **Ouverture d'un enfant** (`/atelier:new`) : quand un EPIC à l'option est ouvert, `new` demande le parent **avant** de créer la branche, et `atelier base --parent <ID>` donne le point de départ : la branche de l'enfant part de la branche d'intégration à jour, pas de la branche par défaut. Sur une branche imposée (`claude/<session>`) partie de la branche par défaut, on fusionne la branche d'intégration dans la branche courante avant le commit du brouillon.
- **Revue d'un enfant** (`/atelier:review`, tranche 1, revue du chantier ou tranche unique ; contrôle « tranche vide » de `set-reviewed`) : la base est `git merge-base HEAD <branche d'intégration>`.
- **Clôture d'un enfant** (`/atelier:close`) : la PR vise la branche d'intégration, fusionnée par un commit de fusion (ni squash, ni rebase). Les messages de `close-check` sur les dépendances parlent de la branche d'intégration.
- **Clôture de l'EPIC** : une **revue d'ensemble** de l'EPIC est obligatoire (base : celle de l'EPIC, en général la branche par défaut), puis une seule PR fusionne la branche d'intégration dans la branche par défaut. Un point bloquant de cette revue se corrige par un **enfant correctif** (FIX ou REF, `rel_parent` vers l'EPIC) fusionné dans la branche d'intégration, puis une nouvelle revue d'ensemble ; jamais par du code écrit sur la branche de l'EPIC, que la garde d'écriture refuse.
- **La branche par défaut avance** : on la fusionne dans la branche d'intégration (`git merge`), jamais de rebase. Les enfants ouverts fusionnent ensuite la branche d'intégration dans leur propre branche s'ils en ont besoin. Une fusion de la branche par défaut faite après la revue d'ensemble rend cette revue périmée : c'est voulu, la fusion peut avoir résolu des conflits.
- **Enfant qui dépend d'un chantier hors EPIC** : rien de nouveau. La dépendance est livrée dans la branche par défaut, qu'on fusionne dans la branche d'intégration, puis celle-ci dans l'enfant ; `close-check` exige comme aujourd'hui la dépendance `done` dans la branche de l'enfant. Cas inverse : un chantier hors EPIC qui dépend d'un enfant `done` seulement dans la branche d'intégration attend la clôture de l'EPIC, et `close-check` le dit (CA-10).

**Règle de résolution de la base** (lue partout, calculée en un seul endroit) : la base d'un chantier est la branche d'intégration de l'EPIC ancêtre le plus proche (en remontant `rel_parent`) qui déclare `integration_branch: yes` ; à défaut, la branche par défaut. Un EPIC n'est pas son propre ancêtre : la base d'un EPIC à branche d'intégration est celle de son parent. Cette règle couvre les EPIC imbriqués sans cas particulier.

**Engagement de l'option** : `integration_branch` ne change plus après la signature de l'EPIC (même règle que `tdd`, `id` et `type`). Elle impose des fusions par commit de fusion : un dépôt réglé pour n'accepter que le squash ne peut pas l'utiliser.

**Pourquoi merge et jamais rebase** : les enfants clos portent dans leur spec un `reviewed_commit`, et les enfants ouverts un `reviewed_commit`, un `slice_base` ou un `tests_commit`. Un rebase réécrit ces commits : les revues des enfants clos ne prouvent plus rien et celles des enfants ouverts deviennent introuvables. Un merge garde tous les hashes. Une fusion de la branche d'intégration dans un enfant déjà revu se traite comme aujourd'hui une fusion de la branche par défaut : seules ses résolutions de conflits sur du code périment la revue, le code des enfants frères qu'elle apporte ne compte pas (CA-15). Une nouvelle revue ne montre que le diff propre de l'enfant, puisque sa base a avancé.

**Pourquoi une revue d'ensemble obligatoire** : chaque enfant a été revu seul, contre une base qui bougeait. Personne n'a relu l'assemblage, ni les résolutions de conflits faites en fusionnant la branche par défaut dans la branche d'intégration. La revue d'ensemble porte sur la cohérence entre lots, l'atteinte des CA globaux et ces résolutions ; elle ne refait pas la revue ligne à ligne de chaque enfant.

**Sans l'option** (champ absent ou `no`) : rien ne change, ni code, ni skills, ni messages.

Hors périmètre :
- Toute configuration au-delà du booléen (nom de branche libre, cible autre que la branche par défaut, stratégie de fusion choisie).
- Changer l'option après la signature de l'EPIC : refusé (CA-3), la bascule en cours de route n'est pas outillée.
- Un nouveau contrôle de code sur la règle « chaque commit porte `[<ID>]` » : elle reste une consigne des skills (CA-11).
- Le rebase automatique ou assisté d'une branche d'intégration, et la création ou la fusion des PR par le plugin.
- Les EPIC sans l'option : leur clôture reste sans revue.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- **Un seul calcul de la base** : une fonction pure dans un module de domaine de `lib/` (index des chantiers, identifiant) → `{ branch, epic }` ou la branche par défaut. `atelier status --json` l'expose toujours (`baseBranch`, et l'EPIC qui l'impose, ou `null`) ; `atelier base --parent <ID>` la calcule pour un chantier pas encore créé dont on connaît le parent (`new`) ; `sliceCodeFiles` l'utilise côté CLI. `reviewFacts` ne change pas : il raisonne sur `reviewed_commit..HEAD`, sans base. Lecture de la spec d'un ancêtre : même règle que l'index des chantiers aujourd'hui ; un parent introuvable ou un cycle `rel_parent` (déjà signalés par `check-spec`) donnent la branche par défaut et un avertissement. Le nom de la branche d'intégration se déduit du dossier de l'EPIC (`epic/<ID>-<slug>`), sans configuration.
- **Référence git de la base** : entre la branche locale `epic/<ID>-<slug>` et sa branche de suivi distante, la plus avancée quand l'une contient l'autre ; divergentes → erreur (« synchronise la branche d'intégration ») ; aucune des deux → erreur (« récupère ou pousse la branche d'intégration »). Jamais de repli silencieux sur la branche par défaut, qui gonflerait la revue de tout le travail des autres enfants.
- **EPIC à branche d'intégration et revue** : aujourd'hui `isReviewExempt` exempte tout EPIC et `sliceState` le classe sans modèle de revue. Avec l'option, l'EPIC suit le modèle « tranche unique » pour sa clôture : `reviewed_commit` exigé, à jour, ancêtre de `HEAD` (`setReviewedUpdate` y écrit aussi `slice: 1`, sans conséquence). `nextStep` (qui répond pour un EPIC avant `phaseStep`) et `formatCloseProblems` (qui choisit son message par `isReviewExempt`) en tiennent compte. L'agent `reviewer` reçoit une portée « revue d'ensemble de l'EPIC » : cohérence entre lots, CA globaux, résolutions de conflits des fusions de la branche par défaut.
- **Intégrité des revues des enfants** : `close-check` d'un EPIC à branche d'intégration vérifie que le `reviewed_commit` de chaque enfant `done` (hors enfants exemptés de revue) est ancêtre de `HEAD`. Un rebase de la branche d'intégration ou une fusion d'enfant par squash casse cette propriété : c'est ce qui la rend détectable de façon déterministe.
- **Détection du chantier par les commits** (`chantierIdFromBranchCommits`) : elle prend le commit `[<ID>]` le plus récent de `<branche par défaut>..HEAD`. Sur une branche imposée (`claude/<session>`) d'un enfant, la fusion de la branche d'intégration y fait entrer les commits de l'EPIC et des enfants frères, qui peuvent passer devant ceux de l'enfant. La détection lit donc avec `--first-parent` : seuls les commits de la branche elle-même comptent, sans convention de message de fusion (CA-13). Le commit du brouillon fait juste après la fusion de la branche d'intégration (§2) donne l'identifiant de l'enfant dès l'ouverture.
- **Règle « chaque commit porte `[<ID>]` »** (consigne de `review` et `close`, aucun code ne la vérifie) : comptée avec `--first-parent` depuis la base, pour l'EPIC comme pour l'enfant, sinon les commits des enfants fusionnés ou des frères seraient signalés. Les fusions de la branche par défaut dans la branche d'intégration s'écrivent `[<EPIC-ID>] merge <branche par défaut>`.
- **Garde d'écriture** : sur la branche d'un EPIC, les écritures de code restent refusées. Une résolution de conflits lors de la fusion de la branche par défaut passe par le débrayage (`atelier bypass`) ; la revue d'ensemble la couvre. Une correction demandée par la revue d'ensemble passe par un enfant correctif (§2).
- **Gel de l'option** : `integration_branch` rejoint `FROZEN_AFTER_SIGNATURE_FIELDS` (`lib/write-guard.mjs`), contrôlé par le hook d'édition de spec.
- **Skills et agents à modifier** : `new` (parent demandé avant la branche, point de départ, branche imposée), `plan` (§5 : avec l'option, pousser la branche de l'EPIC au lieu de la fusionner dans la branche par défaut), `review` (base, portée « revue d'ensemble », commits comptés en `--first-parent`), `close` (cible de PR, fusion sans squash et mise en garde sur les dépôts réglés en squash seul, revue d'ensemble de l'EPIC, enfant correctif, fusion de la branche par défaut), agent `reviewer` (portée « revue d'ensemble de l'EPIC »), template `spec-epic.md` (champ commenté). Site : pages du cycle de vie et de l'EPIC, dans la même PR.
- **Ordre vis-à-vis d'EPIC-17** : après son lot 2, REF-29 (`lib/` rangé par domaine), fusionné le 2026-11-24 (`rel_depends_on: REF-29`, §4). Aucune logique nouvelle dans `lib/core.mjs`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

Tranchées par Didier le 2026-11-23 (recommandations retenues) :

- Q1. Revue d'ensemble de l'EPIC obligatoire avec l'option : **oui** (§2, CA-8).
- Q2. Rebase interdit dans la branche d'intégration et fusion des enfants sans squash, vérifiés par `close-check` de l'EPIC : **oui**, refus sans autre échappatoire que rétablir l'historique (reflog, branche distante) (CA-9).
- Q3. Changer l'option après l'ouverture du premier enfant : **hors périmètre**. Relecture critique (même jour, validée par Didier) : refusé dès la signature par le hook d'édition de spec plutôt que par `check-spec`, qui ne connaît ni les enfants ni la version signée (CA-3).
- Q4. Ordre vis-à-vis d'EPIC-17 : **après son lot 2** (`lib/` rangé par domaine). `rel_depends_on` sera ajouté par `/atelier:amend` quand ce lot aura un identifiant ; pas d'implémentation avant. Ce lot est REF-29, livré le 2026-11-24 : dépendance ajoutée le 2026-11-25.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné un chantier sans EPIC ancêtre, ou dont les EPIC ancêtres n'ont pas `integration_branch` ou l'ont à `no`, quand on calcule sa base, alors c'est la branche par défaut (`null` si elle est inconnue) ; `status --json` est identique à aujourd'hui hors ajout du champ `baseBranch`, la base de la tranche 1, `close-check` et ses messages sont identiques, et la suite de tests existante passe sans modification.
- [ ] CA-2 : Étant donné une spec, quand `atelier check-spec` la vérifie, alors il signale `integration_branch` sur un chantier qui n'est pas un EPIC, et toute valeur autre que `yes` ou `no`.
- [ ] CA-3 : Étant donné une spec qui n'est plus en brouillon, quand une édition change, ajoute ou retire `integration_branch` dans son en-tête, alors le hook d'édition de spec la refuse avec un message qui nomme le champ ; en brouillon, l'édition est acceptée.
- [ ] CA-4 : Étant donné un enfant direct d'un EPIC `EPIC-n` à `integration_branch: yes` dont le dossier est `EPIC-n-slug`, quand on calcule sa base, alors c'est `epic/EPIC-n-slug`, `status --json` expose `baseBranch: "epic/EPIC-n-slug"` et l'EPIC qui l'impose, et `atelier base --parent EPIC-n`, lancé depuis la branche par défaut où la spec de l'EPIC n'existe pas, affiche `epic/EPIC-n-slug`.
- [ ] CA-5 : Étant donné des EPIC imbriqués, quand on calcule la base, alors : l'enfant d'un sous-EPIC sans l'option dont le parent a l'option a pour base la branche d'intégration du parent ; l'enfant d'un sous-EPIC à l'option a pour base celle du sous-EPIC ; un EPIC à l'option a pour base celle de son propre parent, ou la branche par défaut s'il n'en a pas.
- [ ] CA-6 : Étant donné une base qui est une branche d'intégration, quand sa référence git est résolue, alors c'est la plus avancée entre la branche locale et sa branche de suivi distante quand l'une contient l'autre ; quand elles ont divergé, ou qu'aucune n'existe, la commande qui en a besoin s'arrête avec un message qui nomme la branche à synchroniser, récupérer ou pousser, sans se replier sur la branche par défaut.
- [ ] CA-7 : Étant donné un enfant parti de la branche d'intégration, dans laquelle un enfant frère a déjà été fusionné avec du code, quand `set-reviewed` contrôle la tranche 1, alors seuls les fichiers de code commités par l'enfant comptent ; une tranche 1 sans code propre est refusée comme vide.
- [ ] CA-8 : Étant donné un EPIC à `integration_branch: yes`, quand `close-check` tourne, alors une revue est exigée comme pour un chantier à tranche unique (`reviewed_commit` présent, ancêtre de `HEAD`, aucun commit de code ni amendement depuis) et le message de refus renvoie vers `/atelier:review` ; un EPIC sans l'option reste exempté de revue.
- [ ] CA-9 : Étant donné un EPIC à `integration_branch: yes` dont un enfant `done` et soumis à revue a un `reviewed_commit` absent de l'historique de `HEAD` (branche d'intégration rebasée, enfant fusionné par squash), ou n'a pas de `reviewed_commit`, quand `close-check` tourne, alors il refuse en nommant l'enfant, avec un texte fixe sur la cause (rebase ou squash) et le remède (rétablir l'historique) ; un enfant `done` exempté de revue (SPIKE sans TDD) n'est pas vérifié.
- [ ] CA-10 : Étant donné un enfant d'un EPIC à `integration_branch: yes` dont une dépendance n'est pas fusionnée dans sa branche, quand `close-check` tourne, alors le message dit de fusionner la branche d'intégration (nommée) et non la branche par défaut. Étant donné un chantier hors de l'EPIC qui dépend d'un enfant `done` seulement dans la branche d'intégration, quand `close-check` tourne, alors le message dit que la dépendance est livrée dans `epic/<ID>-<slug>` et qu'il faut attendre la clôture de l'EPIC.
- [ ] CA-11 : Étant donné le dépôt, quand on lit les skills `review` et `close`, alors la règle « chaque commit porte `[<ID>]` » y compte les commits avec `--first-parent` depuis `baseBranch`, pour l'EPIC comme pour l'enfant ; un test le vérifie sur le texte des deux skills.
- [ ] CA-12 : Étant donné le dépôt, quand on lit les skills `new`, `plan`, `review`, `close`, l'agent `reviewer`, le template `spec-epic.md` et le site, alors chacun décrit le comportement avec l'option (parent demandé avant la branche, point de départ, base de revue, cible et mode de fusion, revue d'ensemble et enfant correctif, fusion de la branche par défaut sans rebase) ; un test vérifie la présence de `baseBranch` dans `review` et `close`, de `atelier base --parent` dans `new`, et de la portée « revue d'ensemble » dans l'agent `reviewer`.
- [ ] CA-13 : Étant donné une branche sans identifiant dans son nom, partie de la branche d'intégration, dont le dernier commit propre porte `[FEAT-n]` et dans laquelle on a ensuite fusionné la branche d'intégration contenant des commits `[EPIC-m]` et `[FIX-k]` plus récents, quand le chantier actif est détecté par les commits, alors c'est `FEAT-n`.
- [ ] CA-14 : Étant donné un EPIC à `integration_branch: yes` signé dont des enfants sont ouverts, quand on demande l'étape suivante, alors elle reste « ouvrir ou terminer les enfants » ; quand tous ses enfants sont clos et qu'aucune revue à jour n'existe, alors elle est la revue d'ensemble (`/atelier:review`) ; revue à jour, alors la clôture (`/atelier:close`).
- [ ] CA-15 : Étant donné un enfant d'un EPIC à `integration_branch: yes` dont la revue est enregistrée, quand on fusionne dans sa branche la branche d'intégration où un enfant frère a livré du code, alors sans conflit la revue reste à jour ; avec une résolution de conflit sur du code, elle est périmée et ses problèmes ne citent que les fichiers résolus, pas ceux de l'enfant frère.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, aucun accès nouveau ; le plugin lit des refs git locales.
- Performance : la résolution de la base a besoin de l'index des chantiers (lecture des specs sur toutes les branches) dès qu'un chantier a un `rel_parent`, ce que `status` fait déjà pour afficher les relations ; un chantier sans `rel_parent` n'en a pas besoin. Au-delà, deux appels git au plus (références locale et distante).
- Accessibilité : N/A, sortie texte de CLI.
- Données personnelles : N/A.
- Compatibilité : Node ≥ 20, aucune dépendance ; specs existantes sans le champ inchangées (CA-1).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Dépôts git temporaires construits par les tests : branche par défaut, `epic/EPIC-1-demo` à l'option, deux enfants dont un fusionné par commit de fusion, un fusionné par squash, une branche d'intégration rebasée, un sous-EPIC avec et sans l'option, une branche d'intégration seulement locale, seulement distante, absente.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
- 2026-11-25 : dépendance à REF-29 et recalage sur le code d'après REF-29 et FIX-28, parce que le lot 2 d'EPIC-17 est livré et que la spec citait des emplacements disparus.
  Ajout de `rel_depends_on: REF-29` (Q4) ; chemins de §1 et §3 recalés sur `lib/` rangé par domaine ; §2 « Pourquoi merge » et nouveau CA-15 : depuis FIX-28, une fusion de la branche par défaut sans résolution de conflit sur du code ne périme pas la revue, et la fusion de la branche d'intégration dans un enfant suit la même règle (sinon chaque synchronisation forcerait une nouvelle revue listant le code des enfants frères).
- 2026-11-25 : tests rouverts (gel quitté : c7daf7b) : RD1 (revue 1 de la tranche 2) : les tests apportés par une fusion de la branche d'intégration ne doivent pas compter comme tests du chantier
- 2026-11-25 : tests regelés : 64aa051
