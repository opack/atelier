---
id: TEC-6
type: TEC
title: Reconnaître un chantier hors branche <type>/<ID>-<slug>
status: signed
tdd: yes
created_at: 2026-11-20
signed_by: Opack
signed_at: 2026-11-20
tests_commit: 2dd24e6
reviewed_commit: 1573f096364e6bd1eac4c52bc696f56d2eb25046
---

# TEC-6 Reconnaître un chantier hors branche <type>/<ID>-<slug>

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
Quand le nom de la branche courante ne porte pas d'identifiant de chantier, `activeChantier` déduit le chantier actif des commits propres à la branche : l'identifiant `[<ID>]` du commit le plus récent qui en porte un, entre la branche par défaut et `HEAD`. Le nom de branche, s'il porte un identifiant, reste prioritaire. Sur la branche par défaut, aucune déduction.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- `activeChantier` (`plugins/atelier/lib/core.mjs`) ne lit que le nom de la branche (`chantierIdFromText(branch)`), selon la convention `<type>/<ID>-<slug>`.
- Une session Claude Code cloud impose sa branche (ex. `claude/beautiful-carson-5fbgwy`), la seule sur laquelle l'agent peut pousser. Sur cette branche, atelier ne voit aucun chantier : `atelier status` propose `/atelier:new`, les skills qui exigent un chantier actif refusent, et la garde d'écriture bloque tout le code comme sur `main`.
- Contournement utilisé pour TEC-5 : une branche locale `tec/TEC-5-...` poussée vers `claude/...`. Il est fragile : un conteneur relancé repart de `claude/...`, donc sans chantier, et il faut connaître l'astuce.
- La même contrainte existe hors du cloud : convention de branche imposée par une équipe, un outil de ticket ou une CI (`feature/JIRA-123`, `users/<nom>/...`).
- Pourquoi les commits plutôt qu'un fichier ou un réglage :
  - un fichier versionné qui nomme le chantier serait fusionné dans `main` avec la PR, et `main` aurait un chantier actif ;
  - un réglage local (`git config branch.<nom>.atelier`) disparaît avec le conteneur, exactement le cas à couvrir ;
  - les commits portent déjà l'identifiant par convention (`<prefix>(<scope>): [<ID>] ...`), sont poussés, et disparaissent de la déduction une fois fusionnés par un commit de fusion (ils ne sont plus « propres à la branche » ; pour un squash ou un rebase, voir §4).

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->
- Inclus :
  - `plugins/atelier/lib/core.mjs` :
    - une fonction pure `chantierIdFromCommitSubjects(subjects)` : reçoit les sujets des commits du plus récent au plus ancien et rend l'identifiant du premier qui contient `[<TYPE>-<n>]` (crochets obligatoires, type parmi `FEAT`, `FIX`, `REF`, `TEC`, `SPIKE`, casse ignorée, rendu en majuscules), ou `null` ;
    - `activeChantier(projectRoot, config)` (signature inchangée) rend `{ branch, chantier, source }` : identifiant du nom de branche s'il y en a un (`source: "branch"`) ; sinon, hors branche par défaut, identifiant déduit des commits (`source: "commits"`) ; `source: null` quand aucun chantier n'est trouvé.
  - Partie git de `plugins/atelier/lib/core.mjs` (à côté de `currentBranch`) :
    - `defaultBaseRef(projectRoot)` : première référence existante parmi `refs/remotes/origin/HEAD`, `origin/main`, `origin/master`, `main`, `master` ; `null` si aucune ;
    - `branchCommitSubjects(projectRoot, base)` : sujets de `git log -n 200 --format=%s <base>..HEAD`, du plus récent au plus ancien ; `[]` en cas d'erreur git. La borne évite de lire des milliers de sujets sur une branche longue ; un chantier dont le dernier commit `[<ID>]` est plus ancien que les 200 derniers commits propres n'est pas reconnu ;
    - pas de déduction (comportement actuel) si : aucune base trouvée, HEAD détachée, erreur git, ou branche courante égale à la branche par défaut (nom court de la base résolue, `main` ou `master`). Ce dernier cas couvre un `main` local en avance sur `origin/main`.
  - `plugins/atelier/lib/cli.mjs` : `atelier status --json` expose `chantierSource` à la racine (`"branch"`, `"commits"` ou `null`) ; `formatStatus` et `hook-session-start` ajoutent « (déduit des commits) » après l'identifiant quand la source est `commits`, pour que l'utilisateur ne soit pas surpris.
  - `plugins/atelier/skills/new/SKILL.md` :
    - §1 : « si un chantier est actif » (et non plus « si la branche porte un chantier »), puisqu'il peut venir des commits ;
    - §3 : hors de la branche par défaut, et seulement si le nom de la branche courante ne porte pas d'identifiant (`chantierSource` différent de `"branch"` ; sinon, créer `<type>/<ID>-<slug>` depuis la branche par défaut sans poser la question), demander s'il faut rester sur la branche courante au lieu de créer `<type>/<ID>-<slug>` ; si oui, commiter et pousser le brouillon (même message et même push que le commit du brouillon de TEC-5) dès l'écriture de `spec.md`, avant de remplir la spec et avant `atelier set-tdd` : le chantier n'est reconnu qu'à partir de ce commit `[<ID>]`, et tant qu'il manque, `set-tdd` refuserait (premier chantier de la branche) ou écrirait dans la spec d'un ancien chantier déduit des commits.
  - Tests dans `plugins/atelier/test/core.test.mjs` (toute évolution de hook a son test, `CLAUDE.md`).
  - Site : `site/fondations/chantier.md` (« Le chantier actif ») ; `site/reference/limites.md` pour les limites listées au §4 (squash ou rebase, branches longues, plusieurs chantiers sur une branche imposée) ; `README.md` si une ligne dit que le chantier vient seulement du nom de branche.
