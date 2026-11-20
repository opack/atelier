---
id: TEC-3
type: TEC
title: Amender la spec, rouvrir les tests, séparer revue et clôture
status: draft
tdd: no
created_at: 2026-11-20
signed_by:
signed_at:
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
- Traçabilité dans la spec :
  - `reopen-tests` ajoute une entrée d'amendement « tests rouverts » (raison, commit de gel quitté) ;
  - `freeze-tests` ajoute une entrée « tests regelés » (nouveau commit de gel) quand il s'agit d'un regel. Un regel se reconnaît à une entrée « tests rouverts » plus récente que la dernière entrée « tests regelés ». Le signal est déterministe et se lit dans la spec, sans champ supplémentaire.
- `tdd: no` : pas de phase ni de gel ; le skill le dit et renvoie vers `/atelier:build`.

### `/atelier:amend <ce qui change>`
1. Modifie la spec signée par éditions ciblées, en ajoutant d'abord une entrée datée dans « Amendements » (quoi, pourquoi).
2. Montre l'impact : critères ajoutés, modifiés, supprimés (pour un TEC : points de vérification).
3. Redemande l'**accord explicite** de l'utilisateur (petite re-signature), puis commite `docs(chantiers): [<ID>] amend spec`. Sans accord : les modifications de la spec sont annulées (`git checkout -- spec.md`). Pour que cette annulation ne perde rien d'autre, le skill exige au départ une spec sans changement non commité.
4. En TDD, si des critères ont bougé : `atelier reopen-tests <raison>` puis `/atelier:write-tests`. Sinon, retour à `/atelier:build` ou `/atelier:review`.
- Frontière documentée : corriger une erreur ou faire un petit ajout est un amendement ; si le périmètre grossit vraiment, c'est un **nouveau chantier**.

