---
id: FEAT-7
type: FEAT
title: Cycle tests, build, revue par tranche
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-20
signed_by:
signed_at:
---

# FEAT-7 Cycle tests, build, revue par tranche

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->
Aujourd'hui, `/atelier:write-tests` écrit d'un coup les tests de **tous** les critères d'acceptation et les fige (`tests_commit`) ; `/atelier:build` implémente ensuite tranche par tranche contre ces tests figés ; `/atelier:review` passe une seule fois, sur tout le diff, avant `/atelier:close`.

Conséquences :
- la phase « tests d'abord » produit un gros lot de tests rouges, difficile à relire, et écrit avant d'avoir appris quoi que ce soit en implémentant la première tranche : les tests des dernières tranches sont souvent faux et rouverts en cours de route ;
- la revue porte sur tout le chantier : le diff dépasse largement les 15 minutes de relecture que le plan promet par tranche, et un défaut de la tranche 1 n'est vu qu'après la tranche 4, qui s'appuie dessus ;
- la tranche, unité de livraison du plan, n'est l'unité de rien d'autre : atelier ne sait pas laquelle est en cours.

Qui est concerné : tout utilisateur d'atelier dont le chantier a un plan à plusieurs tranches.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->
**Le cycle complet se fait par tranche.** Pour chaque tranche de `plan.md`, dans l'ordre :

| | `tdd: yes` | `tdd: no` |
|---|---|---|
| 1 | `/atelier:write-tests` : tests de la tranche, rouges, relus, commités, figés | — |
| 2 | `/atelier:build` : implémentation jusqu'au vert, sans toucher aux tests | `/atelier:build` : implémentation, tests là où ils ont de la valeur |
| 3 | `/atelier:review` : revue du diff de la tranche | idem |

À la fin de la revue de la tranche N, atelier passe **de lui-même** à la tranche N+1 : il n'y a pas de commande « tranche suivante » à lancer. Après la revue de la dernière tranche : `/atelier:close`.

Cycle résultant : `new → sign → plan → [write-tests → build → review] × tranches → close`.

**Où atelier lit l'état.**
- La liste des tranches : `plan.md`, section « Tranches », une entrée numérotée par tranche (format actuel du template). Leur nombre est celui des entrées de premier niveau.
- La tranche en cours : champ d'en-tête de spec `slice` (numéro, à partir de 1), écrit seulement par la CLI, comme `tests_commit` (protégé par le hook d'écriture de la spec).
- Le début de la tranche en cours : champ `slice_base`, le commit revu qui a clos la tranche précédente. C'est la base de comparaison de la revue de la tranche, et la preuve que les tranches précédentes ont été revues.
- `tests_commit` : le gel de la **tranche en cours** (vidé au passage à la tranche suivante).
- `reviewed_commit` : écrit seulement à la revue de la **dernière** tranche ; c'est lui que la clôture vérifie, comme aujourd'hui.
- L'historique lisible (tranche par tranche, avec les tours de revue) : `revue.md`, une section par tranche.

