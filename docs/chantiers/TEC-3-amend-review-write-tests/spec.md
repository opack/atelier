---
id: TEC-3
type: TEC
title: Amender la spec, rouvrir les tests, séparer revue et clôture
status: signed
tdd: no
created_at: 2026-11-20
signed_by: Opack
signed_at: 2026-11-20
reviewed_commit: f0ecc017d46166240c6b8d4f1bbb5b58ccc06b1a
---

# TEC-3 Amender la spec, rouvrir les tests, séparer revue et clôture

## 1. Quoi
Faire évoluer le cycle du plugin atelier :
- renommer `/atelier:tests` en `/atelier:write-tests`, relançable à tout moment ;
- ajouter `/atelier:amend` pour modifier une spec signée, avec un hook qui l'impose ;
- séparer `/atelier:review` (revue, traitement des points, autant de tours que nécessaire) de `/atelier:close` (vérification déterministe, bilan, verdict) ;
- mettre à jour `nextStep`, `atelier status`, le README et le site, avec un schéma SVG du cycle complet.

Cycle résultant : `new → sign → (plan) → (write-tests) → build ⇄ review → close`, `amend` pouvant ramener à `write-tests` ou à `build`. Commandes : `init, new, sign, amend, plan, write-tests, build, review, close, status, off`.

## 2. Pourquoi
- `/atelier:tests` laisse croire qu'on exécute des tests.
- Rien n'outille aujourd'hui les deux situations les plus courantes après la signature : une spec qui s'avère fausse ou incomplète, et un test oublié ou faux. L'amendement repose sur la discipline, et rien ne vérifie qu'une édition de spec signée est tracée.
- `/atelier:close` mélange revue et clôture : les corrections issues de la revue se font dans la clôture, et rien ne garantit que le code clôturé est celui qui a été relu.

## 3. Périmètre
- Inclus :
  - plugin : skills `write-tests` (ex-`tests`), `amend`, `review`, `close` ; mises à jour de `build`, `plan`, `sign`, `status`, `new` ; CLI ; hook de garde ; template `revue.md` ; version 0.2.0 (`npm run version:minor`) ;
  - site : cycle, référence des commandes, hooks et configuration, templates (inclusion de `revue.md`), en-tête de spec, glossaire, démarrage rapide, schéma SVG dans « Vue d'ensemble du cycle » ; `README.md` ;
  - documentation : où et comment lancer les commandes (voir §4, « Lancer les commandes »).
- Hors périmètre :
  - empêcher les écritures par le shell (limite connue de TEC-1, §5) ;
  - vérifier que la re-signature d'un amendement vient bien de l'humain (même limite que `atelier sign`) ;
  - la dette de TEC-1 sans rapport (budget du hook de fin, casse sous macOS, frontière `core` / `cli`).
- `tdd: no` : chantier d'outillage. Les tests de `plugins/atelier/test/` sont écrits avec le code, comme pour TEC-1 ; toute évolution de hook a son test (`CLAUDE.md`).

## 4. Comportement

### `/atelier:write-tests`
- Phase `writing-tests` : comportement actuel de `/atelier:tests`.
- Tests déjà figés (`tests_commit` renseigné) : demande la raison, puis `atelier reopen-tests <raison>`, écrit / modifie / supprime les tests, vérifie que les nouveaux échouent pour la bonne raison, fait relire et commiter (`test(<scope>): [<ID>] …`), puis `atelier freeze-tests`.
- Règles affichées par le skill :
  - **ajouter** un test (cas oublié, remarque de revue) est normal ;
  - **modifier** un test existant seulement s'il était faux ou si la spec a été amendée ;
  - **supprimer** un test seulement si un critère a disparu, donc après un amendement.
- `atelier reopen-tests` refuse un chantier qui n'est pas en `tdd: yes` ou dont les tests ne sont pas figés.
- Traçabilité dans la spec, avec des libellés fixes :
  - `reopen-tests` ajoute l'entrée `- AAAA-MM-JJ : tests rouverts (gel quitté : <hash>) : <raison>` ;
  - `freeze-tests` ajoute l'entrée `- AAAA-MM-JJ : tests regelés : <hash>` quand il s'agit d'un regel. Un regel se reconnaît **par la position** : la dernière entrée commençant par « tests rouverts » se trouve après la dernière entrée commençant par « tests regelés » (ou il n'y a aucune entrée « tests regelés »). Une entrée « tests rouverts » à l'ancien format (`tests rouverts : <raison>`, avant 0.2.0) est reconnue aussi. Un premier gel n'ajoute pas d'entrée. Le signal est déterministe et se lit dans la spec, sans champ supplémentaire.
