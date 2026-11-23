---
id: FIX-20
type: FIX
title: Tranche TDD sans critère d'acceptation
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
source: TEC-15, tranche 6 (site, README, montée de version)
signed_by:
signed_at:
---

# FIX-20 Tranche TDD sans critère d'acceptation

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : dans un chantier `tdd: yes` découpé en tranches, une tranche dont `plan.md` ne liste aucun CA (site, README, montée de version, configuration) ne peut pas avancer. Elle commence en phase « tests d'abord » : le hook refuse toute écriture hors test, et `atelier freeze-tests` refuse tant que le dernier commit ne contient pas de fichier de test. Il n'y a rien d'honnête à tester, donc ni gel ni build.
- Attendu : une tranche sans CA se mène sans phase de tests, sans test inventé, et sans affaiblir le TDD des tranches qui ont des CA.
- Impact : bloquant pour tout chantier TDD qui finit par sa documentation, ce qui est le cas par défaut dans ce dépôt (« toute évolution du plugin met le site à jour dans la même PR »). Le seul contournement est un test de complaisance.
- Source : TEC-15, tranche 6 « Site, README, version — vérifié par `npm run build` et `claude plugin validate` ». Contournement : amendement de la spec pour créer CA-19, un test de contenu du site, uniquement pour pouvoir figer.

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit sur TEC-15, et reproductible en test unitaire sur les fonctions pures :
1. Chantier `tdd: yes`, `plan.md` à 2 tranches, la 2ᵉ sans CA (`2. Site — vérifié par le build`).
2. Revue de la tranche 1 enregistrée : `setReviewedUpdate` écrit `slice: 2` et vide `tests_commit`.
3. `testDrivenPhase` renvoie `writing-tests` : `guardDecision` refuse l'écriture de `site/cycle/tests.md`.
4. `atelier freeze-tests` sur un commit sans test : « Le dernier commit ne contient aucun fichier de test » (`lib/cli.mjs`, `commandFreezeTests`).

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance forte. Le TDD est une décision au niveau du chantier (`tdd: yes`), mais la phase « tests d'abord » est imposée à **chaque tranche**, sans regarder ce que la tranche couvre :
- `setReviewedUpdate` (`lib/core.mjs`) vide `tests_commit` à chaque passage de tranche, quelle qu'elle soit ;
- `testDrivenPhase` ne dépend que de `tdd` et `tests_commit` ;
- `planSliceCount` ne lit que le nombre de tranches, jamais leurs CA, alors que le plan les déclare déjà (`— CA couverts : CA-1, CA-2`).

Le plan sait qu'une tranche n'a rien à tester ; la machine à états l'ignore.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->

### Les options, challengées

- **A. `/atelier:plan` refuse une tranche TDD sans CA** (ta préférence). Zéro code dans la machine à états, mais elle déplace le problème au lieu de le régler. La tranche documentaire est légitime et récurrente (règle du projet : site dans la même PR). La fusionner dans la dernière tranche de code mélange dans une même revue de la logique et de la prose, et grossit la tranche au-delà des 15 minutes. Lui donner « un vrai critère » revient à CA-19 : un test de contenu de site est un test de complaisance. Et un refus écrit dans une skill reste une consigne au modèle, pas un contrôle.
- **B. Gel « vide » autorisé quand la tranche n'a aucun CA.** Règle le cas, mais par un faux événement : on « fige » des tests qui n'existent pas, avec un commit et une trace pour rien, et un cas particulier dans `freeze-tests`.
- **C, retenue : une tranche sans CA hérite du gel de la précédente.** C'est la cause qu'on corrige : la phase « tests d'abord » ne s'ouvre que pour une tranche qui couvre au moins un CA. Au passage à une tranche sans CA, `set-reviewed` ne vide pas `tests_commit` : la tranche démarre directement en phase « implémentation », les tests des tranches précédentes restent figés (le hook les protège toujours), on écrit doc, site et version, puis revue de tranche comme d'habitude. Pas de nouvelle phase, pas de gel fictif : seulement une condition de plus dans `setReviewedUpdate`, lue dans le plan.