### Garde d'écriture : spec non brouillon
Ajout à la règle 4 (« En-tête de spec ») de TEC-1 §4, sans changer l'ordre des règles ni leur caractère fail-closed.
- **Quand** : dès que la spec n'est pas en `draft`, que ce soit dans le fichier actuel ou dans sa version commitée (`HEAD`). Un `Write` complet est refusé dans ce cas, `abandoned` compris.
- **Champs réservés** (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`, et le nouveau `reviewed_commit`) : comparés au fichier actuel, comme aujourd'hui. `tdd` ne change toujours que par `atelier set-tdd`. `id` et `type` ne changent plus après signature (liés à la branche, au dossier et à la prochaine étape).
- **Corps et autres champs d'en-tête** (`title`…) : comparés à une **référence**, la version commitée si elle existe et n'est pas en `draft`, sinon le fichier actuel. On peut ainsi écrire d'abord l'entrée d'amendement, puis modifier le corps en plusieurs éditions. Spec absente de `HEAD` : le fichier actuel sert de référence ; erreur git : refus.
- **Règle** : si le corps (hors section « Amendements ») ou un de ces champs diffère de la référence, la section « Amendements » doit compter au moins une **nouvelle entrée** par rapport à la référence. Les entrées de la référence restent intactes et dans l'ordre : on ne fait qu'ajouter.
- **Entrée** : une ligne de liste de premier niveau `- AAAA-MM-JJ : …` (date au bon format, pas forcément du jour), avec ses lignes de suite indentées. Les commentaires HTML sont ignorés ; une section absente compte pour zéro entrée et peut être créée par l'amendement ; tout autre texte de la section compte comme du corps.
- Fins de ligne normalisées des deux côtés. Une édition invérifiable (texte introuvable, référence illisible) est refusée, comme aujourd'hui.
- **Ce que la règle garantit** : toute modification de la spec signée laisse une trace datée. Elle ne vérifie pas que l'entrée décrit bien la modification. Une entrée ajoutée par la CLI (`reopen-tests`, `set-tdd`) et pas encore commitée suffit aussi. C'est la re-signature humaine qui juge le contenu.
- Une modification non commitée du corps sans entrée, même faite par l'humain, bloque les éditions suivantes de l'agent jusqu'à son commit ou l'ajout d'une entrée. Le message de refus le dit.
- **`atelier set-status draft`** est refusé sur une spec `signed`, `done` ou `abandoned`. Sinon, il suffirait de repasser en brouillon pour éditer librement, puis de re-signer.
- **Position des entrées** : la CLI ajoute ses entrées à la fin de la section « Amendements », où qu'elle soit dans le fichier, au lieu de la fin du fichier. Elle crée la section si elle manque.

### Revue : `/atelier:review`
1. Contrôles : spec signée, `atelier checks` vert, en TDD tests figés et inchangés (`atelier tests-changed`), travail commité.
2. Revue par le sous-agent `reviewer` (base : `git merge-base HEAD <branche par défaut>`).
3. Traitement de chaque point : correction via `/atelier:build`, test manquant via `/atelier:write-tests`, spec fausse via `/atelier:amend`, ou exception acceptée explicitement par l'utilisateur. Relance jusqu'à **zéro point bloquant**.
4. Résultat consigné dans `revue.md` (dossier du chantier, nouveau template) : un tour par section, avec la date, le commit revu, les points et leur sort.
5. `atelier set-reviewed` écrit `reviewed_commit` (hash complet de `HEAD`) dans l'en-tête de la spec, puis commit `docs(chantiers): [<ID>] review`. `set-reviewed` refuse sans spec signée, avec du code non commité, ou en TDD si les tests ne sont pas figés ou ont changé depuis leur gel.
- `reviewed_commit` est un champ **réservé** : ajouté à `status`, `signed_by`, `signed_at`, `done_at`, `tests_commit` dans la garde.

### Clôture : `/atelier:close`
- `atelier close-check` vérifie, de façon déterministe :
  - spec signée ;
  - `reviewed_commit` renseigné et ancêtre de `HEAD` (sinon, par exemple après un rebase : nouvelle revue) ;
  - **aucun commit de code** depuis `reviewed_commit` : aucun fichier hors des chemins libres, de `chantiersDir` et de `.atelier/` touché par un commit de `reviewed_commit..HEAD` (`git log --name-only`). Les tests comptent comme du code. Une fusion de la branche par défaut après la revue en apporte aussi, et impose donc une nouvelle revue ;
  - **aucun amendement** depuis la revue : les entrées de « Amendements » de la spec actuelle sont les mêmes qu'au commit revu (le code a été relu contre cette version de la spec) ;
  - aucun changement de code non commité ;
  - en TDD, tests figés ;
  - contrôles de `.claude/atelier.json` verts.

  En cas d'échec : liste des problèmes, code de sortie non nul, renvoi vers `/atelier:review`.
- `atelier set-status done` applique les mêmes vérifications et refuse si l'une échoue.
- Exception : un `SPIKE` (code jetable, non fusionné) n'exige pas de revue (`set-reviewed` y reste possible) ; les autres vérifications s'appliquent.
- Un chantier mené en débrayage doit avoir sa spec écrite et signée avant `close`, comme aujourd'hui.
- Puis : bilan (qui reprend `revue.md`), verdict humain, `done`, proposition de PR. Le skill ne fait plus la revue.

### Prochaine étape et état
- `nextStep` reste pure : la CLI lui passe l'état de la revue (absente, à jour, obsolète), calculé par les mêmes fonctions que `close-check` sans lancer les contrôles. Ordre : `new → sign → (plan) → (write-tests) → build → review → close`. Après une revue, l'étape suivante est `close` si la revue est à jour, sinon `review`. Un `SPIKE` va de `build` à `close`.
- `atelier status` affiche `reviewed_commit` et indique si du code a changé depuis ; le rappel de début de session suit.
- Logique de décision (garde, clôture, prochaine étape, entrées d'amendement) dans `lib/core.mjs`, en fonctions pures testées ; `lib/cli.mjs` ne fait que lire, exécuter et afficher.

### Lancer les commandes (documentation)
Le README, le démarrage rapide et la référence des commandes disent clairement :
- les commandes `/atelier:*` se tapent **dans une conversation Claude Code**, pas dans un terminal ;
- la CLI `atelier` n'est sur le `PATH` que du shell de Claude Code (outil Bash de l'agent), pas du terminal de l'utilisateur. Hors de Claude Code, elle se lance avec `node <dossier du plugin>/bin/atelier <commande>` (plugin installé : `~/.claude/plugins/cache/atelier/atelier/<version>/`) ;
- **en une fois** (démarrage de session + commande) : `claude "/atelier:status"` ouvre une session interactive qui lance la commande ; `claude -p "/atelier:status"` l'exécute sans session interactive et affiche le résultat. Pour une commande qui demande une confirmation (`sign`, `amend`, `close`), on répond par `claude -p "oui" --continue`, ou on préfère la session interactive ;
- la documentation n'affirme que ce qui a été vérifié (ou ce que la documentation de Claude Code garantit) ; le reste est signalé comme non vérifié.

## 5. Impacts indirects
- Projets existants : `/atelier:tests` disparaît au profit de `/atelier:write-tests` ; un chantier signé avant cette version et non clôturé doit passer par `/atelier:review` avant `/atelier:close`.
- Une édition de spec signée sans entrée d'amendement, autorisée jusque-là, est refusée.
- `atelier set-status done` lance les contrôles du projet : la clôture peut prendre le temps de la suite de tests.
- Un rebase après la revue impose une nouvelle revue (le commit revu n'est plus un ancêtre).

## 6. Vérification
- `npm test` vert, avec des tests pour :
  - la garde sur une spec non brouillon :
    - refusés : corps modifié sans nouvelle entrée, entrée non datée, entrée existante modifiée ou supprimée, `id` ou `type` modifiés, `Write` sur une spec `abandoned`, `reviewed_commit` modifié ;
    - acceptés : corps modifié avec une nouvelle entrée datée, y compris en plusieurs éditions par rapport à la référence commitée, section « Amendements » créée ;
    - fins de ligne CRLF ; spec en brouillon dans `HEAD` et dans le fichier : libre ;
  - la décision de clôture :
    - refusée : sans revue, commit de code ou de test après la revue, code non commité, commit revu non ancêtre, amendement après la revue, contrôles rouges, TDD non figé ;
    - acceptée : cas nominal, `SPIKE` sans revue, commits de documentation après la revue ;
  - les refus de `reopen-tests` (hors TDD, tests non figés), de `set-reviewed` (spec non signée, code non commité, tests non figés ou modifiés) et de `set-status draft` (spec non brouillon) ;
  - la prochaine étape : `write-tests`, `review`, `close`, revue obsolète, `SPIKE` ;
  - l'ajout d'entrées dans la section « Amendements » (section au milieu du fichier, section absente) et la détection d'un regel.
- `claude plugin validate .` et `claude plugin validate ./plugins/atelier` sans erreur.
- `npm run build` dans `site/` sans erreur ni lien mort ; schéma SVG vérifié par capture Playwright en thème clair et sombre (bureau et mobile).
- Rejeu de bout en bout de la CLI et des hooks sur un dépôt jetable, consigné dans le bilan :
  - amendement : édition de corps refusée sans entrée, acceptée après ajout de l'entrée, entrée existante modifiée refusée ;
  - réouverture : `reopen-tests` sur des tests figés, implémentation refusée pendant la réécriture, regel tracé dans la spec ;
  - revue puis clôture : `close-check` et `set-status done` refusés après un commit de code postérieur à `set-reviewed`, acceptés sinon ; `reviewed_commit` non modifiable par l'outil d'édition.
- Aucune référence restante à `/atelier:tests` dans le plugin, le README et le site.
- Les lancements en une fois documentés (`claude "/atelier:status"`, `claude -p "/atelier:status"`, `node <dossier du plugin>/bin/atelier status`) sont essayés ; le résultat est consigné dans le bilan, et ce qui n'a pas pu être essayé est signalé comme tel dans la documentation.

## 7. Retour arrière
Revenir à la version 0.1.1 du plugin (revert de la fusion, puis `npm run version:patch`). Les champs `reviewed_commit` et les fichiers `revue.md` déjà écrits sont ignorés par l'ancienne version.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