- **Commit des écritures de la CLI** : toute commande qui écrit dans la spec (`reopen-tests`, `freeze-tests`, `set-tdd`) est immédiatement suivie, dans le skill qui la lance, d'un commit de la spec seule : `docs(chantiers): [<ID>] <reopen tests | freeze tests | set tdd>`. Aucune entrée de la CLI ne reste en attente.
- `tdd: no` : pas de phase ni de gel ; le skill le dit et renvoie vers `/atelier:build`.

### `/atelier:amend <ce qui change>`
1. Modifie la spec signée par éditions ciblées, en ajoutant d'abord une entrée datée dans « Amendements » (quoi, pourquoi).
2. Montre l'impact : critères ajoutés, modifiés, supprimés (pour un TEC : points de vérification).
3. Redemande l'**accord explicite** de l'utilisateur (petite re-signature), puis commite `docs(chantiers): [<ID>] amend spec`. Ce commit est la trace de la re-signature : `signed_by` et `signed_at` restent ceux de la signature initiale. Sans accord : les modifications de la spec sont annulées (`git checkout -- spec.md`). Pour que cette annulation ne perde rien d'autre, le skill exige au départ une spec sans changement non commité.
4. En TDD, si des critères ont bougé : `atelier reopen-tests <raison>` puis `/atelier:write-tests`. Sinon, retour à `/atelier:build` ou `/atelier:review`.
- Frontière documentée : corriger une erreur ou faire un petit ajout est un amendement ; si le périmètre grossit vraiment, c'est un **nouveau chantier**.