C garde de A ce qui est bon : le plan devient la source contrôlée. Un nouveau contrôle déterministe, `atelier check-plan`, refuse un plan incohérent (CA de la spec couvert par aucune tranche, CA cité inconnu, tranche 1 sans CA dans un chantier TDD : elle n'aurait aucun gel dont hériter). La skill `plan` le lance avant de commiter le plan.

Le risque de C : déclarer « sans CA » une tranche qui contient du code, pour esquiver le TDD. Parades : la tranche sans CA est visible dans le plan (validé par l'humain) et dans `atelier status` ; `check-plan` exige que tout CA soit couvert par une tranche ; la revue de tranche vérifie que le diff n'introduit pas de comportement non couvert ; tous les tests restent figés pendant la tranche.

### Changements
- `lib/core.mjs` : `planSlices(planText)` (numéro et CA de chaque tranche ; `planSliceCount` s'appuie dessus), `planProblems(spec, planText)` pour `check-plan`, `setReviewedUpdate` (pas de vidage de `tests_commit` vers une tranche sans CA), `nextStep` (libellé de la tranche sans CA), message de `freeze-tests` (pure, dans core).
- `lib/cli.mjs` : commande `atelier check-plan [chemin]` ; `freeze-tests` affiche les nouveaux messages.
- `skills/plan/SKILL.md` : la tranche sans CA est permise et dite comme telle (`6. Site, README, version — sans CA`), la tranche 1 d'un chantier TDD couvre un CA, `atelier check-plan` avant le commit.
- `skills/write-tests/SKILL.md`, `skills/build/SKILL.md` : la tranche sans CA saute l'écriture des tests.
- `templates/plan.md` : exemple de tranche sans CA.
- Site : `cycle/conception.md`, `cycle/tests.md`, `reference/commandes.md` (`check-plan`, `freeze-tests`). Montée de version du plugin (0.3.0 → 0.4.0 : nouvelle commande).
- Tests : `plugins/atelier/test/`.

Seule la mention explicite `sans CA` déclenche l'héritage du gel : une tranche muette sur ses CA garde la phase « tests d'abord » (comportement actuel). Pas de donnée à réparer : un chantier en cours (TEC-15, tranche 6) en profite en écrivant `sans CA` sur la ligne de sa tranche avant le passage de tranche.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un `plan.md` dont la section « Tranches » contient `1. Analyse — CA couverts : CA-1, CA-2` et `2. Site, README, version — sans CA`, quand on lit ses tranches (`planSlices`), alors on obtient la tranche 1 avec `CA-1`, `CA-2` et la tranche 2 déclarée sans CA ; une tranche qui ne dit ni l'un ni l'autre est « non déclarée », pas « sans CA » ; les commentaires HTML et sous-listes indentées sont ignorés, et `planSliceCount` renvoie toujours 2.
- [ ] CA-2 : Étant donné un chantier `tdd: yes` en tranche 1/2 dont la tranche 2 n'a aucun CA, quand la revue de la tranche 1 est enregistrée (`setReviewedUpdate`), alors `slice` passe à 2, `slice_base` vaut HEAD, `tests_commit` n'est **pas** vidé, et le message renvoie vers `/atelier:build` (pas vers `/atelier:write-tests`).
- [ ] CA-3 : Étant donné le même chantier en tranche 2 (sans CA, `tests_commit` hérité), quand le hook de garde évalue une écriture, alors un fichier hors test (`site/cycle/tests.md`) est autorisé et un fichier de test (`plugins/atelier/test/core.test.mjs`) est refusé comme figé.
- [ ] CA-4 : Étant donné le même chantier en tranche 2, quand on calcule l'étape suivante (`nextStep`), alors elle indique que la tranche ne couvre aucun CA et renvoie vers l'implémentation (`/atelier:build`) puis la revue, sans mentionner `/atelier:write-tests`.
- [ ] CA-5 : Étant donné un chantier `tdd: yes` dont la tranche suivante a des CA, ou n'est pas déclarée (ni CA ni `sans CA`), quand la revue de la tranche courante est enregistrée, alors `tests_commit` est vidé comme aujourd'hui (non-régression) ; et un chantier `tdd: no` ou à tranche unique se comporte comme aujourd'hui.
- [ ] CA-6 : Étant donné un chantier en tranche sans CA, quand on lance `atelier freeze-tests`, alors il refuse avec un message qui dit que la tranche N ne couvre aucun CA, que ses tests restent ceux déjà figés, et renvoie vers `/atelier:build`.
- [ ] CA-7 : Étant donné un chantier en phase « tests d'abord » dont le dernier commit ne contient aucun test, quand on lance `atelier freeze-tests`, alors le refus indique, en plus d'aujourd'hui, qu'une tranche qui n'a vraiment rien à tester se déclare sans CA dans `plan.md`, par une décision tracée dans `decisions.md`.
- [ ] CA-8 : Étant donné une spec et un plan, quand on lance `atelier check-plan`, alors il signale : un CA de la spec couvert par aucune tranche ; un CA cité par une tranche et absent de la spec ; dans un chantier `tdd: yes`, une tranche 1 sans CA ; une tranche qui ne dit ni `CA couverts : CA-x` ni `sans CA`. Un plan correct ne produit aucun problème (code de sortie 0, sinon 2).

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Hors périmètre : retirer CA-19 de TEC-15. Une fois FIX-20 fusionné, TEC-15 pourra l'abandonner par amendement s'il n'est pas déjà livré ; c'est sa décision.
- Hors périmètre : une tranche sans CA au milieu d'un chantier fonctionne de la même façon (elle hérite du gel), mais rien ne la recommande.
- La forme `sans CA` est stricte (CA-8) : une tranche muette sur ses CA est une omission, pas une déclaration. Sans cette règle, un plan mal écrit désactiverait le TDD en silence.
- Constat annexe : `atelier next-id FIX` renvoie `FIX-880522` sur la branche `claude/project-thread-880521`, c'est exactement FIX-18. Identifiant pris à la main : FIX-20.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
