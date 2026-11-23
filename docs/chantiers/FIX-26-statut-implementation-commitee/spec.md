---
id: FIX-26
type: FIX
title: La prochaine étape ignore l'implémentation déjà commitée
status: signed
tdd: yes
created_at: 2026-11-23
source: constat sur REF-16 (tranche 4/4), signalé par Didier
signed_by: Opack
signed_at: 2026-11-23
tests_commit: 
slice: 1
---

# FIX-26 La prochaine étape ignore l'implémentation déjà commitée

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : `atelier status` et le hook de début de session annoncent « Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite faire relire : /atelier:review » alors que l'implémentation de la tranche est déjà commitée. Sur REF-16 (`tdd: no`, 4 tranches), la tranche 4 était entièrement implémentée et commitée (8 commits de code après la revue de la tranche 3), et la prochaine étape affichée restait « Tranche 4/4 : Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite faire relire : /atelier:review ».
- Attendu : dès que du code a été commité depuis le début de la tranche en cours, et tant qu'aucune revue ne la couvre, la prochaine étape est la revue, avec un rappel qu'on peut reprendre /atelier:build si l'implémentation n'est pas finie. Sans commit de code, « Implémenter » reste affiché.
- Impact : tous les chantiers après le premier commit de code d'une tranche, avec ou sans TDD, à tranche unique ou multiple. L'utilisateur est poussé à relancer /atelier:build pour rien : la suite est rejouée, le sous-agent de surapprentissage peut être lancé, un commit vide est proposé. Gravité moyenne : perte de temps et de jetons, et confiance entamée dans `status`, qui est le guide du process.
- Source : constat en fin de REF-16 (PR #17).

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit : oui, par lecture du code et par un dépôt de test.

1. Chantier REF signé, `tdd: no`, plan à 2 tranches, `slice: 2`, `slice_base` sur le commit de validation de la tranche 1.
2. Commiter un fichier de code (hors `docs/chantiers/`) après `slice_base`.
3. `atelier status` : la prochaine étape est « Tranche 2/2 : Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite faire relire : /atelier:review ».

Même constat pour un FIX à tranche unique, et en TDD (phase `implementing`) après un commit de code postérieur au gel des tests (`tests_commit`).

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance : forte.

- `nextStep` (`plugins/atelier/lib/core.mjs`, vers la ligne 1318) : pour une tranche en cours (`model === 'sliced' && slice !== 'chantier'`), elle appelle `phaseStep(chantier)` sans aucune information sur les commits de la tranche.
- `phaseStep` (vers la ligne 1364) : hors phase `writing-tests`, elle ne distingue que trois états de revue (`none`, `current`, `stale`). Avec `none`, elle renvoie toujours le texte « Implémenter », suivi de « ensuite faire relire ». Rien ne lui dit si du code a été commité.
- Le signal existe déjà ailleurs : `sliceCodeFiles` (`plugins/atelier/lib/cli.mjs`, vers la ligne 702) liste les fichiers de code commités depuis le début de la tranche, et `setReviewedRefusal` s'en sert pour refuser une « tranche vide ». `status` et le hook de début de session ne le calculent pas.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Correction de la cause : la prochaine étape reçoit le signal « du code a été commité depuis le début de la tranche ».

**Signal retenu** : celui de la règle « tranche vide » de `atelier set-reviewed` (`sliceCodeFiles`, réutilisée). Pour une tranche d'un chantier `sliced`, `status` propose donc la revue exactement quand `set-reviewed` ne la refusera plus pour ce motif. Pour `single`, `legacy` et le SPIKE sans TDD, `set-reviewed` n'a pas de règle « tranche vide » : le signal leur est étendu, sans équivalent côté refus (SD2).

Il y a implémentation commitée quand au moins un fichier de code (au sens de `reviewCodeFiles` : hors dossier des chantiers, `freePaths` et `.atelier/`) a été modifié par un commit de `<début>..HEAD`. `<début>` vaut :
- en TDD : `tests_commit` (le gel des tests de la tranche en cours), et les fichiers de tests ne comptent pas. Après une réouverture puis un nouveau gel des tests, le code commité avant le nouveau gel ne compte donc plus (SD1) ;
- sans TDD : `slice_base`, ou à défaut la base de fusion avec la branche par défaut.

**Signal incalculable** (SB1) : `codeCommitted` vaut `null` et le texte actuel est conservé, sans erreur, quand :
- aucune base n'est trouvée ;
- une commande git échoue (base introuvable, pas d'ancêtre commun, dépôt sans commit) ;
- `<début>` n'est pas un ancêtre de HEAD (rebase, historique réécrit), vérifié comme le fait `atelier set-reviewed`.
Le hook de début de session ne doit jamais échouer à cause de ce calcul.

**Calcul seulement s'il peut changer la prochaine étape** (SD4) : `status` et le hook ne lancent git que pour un chantier signé, hors EPIC, hors phase `writing-tests`, hors tranche `chantier`, et dont la revue vaut `none`. Sinon `codeCommitted` vaut `null`.

**Pas de condition sur les tests verts en TDD** : `status` ne lance pas la suite. La revue lance les contrôles et trouvera une suite rouge.

**Portée** : tranche en cours d'un chantier `sliced`, chantier `single` et `legacy`, et chantier dispensé de revue (`isReviewExempt`, SPIKE sans TDD) dont la suite est la clôture. Sans effet en phase `writing-tests`, pendant la revue du chantier entier (`slice: chantier`, déjà correcte), ni quand une revue existe (`current` ou `stale`, déjà correctes).

**Formulation** :
- avec revue : « Implémentation commitée : faire relire : /atelier:review (ou reprendre /atelier:build si elle n'est pas finie) » ;
- dispensé de revue : « Implémentation commitée : clôturer : /atelier:close (ou reprendre /atelier:build si elle n'est pas finie) ».
Préfixées de « Tranche N/M : » pour une tranche en cours, comme aujourd'hui.

**Fichiers touchés** :
- `plugins/atelier/lib/core.mjs` : `nextStep(chantier, review, children, codeCommitted = null)` reçoit `codeCommitted` en 4e paramètre positionnel (SD5), qu'elle transmet à `phaseStep`. Fonction pure : l'appelant fournit le fait. Les appels et tests existants restent inchangés.
- `plugins/atelier/lib/cli.mjs` : `status` et `hookSessionStart` calculent ce booléen avec `sliceCodeFiles` (réutilisée, pas dupliquée) et le passent à `nextStep` ; `status --json` l'expose dans l'objet `chantier` (`codeCommitted` : `true`, `false`, ou `null` quand il n'est pas calculé ou est incalculable).
- `plugins/atelier/test/next-step.test.mjs` : cas purs ; un test de bout en bout sur dépôt temporaire pour `status` et le hook de début de session (exigence du dépôt pour un changement de hook).
- `site/reference/commandes.md` : champ `codeCommitted` de `atelier status --json`.

Pas de données à réparer : la prochaine étape est recalculée à chaque appel.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un chantier `sliced` sans TDD sur sa tranche 2/2, sans revue, quand `nextStep` reçoit `codeCommitted: true`, alors elle renvoie « Tranche 2/2 : Implémentation commitée : faire relire : /atelier:review (ou reprendre /atelier:build si elle n'est pas finie) ».
- [ ] CA-2 : Étant donné le même chantier, quand `nextStep` reçoit `codeCommitted: false` ou `null`, alors elle renvoie le texte actuel « Tranche 2/2 : Implémenter (sans TDD pour ce chantier), puis commiter : /atelier:build ; ensuite faire relire : /atelier:review ».
- [ ] CA-3 : Étant donné un chantier en TDD en phase `implementing` (tranche en cours ou tranche unique), sans revue, quand `nextStep` reçoit `codeCommitted: true`, alors elle renvoie le texte « Implémentation commitée : faire relire » de CA-1 (avec le préfixe de tranche s'il y a lieu) ; avec `codeCommitted: false`, le texte actuel « Implémenter jusqu'à ce que tous les tests passent ».
- [ ] CA-4 : Étant donné un chantier `single` et un chantier `legacy`, sans revue, quand `nextStep` reçoit `codeCommitted: true`, alors elle renvoie « Implémentation commitée : faire relire : /atelier:review (ou reprendre /atelier:build si elle n'est pas finie) », sans préfixe de tranche.
- [ ] CA-5 : Étant donné un SPIKE sans TDD (dispensé de revue), quand `nextStep` reçoit `codeCommitted: true`, alors elle renvoie « Implémentation commitée : clôturer : /atelier:close (ou reprendre /atelier:build si elle n'est pas finie) ».
- [ ] CA-6 : Étant donné `codeCommitted: true`, quand la phase est `writing-tests`, ou la revue `current` ou `stale`, ou la tranche `chantier`, alors `nextStep` renvoie exactement ce qu'elle renvoie avec `codeCommitted: false`.
- [ ] CA-7 : Étant donné un dépôt temporaire avec un chantier `sliced` sans TDD, tranche 2/2, `slice_base` posé, quand seul un fichier du dossier du chantier est commité après `slice_base`, alors `atelier status --json` donne `codeCommitted: false` et une prochaine étape « Implémenter » ; quand un fichier de code est ensuite commité, alors il donne `codeCommitted: true` et une prochaine étape « Implémentation commitée : faire relire ».
- [ ] CA-8 : Étant donné le dépôt de CA-7 après le commit de code, quand le hook de début de session s'exécute, alors la prochaine étape qu'il affiche contient « Implémentation commitée : faire relire : /atelier:review ».
- [ ] CA-9 : Étant donné un chantier en TDD sur un dépôt temporaire, quand seul le commit des tests suit le début de la tranche, alors `atelier status --json` donne `codeCommitted: false` ; quand un fichier de code a été commité avant `tests_commit` et aucun après, il donne aussi `codeCommitted: false`.
- [ ] CA-10 : Étant donné le dépôt de CA-7 dont `slice_base` désigne un commit inexistant, puis un commit qui n'est pas un ancêtre de HEAD, quand on lance `atelier status --json` et le hook de début de session, alors `codeCommitted` vaut `null`, la prochaine étape est le texte actuel « Implémenter », et ni l'une ni l'autre commande n'échoue.
- [ ] CA-11 : Étant donné un chantier dont la revue vaut `current`, ou en phase `writing-tests`, quand on lance `atelier status --json`, alors `codeCommitted` vaut `null`.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Hors périmètre : du code modifié mais non commité. `status` ne regarde que les commits ; la revue et `set-reviewed` refusent déjà le code non commité.
- Hors périmètre : savoir si l'implémentation est finie. Le rappel « ou reprendre /atelier:build » couvre le cas d'une implémentation partielle commitée.
- Hors périmètre : un chantier dont la spec est sur la branche par défaut sans `slice_base`. La base de fusion y vaut HEAD, le signal reste `false` et le comportement actuel est conservé (SD3).
- Contournement en attendant : ignorer la prochaine étape et lancer /atelier:review.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-23 : tests rouverts (gel quitté : 6a82789) : OD3 : aucun test de bout en bout du signal calculé depuis la base de fusion (sans TDD, sans slice_base)
