---
id: FEAT-7
type: FEAT
title: Cycle tests, build, revue par tranche
status: signed
tdd: yes
created_at: 2026-11-20
signed_by: Opack
signed_at: 2026-11-21
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

Quand l'utilisateur valide la revue de la tranche N, atelier passe **de lui-même** à la tranche N+1 : il n'y a pas de commande « tranche suivante » à lancer. Après la dernière tranche : `/atelier:review` encore, pour la **revue du chantier** (voir « Revue »), puis `/atelier:close`.

Cycle résultant : `new → sign → plan → [write-tests → build → review] × tranches → review (chantier) → close`.

**Où atelier lit l'état.**
- La liste des tranches : `plan.md`, section « Tranches », une entrée numérotée par tranche (format actuel du template). Une tranche est identifiée par son **numéro**, pas par sa position : une tranche revue garde son numéro et reste dans le plan ; on ne retire du plan que des tranches à venir. Le nombre de tranches est le plus grand numéro des entrées de premier niveau.
- La tranche en cours : champ d'en-tête de spec `slice` (numéro, à partir de 1), écrit seulement par la CLI, comme `tests_commit` (protégé par le hook d'écriture de la spec). Le premier `freeze-tests` ou `set-reviewed` du chantier l'écrit **toujours** (`slice: 1`), quel que soit le plan : c'est le marqueur du nouveau modèle (voir « Compatibilité »).
- Le début de la tranche en cours : champ `slice_base`, hash complet (comme `reviewed_commit`) du commit revu qui a clos la tranche précédente. C'est la base de comparaison de la revue de la tranche et du contrôle des tests au gel. S'il n'est plus un ancêtre de `HEAD` (rebase, historique réécrit), `freeze-tests` et `set-reviewed` refusent, comme la revue le fait déjà pour `reviewed_commit`.
- Une fois la dernière tranche validée, `slice` vaut `chantier` : il reste la revue du chantier. `last_slice` garde alors le numéro de la dernière tranche revue.
- `tests_commit` : le gel de la **tranche en cours** (vidé au passage à la tranche suivante, conservé au passage à la revue du chantier : les tests restent figés).
- `reviewed_commit` : écrit seulement à la validation de la **revue du chantier** ; c'est lui que la clôture vérifie, comme aujourd'hui.
- L'historique lisible : `revue.md`, une section par revue, chacune indiquant sa tranche (ou « chantier »).

**Passage à la tranche suivante.** Il n'a lieu **que si l'utilisateur valide la revue** de la tranche : `/atelier:review` présente le résultat (plus aucun point bloquant non traité) et demande sa validation explicite ; seulement après son « oui », il lance `atelier set-reviewed` puis commite aussitôt la spec et `revue.md` (`docs(chantiers): [<ID>] review <tranche>`). Sans validation, rien n'est écrit et la tranche reste en cours. `atelier set-reviewed` :
- tranche N < plus grand numéro du plan : écrit `slice: N+1`, `slice_base: <HEAD>`, vide `tests_commit` ; n'écrit pas `reviewed_commit`. En TDD, le chantier repasse ainsi en phase « tests d'abord » pour la tranche N+1 ;
- tranche N ≥ plus grand numéro du plan (dernière tranche, ou tranche en cours retirée du plan entre-temps) : écrit `slice: chantier`, `last_slice: N`, `slice_base: <HEAD>` ; garde `tests_commit` ;
- `slice: chantier`, ou chantier à tranche unique : écrit `reviewed_commit`, comme aujourd'hui.
Mêmes refus qu'aujourd'hui (spec non signée, code non commité, spec modifiée et non commitée, tests non figés ou modifiés depuis leur gel), plus deux :
- `slice_base` n'est plus un ancêtre de `HEAD` ;
- revue de tranche sans aucun commit de code depuis le début de la tranche (`slice_base`, ou `merge-base` pour la tranche 1) : on ne passe pas une tranche vide. « Code » au sens de la revue actuelle (hors dossier du chantier, état atelier et chemins libres).

Si la tranche en cours a été retirée du plan, `status` le signale (« tranche 3 absente du plan : la revue de la tranche mène à la revue du chantier »).

