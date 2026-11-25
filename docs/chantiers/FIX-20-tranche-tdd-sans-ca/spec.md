---
id: FIX-20
type: FIX
title: TDD décidé tranche par tranche
status: signed
tdd: yes            # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
source: TEC-15, tranche 6 (site, README, montée de version)
signed_by: Opack
signed_at: 2026-11-23
tests_commit: d0cd3c3
slice: 4
slice_base: 6d2d1b2c851dd30eaa403a55588777f54b0d69b6
slice_tdd: yes
---


# FIX-20 TDD décidé tranche par tranche

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : dans un chantier `tdd: yes` découpé en tranches, une tranche qui n'a rien à tester (site, README, montée de version, configuration) ne peut pas avancer. Elle commence en phase « tests d'abord » : le hook refuse toute écriture hors test, et `atelier freeze-tests` refuse tant que le dernier commit ne contient pas de fichier de test. Ni gel, ni build.
- Attendu : le TDD se décide **par tranche**, dans `plan.md`. Une tranche « TDD : non » se mène sans phase de tests et sans test inventé, sans affaiblir les tranches « TDD : oui » ni les tests déjà figés.
- Impact : bloquant pour tout chantier TDD qui finit par sa documentation, ce qui est le cas par défaut dans ce dépôt (« toute évolution du plugin met le site à jour dans la même PR »). Le seul contournement est un test de complaisance.
- Source : TEC-15, tranche 6 « Site, README, version — vérifié par `npm run build` et `claude plugin validate` ». Contournement : amendement de la spec pour créer CA-19, un test de contenu du site, uniquement pour pouvoir figer.

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit sur TEC-15, et reproductible en test unitaire sur les fonctions pures :
1. Chantier `tdd: yes`, `plan.md` à 2 tranches, la 2ᵉ sans rien à tester (`2. Site — vérifié par le build`).
2. Revue de la tranche 1 enregistrée : `setReviewedUpdate` écrit `slice: 2`, vide `tests_commit` et renvoie vers `/atelier:write-tests`.
3. `testDrivenPhase` renvoie `writing-tests` : `guardDecision` refuse l'écriture de `site/cycle/tests.md`.
4. `atelier freeze-tests` sur un commit sans test : « Le dernier commit ne contient aucun fichier de test » (`lib/cli.mjs`, `commandFreezeTests`).

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance forte. Le TDD est décidé une fois pour tout le chantier (`tdd` dans la spec), alors que le cycle tests → build → revue tourne par tranche et que les tranches n'ont pas toutes la même nature :
- `testDrivenPhase` (`lib/core.mjs`) ne dépend que de `tdd` et `tests_commit`, jamais de la tranche courante ;
- `setReviewedUpdate` choisit l'étape suivante d'après `tdd` du chantier ;
- `planSliceCount` ne lit dans le plan que le nombre de tranches.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->

### Options écartées
- **A. `/atelier:plan` refuse une tranche TDD sans CA.** Déplace le problème : fusionner la tranche doc dans une tranche de code mélange logique et prose dans une même revue et dépasse les 15 minutes ; lui « donner un vrai critère » produit CA-19. La tranche documentaire est légitime et récurrente.
- **B. Gel « vide »** : on fige des tests qui n'existent pas. Faux événement.
- **C. Tranche « sans CA » qui hérite du gel** (première version de cette spec) : déduit le TDD de l'absence de CA. Trop implicite : une tranche peut couvrir un CA sans que le TDD soit pertinent, et l'inverse n'a pas de sens.

### Retenue : le TDD est une décision de tranche
Chaque tranche du plan déclare son TDD, à côté de ses CA : `1. Analyse — CA couverts : CA-1, CA-2 — TDD : oui`, `6. Site, README, version — CA couverts : aucun — TDD : non`. La décision humaine se prend au plan, tranche par tranche, comme celle du chantier se prend aujourd'hui à `/atelier:new`.