- Prérequis : **TEC-5** (commit du brouillon dans `/atelier:new`). Sans lui, sur une branche non conforme, aucun commit `[<ID>]` n'existe avant la signature, donc `atelier set-tdd` et `atelier sign` refusent faute de chantier actif. TEC-6 reste livrable seul (aucun effet sur les branches conformes), mais n'est utile hors branche conforme qu'une fois TEC-5 fusionné. Ordre de fusion recommandé : TEC-5 puis TEC-6. Le commit du brouillon de TEC-5 a lieu en fin de `/atelier:new`, après `set-tdd` : sur une branche imposée, TEC-6 l'avance juste après l'écriture de `spec.md` (voir ci-dessus).
- Hors périmètre :
  - le débrayage (`.atelier/bypass.json`), qui reste lié au nom de branche ;
  - `next-id` : il lit déjà les sujets de commits de toutes les branches (`git log --all`), donc les commits `[<ID>]` d'une branche `claude/...` poussée sont comptés ;
  - un réglage `defaultBranch` dans `.claude/atelier.json` : à ajouter seulement si la résolution automatique échoue en pratique ;
  - la réservation de l'identifiant et le commit du brouillon : traités par TEC-5.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->
- **Branches conformes** (`<type>/<ID>-<slug>`) : aucun changement, le nom de branche reste prioritaire et aucun `git log` n'est lancé.
- **Branches non conformes** : la garde qui bloquait tout le code applique désormais les règles du chantier déduit. Si ce chantier est signé, du code devient modifiable là où il était bloqué : c'est le but, mais c'est un relâchement de la garde, à documenter.
- **Branche par défaut** : jamais de déduction, même si le `main` local est en avance sur `origin/main` (fusion locale non poussée) : on ne code pas sur la branche principale.
- **Branches sans commit propre** : `<base>..HEAD` est vide, donc aucun chantier.
- **Fusion par squash ou rebase** : les commits d'origine restent propres à la branche. Si la session continue sur la même branche imposée après la fusion, l'ancien chantier (`done`) reste actif jusqu'au prochain commit `[<ID>]`. Limite documentée.
- **Branches longues non conformes** (`develop`, `release/*`) : `<base>..HEAD` contient les commits des chantiers déjà fusionnés dedans ; le chantier déduit est le dernier fusionné, souvent clos, et la garde répond « clos » au lieu de « aucun chantier ». L'écriture reste bloquée dans les deux cas. Limite documentée.
- **Plusieurs chantiers sur une même branche imposée** : une branche et une PR pour deux chantiers, contraire à « un chantier, une branche, une PR ». Limite documentée ; recommandation : une session (donc une branche) par chantier.
- **Plusieurs identifiants sur une même branche** (renumérotation, comme TEC-4 → TEC-5) : le plus récent gagne. Un agent pourrait changer de chantier actif en commitant `[<autre ID>]` ; il le peut déjà en changeant de branche, ce n'est pas une nouvelle faille.
- **Branche créée depuis une branche de chantier non fusionnée** : les commits du parent comptent ; sans commit propre, c'est le chantier du parent. Acceptable et documenté.
- **Performance** : seulement sur une branche non conforme, par appel de hook : jusqu'à 5 `git rev-parse` pour trouver la base (arrêt au premier candidat trouvé), 1 `git log` borné à 200 sujets, et 1 `git rev-parse --abbrev-ref` si la base est `origin/HEAD`. `refs/remotes/origin/HEAD` est absent des clones cloud (constaté ici), d'où la liste de repli.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
- `npm test` vert, avec des tests dans `plugins/atelier/test/core.test.mjs` :
  - V-1 : `chantierIdFromCommitSubjects` rend l'identifiant du commit le plus récent qui en porte un (`['wip', 'docs(chantiers): [TEC-5] spec draft', 'docs(chantiers): [TEC-4] spec draft']` → `TEC-5`) ;
  - V-2 : crochets obligatoires (`'merge after FEAT-4'` → `null`), casse ignorée (`'[feat-12]'` → `FEAT-12`), type inconnu ignoré (`'[JIRA-3]'` → `null`), liste vide → `null` ;
  - V-3 : un dépôt git temporaire (`mkdtemp`, `git init`) avec une branche par défaut `main` et une branche `claude/x` portant un commit `[TEC-9]` et un dossier `docs/chantiers/TEC-9-x/` : `activeChantier` rend `TEC-9` avec la source `commits` ; sur `main`, aucun chantier ; sur `tec/TEC-8-y` portant un commit `[TEC-9]`, `TEC-8` avec la source `branch` ;
  - V-4 : même dépôt sans branche par défaut identifiable : aucun chantier, sans erreur ;
  - V-5 : dépôt avec une origine (dépôt nu local) et un `main` local en avance sur `origin/main` d'un commit `[TEC-9]` : sur `main`, aucun chantier ;
  - V-6 : `formatStatus` affiche « (déduit des commits) » quand `chantierSource` vaut `commits`, et ne l'affiche pas pour `branch`.
  - V-7 : dépôt avec une origine et `refs/remotes/origin/HEAD` vers `origin/main` (`git remote set-head`) : sur `claude/x` portant un commit `[TEC-9]`, `activeChantier` rend `TEC-9` avec la source `commits` ;
  - V-8 : `refs/remotes/origin/HEAD` vers une autre branche que `main` (ex. `origin/develop`) : sur `develop`, aucun chantier ; sur `claude/x` créée depuis `develop` avec un commit `[TEC-9]`, `TEC-9` avec la source `commits` ;
  - V-9 : branche non conforme sans commit propre (`<base>..HEAD` vide) : aucun chantier, source `null`.
  - V-10 : garde d'écriture (`hook-guard`) sur `claude/x` avec un chantier déduit des commits : écriture d'un fichier de code refusée quand sa spec est en brouillon, autorisée quand elle est signée avec `tdd: no`.