**Tests des tranches précédentes.** Ils restent figés : pendant la phase « tests d'abord » de la tranche N, on **ajoute** des tests ; on ne modifie ni ne supprime ceux des tranches précédentes. Les tests d'une tranche vivent souvent dans le même fichier que ceux de la précédente : la règle ne peut donc pas être portée par le hook d'écriture (qui raisonne par fichier). Elle est portée par `atelier freeze-tests` : il **refuse** le gel si une ligne de test présente à `slice_base` a été modifiée ou supprimée, en listant les fichiers.

Le contrôle porte sur des **lignes**, pas sur des tests : `git diff --no-renames --ignore-all-space --ignore-cr-at-eol <slice_base> -- <chemins de test>` ; toute ligne retirée (`-`) déclenche le refus, y compris dans un fichier supprimé ou renommé. Limite assumée : ajouter une ligne au milieu d'un test existant (une assertion) passe pour un ajout ; reformater ou déplacer un test passe pour une modification. Le reviewer couvre ce que le contrôle par lignes ne voit pas. Les tests du projet antérieurs au chantier sont concernés à partir de la tranche 2, comme ceux des tranches précédentes.

Si un test d'une tranche précédente doit vraiment changer, c'est une décision de l'utilisateur, tracée, par le chemin qui existe déjà : `/atelier:amend` si la spec change, puis `/atelier:write-tests <raison>`, qui lance `atelier reopen-tests <raison>`. La réouverture devient possible aussi en phase « tests d'abord » d'une tranche N > 1, pour les tests des tranches précédentes ; elle ajoute aux amendements de la spec l'entrée habituelle « tests rouverts » (gel quitté : `slice_base`). Tant que cette réouverture est la dernière entrée de gel, `freeze-tests` accepte les modifications, puis trace le regel comme aujourd'hui. Une deuxième réouverture alors que la dernière entrée de gel est déjà « tests rouverts » est refusée (« tests déjà rouverts »). En phase « tests d'abord » de la tranche 1, la réouverture reste refusée, comme aujourd'hui : il n'y a rien de figé. Il n'y a pas d'option pour passer outre au moment du gel.

En `slice: chantier`, la réouverture reste possible, comme aujourd'hui en phase d'implémentation : la revue du chantier peut révéler un `CA` sans test. `reopen-tests` vide `tests_commit` (gel quitté : `tests_commit`) ; le chantier reste en `slice: chantier`, en phase « tests d'abord » ; le `freeze-tests` suivant compare à `slice_base` et accepte les modifications grâce à la réouverture.

Le hook d'écriture garde ses règles actuelles : rien que des tests en phase « tests d'abord », aucun test en phase d'implémentation.

