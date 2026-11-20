---
id: TEC-6
type: TEC
title: Reconnaître un chantier hors branche <type>/<ID>-<slug>
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-20
signed_by:
signed_at:
---

# TEC-6 Reconnaître un chantier hors branche <type>/<ID>-<slug>

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
Quand le nom de la branche courante ne porte pas d'identifiant de chantier, `activeChantier` déduit le chantier actif des commits propres à la branche : l'identifiant `[<ID>]` du commit le plus récent qui en porte un, entre la branche par défaut et `HEAD`. Le nom de branche, s'il porte un identifiant, reste prioritaire.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- `activeChantier` (`plugins/atelier/lib/core.mjs`) ne lit que le nom de la branche (`chantierIdFromText(branch)`), selon la convention `<type>/<ID>-<slug>`.
- Une session Claude Code cloud impose sa branche (ex. `claude/beautiful-carson-5fbgwy`), la seule sur laquelle l'agent peut pousser. Sur cette branche, atelier ne voit aucun chantier : `atelier status` propose `/atelier:new`, les skills qui exigent un chantier actif refusent, et la garde d'écriture bloque tout le code comme sur `main`.
- Contournement utilisé pour TEC-5 : une branche locale `tec/TEC-5-...` poussée vers `claude/...`. Il est fragile : un conteneur relancé repart de `claude/...`, donc sans chantier, et il faut connaître l'astuce.
- La même contrainte existe hors du cloud : convention de branche imposée par une équipe, un outil de ticket ou une CI (`feature/JIRA-123`, `users/<nom>/...`).
- Pourquoi les commits plutôt qu'un fichier ou un réglage :
  - un fichier versionné qui nomme le chantier serait fusionné dans `main` avec la PR, et `main` aurait un chantier actif ;
  - un réglage local (`git config branch.<nom>.atelier`) disparaît avec le conteneur, exactement le cas à couvrir ;
  - les commits portent déjà l'identifiant par convention (`<prefix>(<scope>): [<ID>] ...`), sont poussés, et disparaissent de la déduction une fois fusionnés (ils ne sont plus « propres à la branche »).

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->
- Inclus :
  - `plugins/atelier/lib/core.mjs` :
    - une fonction pure `chantierIdFromCommitSubjects(subjects)` : reçoit les sujets des commits du plus récent au plus ancien et rend l'identifiant du premier qui contient `[<TYPE>-<n>]` (crochets obligatoires, type parmi `FEAT`, `FIX`, `REF`, `TEC`, `SPIKE`, casse ignorée, rendu en majuscules), ou `null` ;
    - `activeChantier` : identifiant du nom de branche s'il y en a un ; sinon identifiant déduit des commits ; rend aussi la source (`branch` ou `commits`).
  - `plugins/atelier/lib/cli.mjs` (ou la partie git de `core.mjs`, comme `currentBranch` aujourd'hui) : lecture des sujets de commits `git log --format=%s <base>..HEAD`, où `<base>` est la branche par défaut résolue dans cet ordre : `refs/remotes/origin/HEAD`, `origin/main`, `origin/master`, `main`, `master`. Aucune base trouvée, HEAD détachée ou erreur git : pas de déduction (comportement actuel).
  - `atelier status` (texte et `--json`) et `hook-session-start` : indiquent que le chantier est déduit des commits (`chantierSource: "commits"`), pour que l'utilisateur ne soit pas surpris.
  - `plugins/atelier/skills/new/SKILL.md` §3 : si la branche courante est imposée par l'environnement (l'utilisateur ou les consignes de session l'indiquent), rester dessus au lieu de créer `<type>/<ID>-<slug>` ; la déduction se fait dès le premier commit `[<ID>]`, donc le brouillon doit être commité (règle que TEC-5 rend systématique).
  - Tests dans `plugins/atelier/test/core.test.mjs` (toute évolution de hook a son test, `CLAUDE.md`).
  - Site : `site/fondations/chantier.md` (« Le chantier actif »), `site/reference/limites.md` si la déduction ouvre une limite ; `README.md` si une ligne dit que le chantier vient seulement du nom de branche.
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
- **`main` et branches sans commit propre** : `<base>..HEAD` est vide, donc toujours aucun chantier : on ne code pas sur la branche principale.
- **Plusieurs identifiants sur une même branche** (renumérotation, comme TEC-4 → TEC-5) : le plus récent gagne. Un agent pourrait changer de chantier actif en commitant `[<autre ID>]` ; il le peut déjà en changeant de branche, ce n'est pas une nouvelle faille.
- **Branche créée depuis une branche de chantier non fusionnée** : les commits du parent comptent ; sans commit propre, c'est le chantier du parent. Acceptable et documenté.
- **Performance** : un `git log` borné de plus par appel de hook, seulement sur une branche non conforme. `refs/remotes/origin/HEAD` est absent des clones cloud (constaté ici), d'où la liste de repli.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
- `npm test` vert, avec des tests dans `plugins/atelier/test/core.test.mjs` :
  - V-1 : `chantierIdFromCommitSubjects` rend l'identifiant du commit le plus récent qui en porte un (`['wip', 'docs(chantiers): [TEC-5] spec draft', 'docs(chantiers): [TEC-4] spec draft']` → `TEC-5`) ;
  - V-2 : crochets obligatoires (`'merge after FEAT-4'` → `null`), casse ignorée (`'[feat-12]'` → `FEAT-12`), type inconnu ignoré (`'[JIRA-3]'` → `null`), liste vide → `null` ;
  - V-3 : un dépôt git temporaire (`mkdtemp`, `git init`) avec une branche par défaut `main` et une branche `claude/x` portant un commit `[TEC-9]` et un dossier `docs/chantiers/TEC-9-x/` : `activeChantier` rend `TEC-9` avec la source `commits` ; sur `main`, aucun chantier ; sur `tec/TEC-8-y` portant un commit `[TEC-9]`, `TEC-8` avec la source `branch` ;
  - V-4 : même dépôt sans branche par défaut identifiable : aucun chantier, sans erreur.
- Essai manuel dans ce dépôt, sur une branche `claude/...` portant un commit `[TEC-6]` : `atelier status` affiche TEC-6 et sa source.
- `claude plugin validate ./plugins/atelier` passe ; `npm run build` dans `site/` passe.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
`git revert` du merge : on revient à la seule lecture du nom de branche. Aucun état ni donnée à migrer.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