### Garde d'écriture : spec non brouillon
Ajout à la règle 4 (« En-tête de spec ») de TEC-1 §4, sans changer l'ordre des règles ni leur caractère fail-closed.
- **Quand** : dès que la spec n'est pas en `draft`, que ce soit dans le fichier actuel ou dans sa version commitée (`HEAD`). Un `Write` complet est refusé dans ce cas, `abandoned` compris.
- Trois ensembles de champs, chacun comparé à sa base :
  - **comparés au fichier actuel, non modifiables par l'outil d'édition** : les champs réservés (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`, et le nouveau `reviewed_commit`) comme aujourd'hui ; `tdd`, qui ne change que par `atelier set-tdd` ; `id` et `type`, figés après signature (liés à la branche, au dossier et à la prochaine étape) ;
  - **comparés à la référence** : tous les autres champs d'en-tête (`title`…) et le corps.
- **Référence** : la version commitée si elle existe et n'est pas en `draft`, sinon le fichier actuel. On peut ainsi écrire d'abord l'entrée d'amendement, puis modifier le corps en plusieurs éditions. Le chemin de la spec dans `HEAD` est résolu via `git ls-files` (insensible à la casse sous Windows et macOS) avant `git show`. Spec absente de `HEAD` : le fichier actuel sert de référence ; toute autre erreur git : refus.
- **Règle** : si le corps (hors section « Amendements ») ou un des champs comparés à la référence en diffère, la section « Amendements » doit compter au moins une **nouvelle entrée** par rapport à la référence. Les entrées de la référence forment un **préfixe exact** de la liste proposée : on ne fait qu'ajouter, à la fin.
- **Section** : une seule section de titre exact `## Amendements`. Une section en double est refusée ; une section renommée compte comme absente (et son ancien contenu comme du corps modifié).
- **Entrée** : une ligne de liste de premier niveau `- AAAA-MM-JJ : …` (date au bon format, pas forcément du jour), avec ses lignes de suite indentées. Les commentaires HTML sont ignorés dans la section « Amendements » seulement ; une section absente compte pour zéro entrée et peut être créée par l'amendement ; tout autre texte de la section compte comme du corps.
- Fins de ligne normalisées des deux côtés. Une édition invérifiable (texte introuvable, référence illisible) est refusée, comme aujourd'hui.
- **Ce que la règle garantit** : toute modification de la spec signée laisse une trace datée. Elle ne vérifie pas que l'entrée décrit bien la modification. C'est la re-signature humaine qui juge le contenu. Les entrées de la CLI étant commitées aussitôt, elles ne servent pas de passe-droit pour une édition ultérieure du corps.
- Une modification non commitée du corps sans entrée, même faite par l'humain, bloque les éditions suivantes de l'agent jusqu'à son commit ou l'ajout d'une entrée. Le message de refus le dit.
- **`atelier set-status draft`** est refusé sur une spec `signed`, `done` ou `abandoned`. Sinon, il suffirait de repasser en brouillon pour éditer librement, puis de re-signer. Une signature faite par erreur se traite par `abandoned` puis un nouveau chantier ; c'est documenté dans le site.
- **Position des entrées** : la CLI ajoute ses entrées à la fin de la section « Amendements », où qu'elle soit dans le fichier, au lieu de la fin du fichier. Elle crée la section si elle manque.

### Revue : `/atelier:review`
1. Contrôles : spec signée, `atelier checks` vert, en TDD tests figés et inchangés (`atelier tests-changed`), travail commité.
2. Revue par le sous-agent `reviewer` (base : `git merge-base HEAD <branche par défaut>`).
3. Traitement de chaque point : correction via `/atelier:build`, test manquant via `/atelier:write-tests`, spec fausse via `/atelier:amend`, ou exception acceptée explicitement par l'utilisateur. Relance jusqu'à **zéro point bloquant**.
4. Résultat consigné dans `revue.md` (dossier du chantier, nouveau template) : un tour par section, avec la date, le commit revu, les points et leur traitement.
5. `atelier set-reviewed` écrit `reviewed_commit` (hash complet de `HEAD`) dans l'en-tête de la spec, puis commit `docs(chantiers): [<ID>] review`. `set-reviewed` refuse sans spec signée, avec du code non commité, avec des changements non commités de `spec.md`, ou en TDD si les tests ne sont pas figés ou ont changé depuis leur gel.
- `reviewed_commit` est un champ **réservé** : ajouté à `status`, `signed_by`, `signed_at`, `done_at`, `tests_commit` dans la garde.

### Clôture : `/atelier:close`
- `atelier close-check` vérifie, de façon déterministe :
  - spec signée ;
  - `reviewed_commit` renseigné et ancêtre de `HEAD` (sinon, par exemple après un rebase : nouvelle revue) ;
  - **aucun commit de code** depuis `reviewed_commit` : aucun fichier hors des chemins libres, de `chantiersDir` et de `.atelier/` touché par un commit de `reviewed_commit..HEAD`. Liste obtenue par `git log --name-only -z --no-renames --diff-merges=first-parent` (les commits de fusion, résolutions de conflit comprises, sont inspectés ; un renommage apparaît comme suppression de l'ancien chemin plus ajout du nouveau), comparée avec `matchesAny` et `ignoreCase`. Pour cette vérification, `.claude/**` n'est **pas** un chemin libre (on ne doit pas pouvoir affaiblir les contrôles ou les hooks après la revue). Les tests comptent comme du code. Une fusion de la branche par défaut après la revue en apporte aussi, et impose donc une nouvelle revue ;
  - **aucun amendement** depuis la revue : les entrées de « Amendements » de la spec actuelle sont les mêmes qu'au commit revu (le code a été relu contre cette version de la spec) ;
  - aucun changement de code non commité ;
  - en TDD, tests figés ;
  - contrôles de `.claude/atelier.json` verts.

  En cas d'échec : liste des problèmes, code de sortie non nul, renvoi vers `/atelier:review`.
- `atelier set-status done` applique les mêmes vérifications et refuse si l'une échoue. Le skill lance `close-check` juste avant `set-status done` (après le verdict humain), pas au début : pas de cache de résultat.
- `reviewed_commit` introuvable (objet supprimé après rebase et `gc`) ou toute erreur git en l'évaluant : la revue est **obsolète**, sans plantage.
- Exception : un `SPIKE` (code jetable, non fusionné) ignore **toutes** les vérifications liées à la revue (revue présente, ancêtre, commits de code, amendements depuis la revue), même si `reviewed_commit` est renseigné ; les autres vérifications s'appliquent.
- Un chantier mené en débrayage doit avoir sa spec écrite et signée avant `close`, comme aujourd'hui.
- Puis : bilan (qui reprend `revue.md`), verdict humain, `done`, proposition de PR. Le skill ne fait plus la revue.

### Prochaine étape et état
- `nextStep` reste pure : la CLI lui passe l'état de la revue (absente, à jour, obsolète), calculé par les mêmes fonctions que `close-check` sans lancer les contrôles. Ordre : `new → sign → (plan) → (write-tests) → build → review → close`. Après une revue, l'étape suivante est `close` si la revue est à jour, sinon `review`. Un `SPIKE` va de `build` à `close`.
- `atelier status` affiche `reviewed_commit` et indique si du code a changé depuis ; le rappel de début de session suit. `status --json` expose, dans `chantier`, `reviewedCommit` (hash ou `null`) et `reviewState` (`none` | `current` | `stale`) ; les skills lisent ces champs.
- Logique de décision (garde, clôture, prochaine étape, entrées d'amendement) dans `lib/core.mjs`, en fonctions pures testées ; `lib/cli.mjs` ne fait que lire, exécuter et afficher.

### Lancer les commandes (documentation)
Le README, le démarrage rapide et la référence des commandes disent clairement qu'atelier est un plugin Claude Code : ses commandes `/atelier:*` se lancent **dans une session Claude Code ouverte sur le répertoire du projet**, pas dans un terminal. La documentation ne décrit pas d'autre mode de lancement.

## 5. Impacts indirects
- Projets existants : `/atelier:tests` disparaît au profit de `/atelier:write-tests` ; un chantier signé avant cette version et non clôturé doit passer par `/atelier:review` avant `/atelier:close`.
- Une édition de spec signée sans entrée d'amendement, autorisée jusque-là, est refusée.
- `atelier set-status done` lance les contrôles du projet : la clôture peut prendre le temps de la suite de tests.
- Un rebase après la revue impose une nouvelle revue (le commit revu n'est plus un ancêtre).
- Amorçage : TEC-3 lui-même sera clôturé avec la version 0.1.1 ou 0.2.0 du plugin. Le choix (et donc l'exigence ou non de `reviewed_commit` pour ce chantier) est tranché dans `plan.md`.

## 6. Vérification
- `npm test` vert, avec des tests pour :
  - la garde sur une spec non brouillon :
    - refusés : corps modifié sans nouvelle entrée, `title` modifié sans entrée, entrée non datée, entrée existante modifiée ou supprimée, entrée insérée avant une entrée existante, section « Amendements » en double, `id`, `type` ou `tdd` modifiés, `Write` sur une spec `abandoned`, `Write` sur une spec supprimée du disque mais signée dans `HEAD`, `reviewed_commit` modifié, erreur git sur la référence ;
    - acceptés : corps modifié avec une nouvelle entrée datée, y compris en plusieurs éditions par rapport à la référence commitée, section « Amendements » créée, chemin de spec de casse différente de l'index ;
    - fins de ligne CRLF ; spec en brouillon dans `HEAD` et dans le fichier : libre ;
  - la décision de clôture :
    - refusée : sans revue, commit de code ou de test après la revue, résolution de conflit dans une fusion après la revue, fichier de code renommé vers un chemin libre après la revue, modification de `.claude/atelier.json` après la revue, code non commité, commit revu non ancêtre, commit revu introuvable, amendement après la revue, contrôles rouges, TDD non figé ;
    - acceptée : cas nominal, `SPIKE` sans revue, `SPIKE` revu puis modifié, commits de documentation après la revue ;
  - les refus de `reopen-tests` (hors TDD, tests non figés), de `set-reviewed` (spec non signée, code non commité, `spec.md` non commitée, tests non figés ou modifiés) et de `set-status draft` (spec non brouillon) ;
  - la prochaine étape et `reviewState` : `write-tests`, `review`, `close`, revue obsolète, commit revu introuvable, `SPIKE` ;
  - l'ajout d'entrées dans la section « Amendements » (section au milieu du fichier, section absente) et la détection d'un regel (premier gel sans entrée, regel, entrée « tests rouverts » à l'ancien format, deux entrées le même jour départagées par la position).
- `claude plugin validate .` et `claude plugin validate ./plugins/atelier` sans erreur.
- `npm run build` dans `site/` sans erreur ni lien mort ; schéma SVG vérifié par capture Playwright en thème clair et sombre (bureau et mobile).
- Rejeu de bout en bout de la CLI et des hooks sur un dépôt jetable, consigné dans le bilan :
  - amendement : édition de corps refusée sans entrée, acceptée après ajout de l'entrée, entrée existante modifiée refusée ;
  - réouverture : `reopen-tests` sur des tests figés, implémentation refusée pendant la réécriture, regel tracé dans la spec ;
  - revue puis clôture : `close-check` et `set-status done` refusés après un commit de code postérieur à `set-reviewed`, acceptés sinon ; `reviewed_commit` non modifiable par l'outil d'édition.
- Aucune référence restante à `/atelier:tests` dans le plugin, le README et le site.
## 7. Retour arrière
Revenir à la version 0.1.1 du plugin (revert de la fusion, puis `npm run version:patch`). Les champs `reviewed_commit` et les fichiers `revue.md` déjà écrits sont ignorés par l'ancienne version.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-20 : « sort » remplacé par « traitement » pour ce qui est fait de chaque point de revue (§4 Revue, point 4), « sort » étant ambigu et peu clair.