**Valeur qui s'applique.** Le TDD de la tranche courante est recopié dans l'en-tête de la spec, champ `slice_tdd` (`yes` | `no`). Comme `tests_commit` ou `slice`, il ne s'écrit que par la commande atelier (ajout à `COMMAND_SPEC_FIELDS`) : plan.md est un chemin libre, la spec signée ne l'est pas. Un agent bloqué en « tests d'abord » ne peut donc pas en sortir en éditant le plan.
- Ordre de résolution du TDD effectif : `slice_tdd` s'il est renseigné, sinon le `tdd` du chantier. Une tranche que le plan ne déclare pas, un chantier sans plan, le modèle `legacy`, une tranche absente du plan : `slice_tdd` reste vide, le `tdd` du chantier s'applique, comme aujourd'hui.
- `atelier check-plan`, sur un plan sans problème, écrit `slice_tdd` d'après la tranche 1 **seulement si `slice_tdd` est vide** et que la tranche 1 n'a ni tests figés ni revue (y compris dans un plan à une seule tranche). Ensuite, le plan ne le change plus : relancer `check-plan` après une retouche du plan ne touche pas `slice_tdd`. Quand il l'écrit, il rappelle de commiter la spec avec le plan.
- `atelier set-reviewed`, au passage à la tranche N+1, écrit `slice_tdd` d'après la tranche N+1 du plan (vide si elle ne déclare rien) ; au passage à la revue d'ensemble (`slice: chantier`), il le vide.
- `atelier set-tdd yes|no <raison>`, dans un chantier en tranches (modèle `sliced`, tranche numérotée), change le TDD de la **tranche courante** en écrivant `slice_tdd`, même s'il était vide, et l'inscrit dans les amendements (`TDD de la tranche N : désactivé : <raison>`) ; le `tdd` du chantier ne change pas. Refusé si des tests de la tranche sont figés (`tests_commit` renseigné) : il faut d'abord les rouvrir. `set-tdd no` est aussi refusé tant qu'une réouverture des tests est en attente (« tests rouverts » non suivi de « tests regelés ») : sinon la tranche suivante hériterait d'une réouverture et le contrôle des tests des tranches précédentes sauterait au gel. C'est la seule voie pour changer le TDD de la tranche en cours ; le plan se corrige en parallèle, avec une entrée dans `decisions.md`.