- Essai manuel dans ce dépôt, sur une branche `claude/...` portant un commit `[TEC-6]` : `atelier status` affiche TEC-6 et sa source.
- Essai manuel de `/atelier:new` dans un dépôt de test, sur une branche `claude/...` (avec et sans commit `[<ID>]` d'un chantier précédent) : le brouillon est commité avant `set-tdd`, et `set-tdd` écrit dans la spec du nouveau chantier.
- `claude plugin validate ./plugins/atelier` passe ; `npm run build` dans `site/` passe.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
`git revert` du merge : on revient à la seule lecture du nom de branche. Aucun état ni donnée à migrer.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-20 : §3 et §4, `git log` borné à 200 sujets et coût git réel décrit (jusqu'à 5 `rev-parse` pour trouver la base, 1 `log`, 1 `rev-parse --abbrev-ref` si la base est `origin/HEAD`) ; §5, ajout de V-7 à V-9 (déduction via `origin/HEAD`, `origin/HEAD` vers une autre branche que `main`, branche sans commit propre). Pourquoi : la revue a relevé une sortie de `git log` non bornée, un coût sous-estimé et trois cas réels sans test.
- 2026-11-20 : tests rouverts (gel quitté : 24b4134) : spec amendée (d0ca34d) : ajout de V-7 à V-9, relevés par la revue
- 2026-11-20 : tests regelés : 2e6ddb1
- 2026-11-20 : tests rouverts (gel quitté : 2e6ddb1) : intégration de TEC-5 depuis main (ab8398c) : la fusion apporte les tests de TEC-5
- 2026-11-20 : tests regelés : af0da4a
- 2026-11-20 : §3 et Prérequis, sur une branche imposée `/atelier:new` commite et pousse le brouillon dès l'écriture de `spec.md`, avant `set-tdd` ; §5, ajout de V-10 (garde d'écriture sur un chantier déduit des commits) et de l'essai manuel de `/atelier:new` sur une branche `claude/...`. Pourquoi : revue tour 2, `set-tdd` (§5 du skill) passait avant le commit du brouillon (§7) : refus sur un premier chantier, écriture dans la spec de l'ancien chantier sinon ; et aucun test ne passait par le hook d'écriture.
- 2026-11-20 : tests rouverts (gel quitté : af0da4a) : spec amendée : ajout de V-10 (garde d'écriture sur un chantier déduit des commits), relevé par la revue tour 2
- 2026-11-20 : tests regelés : 2dd24e6
- 2026-11-20 : §3, `/atelier:new` ne propose de rester sur la branche courante que si son nom ne porte pas d'identifiant (`chantierSource` différent de `"branch"`) ; sinon il crée `<type>/<ID>-<slug>` depuis la branche par défaut. Pourquoi : revue tour 3, sur la branche conforme d'un autre chantier le nom de branche reste prioritaire, et `set-tdd` écrivait dans la spec de cet autre chantier.