**Passage à la tranche suivante.** `atelier set-reviewed` (lancé par `/atelier:review` quand la revue de la tranche n'a plus de point bloquant) :
- tranche N < dernière : écrit `slice: N+1`, `slice_base: <HEAD>`, vide `tests_commit` ; n'écrit pas `reviewed_commit`. En TDD, le chantier repasse ainsi en phase « tests d'abord » pour la tranche N+1 ;
- dernière tranche : écrit `reviewed_commit`, comme aujourd'hui.
Mêmes refus qu'aujourd'hui (spec non signée, code non commité, tests non figés ou modifiés depuis leur gel).

**Tests des tranches précédentes.** Ils restent figés : pendant la phase « tests d'abord » de la tranche N, on **ajoute** des tests ; on ne modifie ni ne supprime ceux des tranches précédentes. Les tests d'une tranche vivent souvent dans le même fichier que ceux de la précédente : la règle ne peut donc pas être portée par le hook d'écriture (qui raisonne par fichier). Elle est portée par `atelier freeze-tests` : il refuse le gel si une ligne de test présente à `slice_base` a été modifiée ou supprimée, sauf raison donnée (`atelier freeze-tests --reason <raison>`), tracée dans les amendements de la spec (« tests de tranches précédentes modifiés : <raison> »). Le hook d'écriture garde ses règles actuelles : rien que des tests en phase « tests d'abord », aucun test en phase d'implémentation.

**Tests limités aux CA de la tranche.** Consigne du skill `write-tests` (il lit dans `plan.md` les `CA` couverts par la tranche et n'écrit que leurs tests), vérifiée par le reviewer. Pas de contrôle automatique : le lien entre un test et un `CA` n'est pas fiable à extraire.

**Revue.**
- Par tranche, sur le diff `slice_base..HEAD` (première tranche : depuis la base habituelle, `merge-base` avec la branche par défaut).
- La revue de la **dernière** tranche ajoute un passage de cohérence sur tout le diff du chantier (`merge-base..HEAD`) : contrat entre tranches, duplications, couverture de tous les `CA`. Pas de revue finale séparée.
- Une revue peut compter plusieurs **tours** : un tour = un passage du sous-agent reviewer ; après correction des points, on relance un tour, jusqu'à zéro point bloquant. Rien ne change sur ce point.

**Clôture.** `atelier close-check` (et `set-status done`) refuse en plus si la tranche en cours n'est pas la dernière du plan (« tranche 2/3 en cours »), ou si `slice` dépasse le nombre de tranches du plan (plan raccourci en cours de route).

**Ce que devient un amendement en cours de route.** La spec amendée pendant la tranche N : les tranches déjà revues ne sont pas rouvertes. Ce que l'amendement change dans leur comportement se traite dans la tranche en cours ou dans une tranche ajoutée au plan (tests, code, revue). Le plan peut être modifié (ajout, découpage de tranches restantes) ; la modification est commitée et vue par la revue suivante.

**Chantiers simples.**
- Pas de `plan.md` (FIX, TEC, petit chantier) ou une seule tranche : une seule tranche implicite ; le cycle est exactement celui d'aujourd'hui, sans champ `slice` ni message de tranche.
- `SPIKE` : pas de revue, donc pas de passage automatique de tranche ; `build` enchaîne les tranches comme aujourd'hui.
- `EPIC` (FEAT-4) : ses lots sont des chantiers, pas des tranches ; non concerné.

**Affichage.** `atelier status` (texte et `--json` : `slice`, `sliceCount`) et la prochaine étape indiquent la tranche : « Tranche 2/3 : tests d'abord … ». Le rappel de début de session aussi.

**Compatibilité avec les chantiers en cours.** Un chantier signé sans champ `slice` dont `tests_commit` ou `reviewed_commit` est déjà renseigné a été mené selon l'ancien modèle : il est traité comme une tranche unique, quel que soit son plan, et se termine comme aujourd'hui. Pour que la règle ne capture pas les nouveaux chantiers, la première commande qui écrit `tests_commit` ou `reviewed_commit` sur un chantier qui a un plan à plusieurs tranches écrit aussi `slice: 1`. Aucune migration.

**Site et documentation.** Pages du cycle (conception, tests, implémentation, revue, clôture), référence des commandes (`freeze-tests --reason`, `set-reviewed`, `status`), en-tête de spec et glossaire (« tranche »), le schéma SVG de la vue d'ensemble (la boucle tests → build → revue tourne par tranche), `README.md`, template `plan.md` (consigne : tranches numérotées, chacune avec ses `CA`), template `revue.md` (une section par tranche).

Hors périmètre :
- la reprise d'une tranche déjà revue (on avance, on ne revient pas en arrière) ;
- un contrôle automatique du lien test ↔ `CA` ;
- une commande pour sauter une tranche ou réordonner le plan (on modifie `plan.md`) ;
- toute modification du découpage en lots d'un EPIC.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->
- `plugins/atelier/lib/core.mjs` (fonctions pures, testées) :
  - lecture du nombre de tranches de `plan.md` ;
  - tranche en cours et mode ancien / nouveau (compatibilité) ;
  - `COMMAND_SPEC_FIELDS` : `slice`, `slice_base` ;
  - effet de `set-reviewed` (avancer ou enregistrer la revue finale) ;
  - refus du gel quand des lignes de tests antérieurs ont changé (à partir d'un diff fourni par la CLI) ;
  - `closeProblems` (tranche non terminée, plan raccourci) ;
  - `nextStep` (tranche N/M).
- `plugins/atelier/lib/cli.mjs` : `freeze-tests --reason`, `set-reviewed`, `status`, `close-check`, lecture de `plan.md` et du diff des tests depuis `slice_base`.
- Skills : `plan` (format des tranches), `write-tests` (tests de la tranche seulement), `build` (une tranche, puis `/atelier:review`), `review` (base `slice_base`, passage de cohérence à la dernière tranche, suite selon la tranche), `close`, `status`.
- `plugins/atelier/test/core.test.mjs` : tests de la logique et des hooks touchés (règle du `CLAUDE.md`).
- Templates : `plan.md`, `revue.md`.
- Site : `site/cycle/*.md`, `site/guide/vue-ensemble.md` (SVG), `site/reference/commandes.md`, `site/reference/glossaire.md`, page de l'en-tête de spec ; `README.md`.
- FEAT-4 (relations, EPIC) sera fusionné avant : ce chantier se rebase dessus (mêmes fonctions de `core.mjs` : `nextStep`, `closeProblems` ; mêmes skills `plan` et `close`).
- Version du plugin : montée mineure.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->
- Q1. `freeze-tests` : refuser (avec `--reason` pour passer outre) ou seulement avertir quand des tests de tranches précédentes ont changé ? Proposition : refuser, comme le reste du gel.
- Q2. Le passage de cohérence de la dernière tranche suffit-il, ou faut-il une revue finale complète séparée ? Proposition : il suffit.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->
Plan et tranche en cours :
- [ ] CA-1 : Étant donné un `plan.md` dont la section « Tranches » compte 3 entrées numérotées de premier niveau (sous-listes et commentaires ignorés), quand atelier lit le plan, alors il compte 3 tranches.
- [ ] CA-2 : Étant donné un chantier sans `plan.md`, ou dont le plan n'a pas de section « Tranches » ou une seule entrée, quand atelier lit l'état, alors il y a une tranche, et ni `status` ni la prochaine étape ne parlent de tranche.
- [ ] CA-3 : Étant donné une spec signée sans champ `slice` et un plan à 3 tranches, quand atelier lit l'état, alors la tranche en cours est la 1 ; avec `slice: 2`, c'est la 2.
- [ ] CA-4 : Étant donné une spec signée sans champ `slice` dont `tests_commit` ou `reviewed_commit` est renseigné (chantier de l'ancien modèle), quand atelier lit l'état, alors il y a une tranche unique, quel que soit le plan.
- [ ] CA-5 : Étant donné une spec signée, quand l'agent tente d'écrire ou de modifier `slice` ou `slice_base` dans l'en-tête, alors le hook d'écriture refuse, comme pour `tests_commit`.

Gel des tests :
- [ ] CA-6 : Étant donné un chantier TDD à plusieurs tranches sans champ `slice`, quand `atelier freeze-tests` réussit, alors il écrit `tests_commit` et `slice: 1`.
- [ ] CA-7 : Étant donné la tranche N > 1 en phase « tests d'abord » et des lignes de test présentes à `slice_base` modifiées ou supprimées depuis, quand `atelier freeze-tests` est lancé sans raison, alors il refuse en listant les fichiers concernés et n'écrit rien.
- [ ] CA-8 : Dans la même situation, quand `atelier freeze-tests --reason <raison>` est lancé, alors il fige et ajoute aux amendements de la spec l'entrée datée « tests de tranches précédentes modifiés : <raison> ».
- [ ] CA-9 : Étant donné la tranche N > 1 où seuls des tests ont été ajoutés (lignes ou fichiers nouveaux), quand `atelier freeze-tests` est lancé, alors il fige sans demander de raison.

Garde d'écriture et contrôle de fin :
- [ ] CA-10 : Étant donné la tranche N > 1 en phase « tests d'abord », quand l'agent écrit un fichier hors des chemins de test, alors le hook refuse ; un fichier de test, alors il accepte.
- [ ] CA-11 : Étant donné la tranche N en phase d'implémentation, quand un test (de cette tranche ou d'une précédente) a changé depuis `tests_commit`, alors le hook d'écriture refuse son écriture et le contrôle de fin le signale, comme aujourd'hui.

Revue et passage de tranche :
- [ ] CA-12 : Étant donné la tranche 2 sur 3, revue sans refus possible, quand `atelier set-reviewed` est lancé, alors la spec reçoit `slice: 3`, `slice_base: <HEAD>`, `tests_commit` vide, et `reviewed_commit` reste absent ; le message annonce la tranche 3 et la commande suivante (`/atelier:write-tests`, ou `/atelier:build` sans TDD).
- [ ] CA-13 : Étant donné la dernière tranche (ou une tranche unique), quand `atelier set-reviewed` est lancé, alors il écrit `reviewed_commit` comme aujourd'hui, sans toucher à `slice`.
- [ ] CA-14 : Étant donné un chantier `tdd: no` à 2 tranches en tranche 1, quand `atelier set-reviewed` est lancé, alors il passe à la tranche 2 (`slice: 2`, `slice_base`), et la prochaine étape est `/atelier:build`.
- [ ] CA-15 : Étant donné une des situations de refus actuelles de `set-reviewed` (code non commité, tests non figés ou modifiés), quand il est lancé, alors il refuse sans changer de tranche.

Clôture et prochaine étape :
- [ ] CA-16 : Étant donné un chantier en tranche 2 sur 3, quand `atelier close-check` est lancé, alors il refuse avec « tranche 2/3 en cours ».
- [ ] CA-17 : Étant donné `slice: 4` et un plan qui ne compte plus que 3 tranches, quand `atelier close-check` est lancé, alors il refuse en signalant l'incohérence entre la spec et le plan.
- [ ] CA-18 : Étant donné la dernière tranche revue (revue à jour), quand `atelier close-check` est lancé, alors il passe ; un chantier de l'ancien modèle avec une revue à jour passe aussi.
- [ ] CA-19 : Étant donné un chantier TDD à 3 tranches, quand atelier calcule la prochaine étape, alors elle nomme la tranche (« Tranche 2/3 ») et la commande attendue selon la phase : `write-tests`, `build` puis `review` ; après la revue de la dernière tranche, `close`.
- [ ] CA-20 : Étant donné un `SPIKE` à plusieurs tranches, quand atelier calcule l'état, alors il n'y a pas de passage de tranche par la revue et la clôture n'exige pas de tranche finale.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : `slice` et `slice_base` ne sont écrits que par la CLI (hook d'écriture de la spec). Le nombre de tranches vient de `plan.md`, éditable librement : raccourcir le plan pour clôturer plus tôt reste possible, mais visible dans un commit et dans la revue ; limite assumée.
- Performance : un `git diff` de plus au gel (fichiers de test depuis `slice_base`) ; négligeable.
- Accessibilité : schéma SVG du site avec titre et description (`aria-labelledby`), comme l'actuel.
- Données personnelles : N/A, aucune donnée nouvelle.
- Compatibilité : Node ≥ 20, ESM, aucune dépendance ; chantiers de l'ancien modèle inchangés (CA-4, CA-18).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->
Rejeu de bout en bout sur un dépôt jetable, plan à deux tranches au moins, en TDD : pour chaque tranche, tests (garde : implémentation refusée), gel, build (garde : tests refusés), revue et passage automatique ; `close-check` refusé tant que la dernière tranche n'est pas revue. Puis un chantier `tdd: no` à deux tranches, et un chantier de l'ancien modèle (`tests_commit` sans `slice`).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