**Tests limités aux CA de la tranche.** Consigne du skill `write-tests` (il lit dans `plan.md` les `CA` couverts par la tranche et n'écrit que leurs tests), vérifiée par le reviewer. Pas de contrôle automatique : le lien entre un test et un `CA` n'est pas fiable à extraire.

**Revue.**
- **Revue de tranche** : sur le diff `slice_base..HEAD` (première tranche : depuis la base habituelle, `merge-base` avec la branche par défaut). Ligne à ligne, comme aujourd'hui, mais sur un diff de la taille d'une tranche.
- **Revue du chantier** (`slice: chantier`, chantiers à plusieurs tranches seulement) : sur tout le diff (`merge-base..HEAD`), avec un mandat différent, transversal, pour ne pas refaire le ligne à ligne déjà fait : couverture de chaque `CA` de la spec par un test, cohérence entre tranches (contrats, nommage, duplications), restes de tranches précédentes (code mort, TODO, contournements provisoires), écarts entre la spec, `plan.md`, `decisions.md` et le code. Ses points se traitent comme ceux d'une revue de tranche : les corrections de code se font en `build` (tests figés) ; un test manquant passe par `/atelier:write-tests <raison>` (réouverture, voir plus haut). Un chantier à tranche unique n'en a pas : sa revue de tranche porte déjà sur tout le chantier.
- **Vocabulaire** : chaque passage du sous-agent reviewer est une **revue**. Après correction des points, on relance une revue, jusqu'à zéro point bloquant. Le mot « tour », qui désigne déjà le tour de l'agent (« contrôle de fin de tour »), disparaît du vocabulaire de la revue : skills `review` et `close`, agent `reviewer`, templates `revue.md` et `bilan.md`, site, `README.md`.

**Clôture.** `atelier close-check` (et `set-status done`) refuse en plus si un chantier à plusieurs tranches n'est pas en `slice: chantier` (« tranche 2/3 en cours »), ou si le plan compte une tranche de numéro supérieur à `last_slice` (tranche ajoutée au plan après la dernière revue de tranche : « tranche 4 du plan non revue »). La revue à jour (`reviewed_commit`) est celle de la revue du chantier.

**Ce que devient un amendement en cours de route.** La spec amendée pendant la tranche N : les tranches déjà revues ne sont pas rouvertes. Ce que l'amendement change dans leur comportement se traite dans la tranche en cours ou dans une tranche ajoutée au plan (tests, code, revue). Le plan peut être modifié (ajout, découpage de tranches restantes) ; la modification est commitée et vue par la revue suivante.

**Chantiers simples.**
- Pas de `plan.md` (FIX, TEC, petit chantier) ou une seule tranche : une seule tranche ; le cycle est exactement celui d'aujourd'hui, sans message de tranche (`slice: 1` est écrit dans la spec, mais ni `status` ni la prochaine étape n'en parlent).
- `SPIKE` en TDD (`tdd: yes`) : le choix du TDD vaut tout le process ; cycle par tranche complet, revue **obligatoire** (de tranche et du chantier), vérifiée par `close-check` comme pour les autres types.
- `SPIKE` sans TDD : hors du découpage en tranches ; pas de champ `slice`, `build` enchaîne les tranches, revue facultative sur tout le diff, clôture sans revue exigée, comme aujourd'hui.
- Le skill `build` ne prend plus d'argument « tranche demandée » quand `slice` est défini : il travaille sur la tranche en cours. L'argument reste pour un `SPIKE` sans TDD.
- `EPIC` (FEAT-4) : ses lots sont des chantiers, pas des tranches ; non concerné.

**Affichage.** `atelier status` (texte et `--json` : `slice`, `sliceCount`) et la prochaine étape indiquent la tranche, en préfixant le message actuel : « Tranche 2/3 : <message actuel> » ; en `slice: chantier` : « Revue du chantier : faire relire l'ensemble : /atelier:review ». Le rappel de début de session aussi. Dans `--json`, `slice` vaut un nombre ou `"chantier"`, `sliceCount` un nombre ; tous deux valent `null` pour un chantier à tranche unique, de l'ancien modèle ou `SPIKE` sans TDD.

**Compatibilité avec les chantiers en cours.** Un chantier signé sans champ `slice` a été mené selon l'ancien modèle si `tests_commit` ou `reviewed_commit` est renseigné, ou si ses amendements contiennent une entrée « tests rouverts » ou « tests regelés » : il est traité comme une tranche unique, quel que soit son plan, et se termine comme aujourd'hui. Les nouveaux chantiers ne sont pas capturés, puisque le premier `freeze-tests` ou `set-reviewed` écrit toujours `slice`. Limite assumée : un ancien chantier `tdd: no` encore en build, jamais revu, n'a aucune trace et bascule dans le nouveau modèle. Aucune migration.

**Site et documentation.** Pages du cycle (conception, tests, implémentation, revue, clôture), référence des commandes (`freeze-tests`, `reopen-tests`, `set-reviewed`, `status`), en-tête de spec et glossaire (« tranche »), le schéma SVG de la vue d'ensemble (la boucle tests → build → revue tourne par tranche), `README.md`, template `plan.md` (consigne : tranches numérotées, chacune avec ses `CA`), template `revue.md` (une section par revue, avec sa tranche).

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
  - `COMMAND_SPEC_FIELDS` : `slice`, `slice_base`, `last_slice` ;
  - exception `SPIKE` de `closeProblems` / `nextStep` limitée au `SPIKE` sans TDD ;
  - effet de `set-reviewed` (avancer ou enregistrer la revue finale) ;
  - refus du gel quand des lignes de tests antérieurs ont changé sans réouverture (à partir d'un diff fourni par la CLI) ; `reopenTestsRefusal` (réouverture en phase « tests d'abord » d'une tranche N > 1) ;
  - `closeProblems` (tranche non terminée, plan raccourci) ;
  - `nextStep` (tranche N/M).
- `plugins/atelier/lib/cli.mjs` : `freeze-tests`, `reopen-tests`, `set-reviewed`, `status`, `close-check`, lecture de `plan.md` et du diff des tests depuis `slice_base`.
- Skills : `plan` (format des tranches), `write-tests` (tests de la tranche seulement), `build` (une tranche, puis `/atelier:review`), `review` (base `slice_base`, validation de l'utilisateur avant `set-reviewed`, revue du chantier, suite selon la tranche), `close`, `status`. Agent `reviewer` : mandat de la revue du chantier.
- `plugins/atelier/test/core.test.mjs` : tests de la logique et des hooks touchés (règle du `CLAUDE.md`).
- Templates : `plan.md`, `revue.md`.
- Site : `site/cycle/*.md`, `site/guide/vue-ensemble.md` (SVG), `site/reference/commandes.md`, `site/reference/glossaire.md`, page de l'en-tête de spec ; `README.md`.
- FEAT-4 (relations, EPIC) sera fusionné avant : ce chantier se rebase dessus (mêmes fonctions de `core.mjs` : `nextStep`, `closeProblems` ; mêmes skills `plan` et `close`).
- Version du plugin : montée mineure.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->
Tranchées pendant la rédaction (à reporter dans `decisions.md`) :
- Pas de commande « tranche suivante » : le passage se fait à la validation de la revue de tranche, par `set-reviewed`.
- Tests d'une tranche précédente modifiés : refus au gel, sans option pour passer outre ; on passe par `/atelier:amend` et / ou `/atelier:write-tests <raison>`.
- Revue du chantier séparée après la dernière tranche, avec un mandat transversal, plutôt qu'un simple passage de cohérence dans la revue de la dernière tranche.
- « Tour » de revue remplacé par « revue ».
- Une tranche est identifiée par son numéro ; une tranche revue reste dans le plan. Tranche en cours retirée du plan : sa revue mène à la revue du chantier.
- `slice` est écrit dès le premier gel ou la première revue, quel que soit le plan : marqueur non ambigu du nouveau modèle.
- `SPIKE` : le TDD décide du cadre, pas le type. En TDD, process complet et revue obligatoire ; sans TDD, hors tranches, revue facultative.
- Contrôle des tests antérieurs par lignes (`git diff`), pas par tests : limite assumée, complétée par le reviewer.
- `slice_base` qui n'est plus un ancêtre de `HEAD` : refus, pas de recalcul.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->
Plan et tranche en cours :
- [ ] CA-1 : Étant donné un `plan.md` dont la section « Tranches » compte des entrées numérotées de premier niveau 1, 2 et 3 (sous-listes et commentaires ignorés), quand atelier lit le plan, alors il compte 3 tranches ; avec des entrées 1, 2 et 4, il en compte 4 (plus grand numéro).
- [ ] CA-2 : Étant donné un chantier sans `plan.md`, ou dont le plan n'a pas de section « Tranches » ou une seule entrée, quand atelier lit l'état, alors il y a une tranche, ni `status` ni la prochaine étape ne parlent de tranche, et `status --json` donne `slice: null`, `sliceCount: null`.
- [ ] CA-3 : Étant donné une spec signée sans champ `slice` et sans trace de l'ancien modèle, et un plan à 3 tranches, quand atelier lit l'état, alors la tranche en cours est la 1 ; avec `slice: 2`, c'est la 2, et `status --json` donne `slice: 2`, `sliceCount: 3`.
- [ ] CA-4 : Étant donné une spec signée sans champ `slice` dont `tests_commit` ou `reviewed_commit` est renseigné, ou dont les amendements contiennent « tests rouverts » ou « tests regelés » (chantier de l'ancien modèle), quand atelier lit l'état, alors il y a une tranche unique, quel que soit le plan.
- [ ] CA-5 : Étant donné une spec signée, quand l'agent tente d'écrire ou de modifier `slice`, `slice_base` ou `last_slice` dans l'en-tête, alors le hook d'écriture refuse, comme pour `tests_commit`.

Gel des tests :
- [ ] CA-6 : Étant donné un chantier TDD sans champ `slice` ni trace de l'ancien modèle, avec ou sans plan, `SPIKE` compris, quand `atelier freeze-tests` réussit, alors il écrit `tests_commit` et `slice: 1`.
- [ ] CA-7 : Étant donné la tranche N > 1 en phase « tests d'abord » et une ligne de test présente à `slice_base` modifiée ou supprimée depuis (fichier supprimé ou renommé compris ; espaces et fins de ligne ignorés), sans réouverture, quand `atelier freeze-tests` est lancé, alors il refuse en listant les fichiers concernés, renvoie vers `/atelier:amend` ou `/atelier:write-tests <raison>`, et n'écrit rien.
- [ ] CA-8 : Étant donné la tranche N > 1 en phase « tests d'abord », quand `atelier reopen-tests <raison>` est lancé, alors il ajoute l'entrée « tests rouverts (gel quitté : <slice_base>) : <raison> » ; le `freeze-tests` suivant accepte alors les modifications de tests antérieurs et ajoute l'entrée « tests regelés ». Un second `reopen-tests` avant le regel est refusé (« tests déjà rouverts ») ; en phase « tests d'abord » de la tranche 1, la réouverture est refusée comme aujourd'hui.
- [ ] CA-9 : Étant donné la tranche N > 1 où seules des lignes ou des fichiers de test ont été ajoutés, quand `atelier freeze-tests` est lancé, alors il fige sans demander de raison.
- [ ] CA-10 : Étant donné `slice: chantier` en TDD, quand `atelier reopen-tests <raison>` est lancé, alors il vide `tests_commit`, ajoute l'entrée « tests rouverts », laisse `slice: chantier` ; la phase devient « tests d'abord », et le `freeze-tests` suivant fige en acceptant les modifications.
- [ ] CA-11 : Étant donné `slice_base` qui n'est plus un ancêtre de `HEAD` (rebase), quand `atelier freeze-tests` ou `atelier set-reviewed` est lancé, alors il refuse en le signalant et n'écrit rien.

Garde d'écriture et contrôle de fin :
- [ ] CA-12 : Étant donné la tranche N > 1 en phase « tests d'abord », quand l'agent écrit un fichier hors des chemins de test, alors le hook refuse ; un fichier de test, alors il accepte.
- [ ] CA-13 : Étant donné la tranche N en phase d'implémentation, quand un test (de cette tranche ou d'une précédente) a changé depuis `tests_commit`, alors le hook d'écriture refuse son écriture et le contrôle de fin le signale, comme aujourd'hui.

Revue et passage de tranche :
- [ ] CA-14 : Étant donné la tranche 2 sur 3, du code commité depuis `slice_base`, revue sans refus possible, quand `atelier set-reviewed` est lancé, alors la spec reçoit `slice: 3`, `slice_base: <HEAD>` (hash complet), `tests_commit` vide, et `reviewed_commit` reste absent ; le message annonce la tranche 3 et la commande suivante (`/atelier:write-tests`, ou `/atelier:build` sans TDD).
- [ ] CA-15 : Étant donné la tranche 3 sur 3, ou la tranche 3 alors que le plan n'en compte plus que 2, quand `atelier set-reviewed` est lancé, alors la spec reçoit `slice: chantier`, `last_slice: 3` et `slice_base: <HEAD>`, `tests_commit` est conservé, `reviewed_commit` reste absent, et le message annonce la revue du chantier (`/atelier:review`).
- [ ] CA-16 : Étant donné `slice: chantier`, ou un chantier à tranche unique, quand `atelier set-reviewed` est lancé, alors il écrit `reviewed_commit` comme aujourd'hui, sans toucher à `slice`.
- [ ] CA-17 : Étant donné `slice: chantier` en TDD, tests figés, quand l'agent écrit un fichier de test, alors le hook refuse ; un fichier de code, alors il accepte.
- [ ] CA-18 : Étant donné un chantier `tdd: no` à 2 tranches en tranche 1, quand `atelier set-reviewed` est lancé, alors il passe à la tranche 2 (`slice: 2`, `slice_base`), et la prochaine étape est `/atelier:build`.
- [ ] CA-19 : Étant donné une des situations de refus actuelles de `set-reviewed` (code non commité, tests non figés ou modifiés), quand il est lancé, alors il refuse sans changer de tranche.
- [ ] CA-20 : Étant donné une tranche sans aucun commit de code depuis son début (`slice_base`, ou `merge-base` en tranche 1), quand `atelier set-reviewed` est lancé, alors il refuse (« tranche vide ») sans changer de tranche.

Clôture et prochaine étape :
- [ ] CA-21 : Étant donné un chantier en tranche 2 sur 3, ou en tranche 3 sur 3 pas encore revue, quand `atelier close-check` est lancé, alors il refuse avec « tranche N/3 en cours » ; en `slice: chantier` sans `reviewed_commit`, il refuse en demandant la revue du chantier.
- [ ] CA-22 : Étant donné `slice: chantier`, `last_slice: 3` et un plan qui compte une tranche 4, quand `atelier close-check` est lancé, alors il refuse (« tranche 4 du plan non revue »).
- [ ] CA-23 : Étant donné `slice: chantier` et la revue du chantier à jour, quand `atelier close-check` est lancé, alors il passe ; un chantier de l'ancien modèle avec une revue à jour passe aussi.
- [ ] CA-24 : Étant donné un chantier TDD à 3 tranches, quand atelier calcule la prochaine étape, alors elle vaut « Tranche N/3 : » suivi du message actuel de la phase (`write-tests`, puis `build ; ensuite faire relire : /atelier:review`) ; en `slice: chantier` sans revue, « Revue du chantier : faire relire l'ensemble : /atelier:review » ; une fois celle-ci enregistrée, le message actuel de clôture (`/atelier:close`).
- [ ] CA-25 : Étant donné un `SPIKE` en TDD à plusieurs tranches, quand atelier calcule l'état, alors il suit le cycle par tranche comme un `FEAT`, et `close-check` exige la revue du chantier ; étant donné un `SPIKE` sans TDD à plusieurs tranches, alors pas de `slice` (`set-reviewed` n'en écrit pas), pas de message de tranche, et la clôture n'exige ni tranche finale ni revue.
- [ ] CA-26 : Étant donné un chantier en tranche 2 sur 3, quand le rappel de début de session s'affiche, alors il indique « Tranche 2/3 » et la prochaine étape correspondante ; pour un chantier à tranche unique, il ne parle pas de tranche.
- [ ] CA-27 : Étant donné les skills `review` et `close`, l'agent `reviewer`, les templates `revue.md` et `bilan.md`, le site et `README.md`, quand on y cherche « tour » au sens d'un passage de revue (« tour de revue », « Tour N », « à chaque tour »), alors il n'y en a plus aucun.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : `slice`, `slice_base` et `last_slice` ne sont écrits que par la CLI (hook d'écriture de la spec). Le nombre de tranches vient de `plan.md`, éditable librement : raccourcir le plan pour clôturer plus tôt reste possible, mais visible dans un commit et dans la revue ; limite assumée.
- Performance : un `git diff` de plus au gel (fichiers de test depuis `slice_base`) ; négligeable.
- Accessibilité : schéma SVG du site avec titre et description (`aria-labelledby`), comme l'actuel.
- Données personnelles : N/A, aucune donnée nouvelle.
- Compatibilité : Node ≥ 20, ESM, aucune dépendance ; chantiers de l'ancien modèle inchangés (CA-4, CA-23).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->
Rejeu de bout en bout sur un dépôt jetable, plan à deux tranches au moins, en TDD : pour chaque tranche, tests (garde : implémentation refusée), gel, build (garde : tests refusés), revue validée et passage automatique ; puis revue du chantier ; `close-check` refusé tant que la revue du chantier n'est pas enregistrée. Puis un chantier `tdd: no` à deux tranches, et un chantier de l'ancien modèle (`tests_commit` sans `slice`).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
