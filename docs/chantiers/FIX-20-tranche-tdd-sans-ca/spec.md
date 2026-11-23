---
id: FIX-20
type: FIX
title: TDD décidé tranche par tranche
status: draft
tdd: yes            # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
source: TEC-15, tranche 6 (site, README, montée de version)
signed_by:
signed_at:
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

Règles :
- **Champ `tdd` de la spec** : inchangé pour un chantier sans plan ou à une seule tranche. Pour un plan à plusieurs tranches, il devient la valeur par défaut proposée au plan ; la valeur de la tranche l'emporte. Une tranche non déclarée (plans antérieurs) prend la valeur du chantier : TEC-15 et les chantiers en cours continuent de fonctionner.
- **Tranche « TDD : oui »** : cycle actuel (tests écrits, commités, figés, puis implémentation). Elle couvre au moins un CA.
- **Tranche « TDD : non »** : pas de phase « tests d'abord », on implémente directement. Les tests s'ajoutent avec le code si utile. On ne fait toujours qu'**ajouter** des tests : `set-reviewed` refuse si une ligne d'un test présent au début de la tranche a été modifiée ou supprimée (le contrôle que `freeze-tests` fait déjà, `testFilesWithRemovedLines`). `freeze-tests` et `reopen-tests` y sont refusés avec un message qui renvoie vers `/atelier:build`.
- **`atelier check-plan`** (nouvelle commande, logique pure `planProblems` dans core) : chaque tranche déclare `TDD : oui|non` ; une tranche « TDD : oui » couvre au moins un CA ; tout CA de la spec est couvert par une tranche ; aucune tranche ne cite un CA absent de la spec. La skill `plan` le lance avant de commiter le plan. C'est le « refus au plan » de l'option A, mais en contrôle déterministe.
- **Changer le TDD d'une tranche** : plan modifié et entrée dans `decisions.md`, comme tout changement de plan ; seulement pour une tranche à venir, ou la tranche courante tant que ses tests ne sont pas figés.

### Changements
- `lib/core.mjs` : `planSlices(planText)` (numéro, CA et TDD de chaque tranche ; `planSliceCount` s'appuie dessus) ; `testDrivenPhase` lit le TDD de la tranche courante ; `setReviewedUpdate`, `setReviewedRefusal`, `nextStep`, `reopenTestsRefusal` et le choix des fichiers de code de tranche (`sliceCodeFiles`, côté cli) suivent ce TDD ; messages de `freeze-tests` ; `planProblems`.
- `lib/cli.mjs` : commande `atelier check-plan` ; `set-reviewed` vérifie les lignes de test supprimées en tranche sans TDD ; `status` affiche le TDD de la tranche.
- Skills : `plan` (décision TDD par tranche avec recommandation, mêmes repères que `/atelier:new`, `check-plan`), `new` (le `tdd` du chantier devient la valeur par défaut des tranches), `write-tests`, `build`, `status` si besoin.
- `templates/plan.md` : format `— CA couverts : CA-x, CA-y — TDD : oui|non`.
- Site : `cycle/conception.md`, `cycle/tests.md`, `cycle/implementation.md`, `reference/commandes.md` (`check-plan`, `freeze-tests`, `reopen-tests`, `set-reviewed`). Montée de version du plugin (nouvelle commande : 0.3.0 → 0.4.0, à recaler sur la version de `main` au moment de la tranche).
- Tests : `plugins/atelier/test/`.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un `plan.md` dont la section « Tranches » contient `1. Analyse — CA couverts : CA-1, CA-2 — TDD : oui`, `2. Site — CA couverts : aucun — TDD : non` et `3. Export — CA couverts : CA-3` (sans TDD déclaré), quand on lit ses tranches (`planSlices`), alors on obtient pour la 1 `CA-1`, `CA-2` et TDD oui, pour la 2 aucun CA et TDD non, pour la 3 `CA-3` et TDD non déclaré ; commentaires HTML et sous-listes indentées ignorés, et `planSliceCount` renvoie 3.
- [ ] CA-2 : Étant donné un chantier `tdd: yes` en tranche 2/3 dont la tranche 2 est « TDD : non », quand on calcule la phase (`testDrivenPhase`), alors elle vaut `none` ; et le hook de garde autorise l'écriture de `site/cycle/tests.md` comme d'un fichier de test.
- [ ] CA-3 : Étant donné un chantier `tdd: no` en tranche 1 « TDD : oui » sans `tests_commit`, quand on calcule la phase, alors elle vaut `writing-tests` : la valeur de la tranche l'emporte dans les deux sens.
- [ ] CA-4 : Étant donné une tranche sans TDD déclaré, ou un chantier sans plan ou à une seule tranche, quand on calcule la phase, alors le résultat est celui d'aujourd'hui (d'après `tdd` du chantier et `tests_commit`).
- [ ] CA-5 : Étant donné un chantier en tranche 1/2 dont la tranche 2 est « TDD : non », quand la revue de la tranche 1 est enregistrée (`setReviewedUpdate`), alors `slice` passe à 2 et le message renvoie vers `/atelier:build`, pas vers `/atelier:write-tests` ; et `nextStep` en tranche 2 indique qu'elle est sans TDD et renvoie vers `/atelier:build` puis la revue.
- [ ] CA-6 : Étant donné une tranche « TDD : non » où une ligne d'un test présent au début de la tranche a été modifiée ou supprimée, quand on enregistre la revue (`setReviewedRefusal`), alors elle est refusée avec la liste des fichiers ; un test seulement ajouté ne la bloque pas.
- [ ] CA-7 : Étant donné une tranche « TDD : non », quand on lance `freeze-tests` ou `reopen-tests`, alors le refus dit que la tranche N est sans TDD d'après `plan.md` et renvoie vers `/atelier:build`.
- [ ] CA-8 : Étant donné une tranche « TDD : oui » en phase « tests d'abord » dont le dernier commit ne contient aucun test, quand on lance `freeze-tests`, alors le refus indique en plus qu'une tranche qui n'a rien à tester se déclare « TDD : non » dans `plan.md`, avec une entrée dans `decisions.md`.
- [ ] CA-9 : Étant donné une spec et son plan, quand on lance `atelier check-plan`, alors il signale : une tranche sans `TDD : oui|non` ; une tranche « TDD : oui » sans CA ; un CA de la spec couvert par aucune tranche ; un CA cité par une tranche et absent de la spec. Un plan correct ne produit aucun problème (code de sortie 0, sinon 2).

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- TEC-15 : une fois FIX-20 fusionné, il suffit d'ajouter `— TDD : non` à la ligne de sa tranche 6, et CA-19 peut sortir par amendement s'il n'est pas déjà livré. Décision de TEC-15, hors périmètre.
- Pas de garde technique contre une tranche de code déclarée « TDD : non » pour esquiver le TDD : la décision est humaine, visible dans le plan et dans `atelier status`, et la revue de tranche la voit. C'est la même confiance que pour `tdd: no` aujourd'hui.
- Un SPIKE `tdd: no` reste hors du cycle des tranches (`sliceState` : `none`), même si son plan déclare une tranche « TDD : oui ».
- Constat annexe : `atelier next-id FIX` renvoie `FIX-880522` sur la branche `claude/project-thread-880521` (bug FIX-18). Identifiant pris à la main.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