**Phases.**
- `writing-tests` n'existe que si le TDD effectif est oui, que `tests_commit` est vide et que la tranche courante est une tranche numérotée (pas la revue d'ensemble).
- `tests_commit` renseigné : `implementing`, quoi que dise le plan.
- Revue d'ensemble (`slice: chantier`) : `writing-tests` si une réouverture des tests y est en attente, `implementing` si `tests_commit` est renseigné, `none` sinon. Une dernière tranche « TDD : non » mène donc normalement à la revue du chantier, puis à la clôture. `reopen-tests` y reste possible dès qu'au moins une tranche du chantier a figé des tests (une entrée de gel ou un `tests_commit` dans l'historique de la spec, ou à défaut le `tdd: yes` du chantier), même si la dernière tranche était sans TDD ; le regel se fait par `freeze-tests`, comme aujourd'hui.
- Tranche « TDD : non » : `none`. Elle se comporte comme un chantier `tdd: no` aujourd'hui : code et tests s'écrivent ensemble, aucun contrôle de lignes de test, la revue juge. `freeze-tests` et `reopen-tests` y sont refusés avec un message qui renvoie vers `/atelier:build`.
- Un SPIKE `tdd: no` reste hors du cycle des tranches (`sliceState` : `none`), quoi que déclare son plan.

**`atelier check-plan [chemin du plan]`** (logique pure `planProblems` dans core). Signale :
- une tranche sans `TDD : oui|non` ;
- une tranche « TDD : oui » sans CA ;
- un CA de la spec couvert par aucune tranche ;
- un CA cité par une tranche et absent de la spec.

Les CA de la spec sont les identifiants `CA-n` en tête d'un élément de liste (`- [ ] CA-1 :` ou `- CA-1 :`), hors commentaires HTML. Côté plan, la lecture tolère `TDD:` sans espace, la casse, `CA couverts : aucun` et un suffixe après l'identifiant (`CA-27 (plugin)`). Code de sortie : 0 sans problème, 2 avec problèmes, 1 si la spec ou le plan est introuvable. Un EPIC est ignoré (ses lots n'ont pas de TDD) : `check-plan` le dit et sort en 0. La skill `plan` lance `check-plan` avant de commiter le plan.

### Changements
- `lib/core.mjs` : `planSlices(planText)` (numéro, CA et TDD de chaque tranche ; `planSliceCount` s'appuie dessus) ; `testDrivenPhase` selon les règles ci-dessus ; `slice_tdd` dans `COMMAND_SPEC_FIELDS` ; `setReviewedUpdate` (écrit `slice_tdd`, message selon le TDD de la tranche suivante) ; `setTddRefusal` et l'entrée d'amendement de `set-tdd` ; `nextStep` et `phaseStep` (« sans TDD pour cette tranche ») ; `reopenTestsRefusal` et messages de `freeze-tests` ; `planProblems` et valeurs écrites par `check-plan`.
- `lib/cli.mjs` : commande `check-plan` ; `set-tdd` sur la tranche courante ; `sliceCodeFiles` suit le TDD effectif ; `status` affiche le TDD de la tranche (texte, et champ `sliceTdd` en `--json`).
- Skills : `plan` (décision TDD par tranche avec recommandation, mêmes repères que `/atelier:new`, `check-plan`), `new` (le `tdd` du chantier devient la valeur par défaut des tranches), `write-tests`, `build`.
- `templates/plan.md` : format `— CA couverts : CA-x, CA-y — TDD : oui|non`.
- Site : `cycle/conception.md`, `cycle/tests.md`, `cycle/implementation.md`, `reference/commandes.md` (`check-plan`, `set-tdd`, `freeze-tests`, `reopen-tests`). Montée de version mineure du plugin (nouvelle commande), recalée sur la version de `main` au moment de la tranche.
- Tests : `plugins/atelier/test/`.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un `plan.md` dont la section « Tranches » contient `1. Analyse — CA couverts : CA-1, CA-27 (plugin) — TDD : oui`, `2. Site — CA couverts : aucun — tdd:non` et `3. Export — CA couverts : CA-3` (sans TDD déclaré), quand on lit ses tranches (`planSlices`), alors on obtient pour la 1 `CA-1`, `CA-27` et TDD oui, pour la 2 aucun CA et TDD non, pour la 3 `CA-3` et TDD non déclaré ; commentaires HTML et sous-listes indentées ignorés, et `planSliceCount` renvoie 3.
- [ ] CA-2 : Étant donné un chantier `tdd: yes` en tranche 2/3 avec `slice_tdd: no` et `tests_commit` vide, quand on calcule la phase (`testDrivenPhase`), alors elle vaut `none` ; le hook de garde autorise l'écriture de `site/cycle/tests.md` (hors `testPaths`) et celle de `plugins/atelier/test/core.test.mjs`.
- [ ] CA-3 : Étant donné un chantier `tdd: no` (type FIX) en tranche 1 avec `slice_tdd: yes` et sans `tests_commit`, quand on calcule la phase, alors elle vaut `writing-tests` ; et pour un SPIKE `tdd: no` dans la même situation, elle vaut `none`.
- [ ] CA-4 : Étant donné `slice_tdd` vide (tranche non déclarée, chantier sans plan, modèle `legacy`, tranche absente du plan), quand on calcule la phase, enregistre une revue ou clôture, alors le résultat est celui d'aujourd'hui, calculé d'après le `tdd` du chantier et `tests_commit`.
- [ ] CA-5 : Étant donné un chantier `tdd: yes` dont `tests_commit` est renseigné et `slice_tdd: no`, quand on calcule la phase, alors elle vaut `implementing` : le plan ne libère pas des tests figés.
- [ ] CA-6 : Étant donné un chantier `tdd: yes` en tranche 1/2 dont le plan déclare la tranche 2 « TDD : non », quand la revue de la tranche 1 est enregistrée (`setReviewedUpdate`), alors `slice` passe à 2, `slice_tdd` à `no`, `tests_commit` est vidé, et le message renvoie vers `/atelier:build`, pas vers `/atelier:write-tests` ; `nextStep` en tranche 2 indique « sans TDD pour cette tranche » et renvoie vers `/atelier:build` puis la revue. Si la tranche 2 est « TDD : oui », `slice_tdd` vaut `yes` et le message renvoie vers `/atelier:write-tests` ; si elle ne déclare rien, `slice_tdd` est vide.
- [ ] CA-7 : Étant donné un chantier `tdd: yes` dont la dernière tranche, « TDD : non », vient d'être revue (`slice: chantier`, `tests_commit` vide), quand on calcule la phase, l'étape suivante et les problèmes de revue et de clôture, alors la phase vaut `none`, `nextStep` renvoie vers la revue du chantier, et ni `setReviewedRefusal` ni `closeProblems` ne signalent « tests non figés ».
- [ ] CA-8 : Étant donné une spec signée en `slice_tdd: yes` et une écriture de la spec par l'outil d'édition qui change `slice_tdd`, quand le hook de garde l'évalue, alors elle est refusée (champ réservé à la commande atelier).
- [ ] CA-9 : Étant donné un chantier en tranche 2/3 (modèle `sliced`), `slice_tdd` vide ou renseigné, quand on lance `atelier set-tdd no <raison>`, alors `slice_tdd` passe à `no` et une entrée « TDD de la tranche 2 : désactivé : <raison> » s'ajoute aux amendements, le `tdd` du chantier restant inchangé ; si `tests_commit` est renseigné, la commande est refusée et renvoie vers la réouverture des tests ; si une réouverture est en attente, elle est refusée aussi.
- [ ] CA-10 : Étant donné une tranche sans TDD (phase `none` en tranche numérotée d'un chantier en tranches), quand on lance `freeze-tests` ou `reopen-tests`, alors le refus dit que la tranche N est sans TDD et renvoie vers `/atelier:build` ; et quand une tranche TDD a un dernier commit sans test, le refus de `freeze-tests` indique en plus qu'une tranche qui n'a rien à tester se déclare « TDD : non » au plan et se change par `atelier set-tdd no <raison>`.
- [ ] CA-11 : Étant donné une spec et son plan, quand on calcule `planProblems`, alors il signale une tranche sans `TDD : oui|non`, une tranche « TDD : oui » sans CA, un CA de la spec couvert par aucune tranche, un CA cité absent de la spec ; un plan correct ne produit aucun problème ; un EPIC n'est pas contrôlé.
- [ ] CA-12 : Étant donné un plan sans problème et une tranche 1 sans tests figés ni revue, quand on calcule les valeurs écrites par `check-plan`, alors elles contiennent `slice_tdd` d'après la tranche 1, même dans un plan à une seule tranche ; une fois des tests figés, une revue enregistrée, ou `slice_tdd` déjà renseigné (même si le plan dit désormais l'inverse), aucune valeur n'est écrite.
- [ ] CA-15 : Étant donné un chantier `tdd: yes` en revue d'ensemble dont la dernière tranche était « TDD : non » et une tranche précédente a figé des tests, quand on lance `reopen-tests <raison>`, alors elle est acceptée, la phase vaut `writing-tests`, puis après `freeze-tests` elle vaut `implementing` ; au passage à la revue d'ensemble, `set-reviewed` a vidé `slice_tdd`.
- [ ] CA-13 : Étant donné une tranche sans TDD, quand on liste les fichiers de code de la tranche pour `set-reviewed`, alors les fichiers de test comptent comme du code ; en tranche TDD ils sont exclus, comme aujourd'hui.
- [ ] CA-14 : Étant donné un chantier en tranche avec `slice_tdd` renseigné, quand on lance `atelier status --json`, alors le chantier porte `sliceTdd` (`yes`, `no` ou `null`), et l'affichage texte indique « TDD : oui » ou « TDD : non » pour la tranche.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- TEC-15 : une fois FIX-20 fusionné, `atelier set-tdd no <raison>` en tranche 6 (avant d'en figer les tests) écrit `slice_tdd: no` pour cette seule tranche ; CA-19 peut sortir par amendement s'il n'est pas déjà livré. Décision de TEC-15, hors périmètre.
- Hors périmètre : un SPIKE `tdd: yes` dont des tranches sont « TDD : non » reste soumis à la revue (il produit du code revu), contrairement à un SPIKE `tdd: no`.
- Hors périmètre : migrer les plans existants (`check-plan` n'est lancé que par la skill `plan`) ; contrôler les lots d'un EPIC.
- Pas de garde technique contre une tranche de code déclarée « TDD : non » au plan : la décision est humaine, visible dans le plan et dans `atelier status`, et la revue de tranche la voit. C'est la même confiance que pour `tdd: no` aujourd'hui. Après le plan, la changer passe par `set-tdd`, tracé.
- À vérifier en test : une tranche 1 « TDD : non » ne passe pas par `freeze-tests`, donc `slice: 1` n'est écrit qu'au premier `set-reviewed` ; le chantier ne doit pas basculer en modèle `legacy` entre-temps.
- Constat annexe : `atelier next-id FIX` renvoie `FIX-880522` sur la branche `claude/project-thread-880521` (bug FIX-18). Identifiant pris à la main.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-24 : tests rouverts (gel quitté : 4dc1b7173ac60a5b9ae38b8cb4ab732fbc50df17) : REF-29 : plan.test.mjs importe lib/slices.mjs au lieu de la façade core.mjs, describe sans identifiant de chantier (règles d'architecture)
- 2026-11-24 : tests regelés : a48e750
- 2026-11-25 : tests rouverts (gel quitté : a48e750) : test/tdd.test.mjs au-delà de 400 lignes après fusion de main (FIX-31, FIX-32) : bloc slice_tdd déplacé tel quel dans test/tdd-slice.test.mjs
- 2026-11-25 : tests regelés : 5a27a5a
