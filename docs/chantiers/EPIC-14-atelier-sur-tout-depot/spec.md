---
id: EPIC-14
type: EPIC
title: Travailler avec atelier sur n'importe quel dépôt
status: signed
tdd: no              # un EPIC n'implémente rien : toujours no
integration_branch: no
created_at: 2026-11-21
signed_by: Opack
signed_at: 2026-11-26
---

# EPIC-14 Travailler avec atelier sur n'importe quel dépôt

<!-- Chantier d'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent
(rattachés par `rel_parent: EPIC-14` dans leur en-tête). Étapes : spec → signature → plan (découpage) → chantiers enfants → clôture.
Clôture possible quand tous les enfants sont clos et qu'au moins l'un d'eux est done ; sinon l'EPIC est abandonné. -->

## 1. Vision
<!-- Ce qui existera quand l'EPIC sera réalisé, du point de vue de l'utilisateur.
Questions si manquant : qui l'utilise, pour faire quoi ? À quoi reconnaît-on que c'est fini ? -->
Un développeur bénéficie de la méthode atelier (chantier identifié, spec signée avant le code, tests d'abord, revue, bilan versionné) sur **n'importe quel dépôt**, y compris un dépôt qui n'utilise aucune méthode et dans lequel il n'a pas le droit d'ajouter de fichiers (mission chez un client).

- Dans un projet qui a adopté atelier, rien ne change dans les habitudes, sauf que le chantier actif ne dépend plus d'une convention de nommage : branches et commits peuvent suivre n'importe quelle convention.
- Dans un projet qui n'a pas adopté atelier, les fichiers de la méthode (configuration, chantiers, décisions) vivent dans un **dépôt compagnon**, un par mission, ailleurs sur le disque. Le dépôt du client ne reçoit que du code, des tests et des commits ordinaires.
- Plusieurs chantiers peuvent être menés en parallèle dans plusieurs copies de travail (clones ou worktrees), chacune avec son chantier actif.
- La langue des documents suit le projet, celle des échanges suit l'utilisateur : un projet client en anglais reçoit spec, revue, bilan, commits et PR en anglais, pendant que le plugin parle français à un utilisateur francophone.

On reconnaît que c'est fini quand un chantier complet (de `/atelier:new` à `/atelier:close`) peut être mené sur un dépôt client sans y laisser la moindre trace d'atelier.

## 2. Pourquoi
<!-- Le problème, le besoin, l'enjeu. Ce qui arrive si on ne fait rien. Pourquoi un ensemble de chantiers plutôt qu'un seul. -->
- atelier n'a qu'une racine, celle du projet : `.claude/atelier.json`, `docs/chantiers/`, `docs/decisions/`, `.atelier/`, la section Process du `CLAUDE.md` et la déclaration du plugin dans `.claude/settings.json` sont tous écrits dans le dépôt du projet. Sans `.claude/atelier.json`, `loadConfig` rend `null` et tous les hooks se taisent : atelier est inutilisable sur un dépôt qu'on ne peut pas modifier.
- Le chantier actif est déduit d'une convention : nom de branche `<type>/<ID>-<slug>`, puis commits `[<ID>]` propres à la branche (TEC-6, lus en `--first-parent` depuis FEAT-21). Un dépôt client impose ses propres conventions (`feature/JIRA-123`, format de commit vérifié) ou n'en a aucune : atelier n'y reconnaît alors aucun chantier.
- Une copie de travail ne peut porter qu'un chantier à la fois, et rien ne permet de choisir entre plusieurs chantiers menés sur une même branche (`dev` dans un projet sans branches de fonctionnalité).
- atelier ne parle qu'une langue, le français : templates, titres de sections lus par le code, messages des hooks et de la CLI, skills. Un projet client en anglais ne peut pas recevoir de documents en français, et un utilisateur francophone ne veut pas pour autant échanger en anglais.
- Si on ne fait rien : en mission, on travaille sans le cadre, ou on pollue le dépôt du client.
- Un ensemble plutôt qu'un chantier : plusieurs livrables séparables, avec des dépendances nettes. Le **pointeur de chantier actif** a de la valeur seul, dès maintenant (dans ce dépôt, en session cloud). Le **dépôt compagnon** en a besoin, pas l'inverse. Les **langues** sont indépendantes des deux, et la réécriture des skills est assez risquée pour être isolée. Réunis, ils feraient un diff trop gros pour une revue utile.

## 3. Critères d'acceptation globaux
<!-- Ce que l'ensemble doit permettre, vérifiable une fois les chantiers enfants livrés.
Format : - AC-1 : Étant donné…, quand…, alors… -->
- AC-1 : Étant donné un projet atelier et deux copies de travail (deux clones, ou deux worktrees) sur deux branches portant chacune un chantier signé différent, quand l'agent écrit du code dans chacune, alors la garde applique dans chaque copie les règles de son propre chantier.
- AC-2 : Étant donné une branche que déclarent plusieurs chantiers ouverts (`branch: dev`), quand on se trouve sur cette branche dans une copie de travail sans pointeur, alors aucun chantier n'est deviné : l'écriture de code est refusée et le message liste les candidats ; après `atelier use <ID>`, ce chantier est actif.
- AC-3 : Étant donné un chantier actif sur une branche, quand on passe sur une autre branche (`git switch`) puis qu'on revient, alors le chantier actif suit la branche : celui de l'autre branche (ou aucun), puis de nouveau le premier.
- AC-4 : Étant donné un dépôt sans atelier et un dépôt compagnon enregistré pour lui, quand on mène un chantier complet (`new`, `sign`, tests, implémentation, `review`, `close`) depuis Claude ouvert sur le dossier du code, alors aucun fichier versionné du dépôt n'a été ajouté ni modifié par atelier (`git status` ne montre que le code et les tests du chantier), ses branches et ses commits suivent les conventions choisies par l'utilisateur, et la spec, la revue et le bilan sont commités dans le dépôt compagnon.
- AC-5 : Étant donné un dépôt compagnon, quand l'agent tente de modifier une spec signée sans amendement, alors la garde la refuse comme si la spec était dans le dépôt du projet.
- AC-6 : Étant donné le plugin activé au scope utilisateur et un nouveau clone ou un nouveau worktree d'un dépôt pour lequel un compagnon est enregistré, sans aucune configuration locale, quand on y ouvre Claude, alors atelier trouve le compagnon par le registre et le dit, et indique de lancer `/atelier:init` si la copie n'est pas encore configurée (accès au compagnon, exclusion de `.atelier/`) ; `/atelier:init` termine cette configuration sans redemander l'emplacement du compagnon. Ensuite, si un seul chantier ouvert déclare la branche courante, il est actif ; sinon atelier dit pourquoi aucun chantier n'est actif. atelier n'est jamais silencieux sur un dépôt pour lequel un compagnon est enregistré (SB1).
- AC-7 : Étant donné un projet dont la langue est l'anglais et un utilisateur dont la langue est le français, quand on mène un chantier complet, alors le contenu des fichiers d'atelier (spec, plan, revue, décisions, bilan), les commits et les PR sont en anglais (noms de fichiers, de dossiers, clés d'en-tête et scope de commit inchangés), tandis que les messages des hooks et de la CLI, les questions des skills et la présentation des revues sont en français et citent les titres de sections tels qu'ils figurent dans les fichiers (en anglais).
- AC-8 : Étant donné un utilisateur qui n'a réglé aucune langue personnelle, quand atelier lui parle, alors il utilise la langue du projet.
- AC-9 : Étant donné une pseudo-langue de projet au vocabulaire factice (par exemple « [Amendements~] »), quand les tests de lecture des documents (spec, plan, revue, amendements) tournent avec ce vocabulaire, alors ils passent ; un terme resté en dur dans le code ou une tolérance propre au français (par exemple `requalifié\p{L}*` pour l'accord) les fait échouer. Ce critère est porté par le premier enfant « langues » (choix du vocabulaire par langue).
- AC-10 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit et explique le chantier actif (pointeur, `atelier use`, repli), le travail sur un dépôt sans atelier (dépôt compagnon, registre, où lancer Claude) et les deux réglages de langue.

## 4. Cadre
<!-- Le cadre commun aux chantiers enfants : choix fonctionnels (vocabulaire, parcours, règles métier) et techniques
(architecture, conventions, contraintes) qu'ils partagent. Ce qui n'est pas cadré ici se décide dans chaque enfant. -->
**Un seul mode.** Pas de mode « dans le dépôt » et de mode « compagnon » aux règles différentes : seul l'emplacement des fichiers d'atelier change (la racine du projet par défaut, le dépôt compagnon s'il est enregistré). Pointeur, garde, gel des tests, revue et clôture se comportent de la même façon dans les deux cas.

**Chantier actif.** Résolu, dans cet ordre, par :
1. le **pointeur** : une table `branche → chantier` dans `.atelier/` de la copie de travail. Écrite par `/atelier:new` (le chantier créé devient actif sur la branche courante) et par `atelier use <ID>` (qui remplace l'entrée de la branche courante). Les entrées des autres branches restent : changer de branche change de chantier ;
2. le **repli**, quand la branche courante n'a pas d'entrée ou que son chantier est clos : le chantier non clos, **s'il est unique**, dont l'en-tête de spec `branch:` porte la branche courante ;
3. sinon, **aucun chantier actif** : l'écriture de code est refusée, le message propose `atelier use <ID>` (avec les candidats s'il y en a plusieurs) ou `/atelier:new`.

Règles associées :
- Le pointeur est un état local, **jamais versionné** (ni dans le projet, ni dans le compagnon) : versionné, il suivrait les fusions et créerait un conflit à chaque PR. La vérité partagée est l'en-tête `branch:` de la spec.
- `branch:` est écrit par la CLI (`/atelier:new`, `atelier use`), comme `tests_commit` : la garde de spec l'accepte sans amendement.
- Un chantier clos (`done`, `abandoned`) n'est jamais actif : `atelier use` le refuse, la résolution l'ignore. Le modifier, c'est ouvrir un nouveau chantier (`rel_origin`) ; le consulter ne demande pas qu'il soit actif.
- Le nom de branche `<type>/<ID>-<slug>` et les commits `[<ID>]` deviennent de **simples conventions**, recommandées dans un projet atelier, facultatives ailleurs. atelier ne les lit plus pour trouver le chantier actif (fin de la déduction de TEC-6 et de sa variante `--first-parent` de FEAT-21 : code et tests retirés), sans lecture de compatibilité : les chantiers ouverts sans `branch:` se rattachent par un `atelier use <ID>`, que le hook de démarrage de session indique.
- Deux chantiers ne sont pas menés en même temps dans la même copie de travail avec du code non commité des deux : `atelier use` est refusé tant que des fichiers de code ne sont pas commités (SD6).
- Une entrée du pointeur dont le chantier est introuvable dans l'arbre courant (spec seulement sur une autre branche, dossier supprimé) vaut une absence d'entrée : on passe au repli (SD6). Les autres cas limites (HEAD détachée, `use` sur un chantier absent de l'arbre, valeur unique de `branch:` et commit de sa mise à jour) se tranchent dans l'enfant « pointeur ».
- Sur une branche partagée par plusieurs chantiers (`dev`), un seul chantier à la fois est entre le gel de ses tests et sa revue : les plages de commits (`tests_commit`, `slice_base`, `reviewed_commit`) ne savent pas séparer deux chantiers entrelacés. `atelier use` avertit si le chantier qu'on quitte a des tests figés sans revue enregistrée. atelier ne cherche pas à attribuer les commits à un chantier (SD4).
- FEAT-4 : la clôture d'un EPIC, qui reposait sur une branche `epic/<ID>-<slug>` lue par son nom, passe par le pointeur ou par `branch:`.
- FEAT-21 : sur la branche d'intégration d'un EPIC, c'est l'EPIC qui est actif (la garde y refuse le code) ; il le devient par `branch:` dans sa spec, écrit par `/atelier:plan` quand il pousse cette branche. Le nom `epic/<ID>-<slug>` reste une convention qu'atelier crée lui-même pour calculer la base d'un enfant : il n'est jamais lu pour trouver le chantier actif.
- FEAT-35 : la version affichée d'un chantier par `atelier list` cesse de reposer sur le nom des branches (ses règles « la branche porte l'identifiant du chantier ») et s'appuie sur `branch:` ; dans un compagnon, l'index des chantiers lit le compagnon, pas les branches du projet.

**Dépôt compagnon.**
- Un dépôt git par mission, ailleurs sur le disque, qui contient la configuration d'atelier, les chantiers et les décisions. Il n'a pas d'état local : tout l'état local (pointeur, débrayage, état du hook de fin) décrit une copie de travail du projet et vit dans `.atelier/` de cette copie, exclu par `.git/info/exclude` ; sinon le débrayage d'un worktree s'appliquerait aux autres (SD1). Plusieurs compagnons peuvent être rangés dans un même dossier parent : rien ne l'impose ni ne l'empêche.
- Il est trouvé par un **registre utilisateur** (dans `~/.claude/`), indexé par l'URL du remote du projet : chaque clone et chaque worktree le retrouve. L'URL est normalisée (hôte et chemin, sans schéma, sans `.git` final, sans tenir compte de la casse), pour qu'un clone https retrouve un compagnon enregistré depuis un clone ssh ; le remote est choisi par la règle de `/atelier:new` (remote suivi, puis `origin`, puis l'unique) ; un dépôt sans remote ne peut pas être enregistré, avec un message clair (SD2). L'emplacement du compagnon n'est jamais stocké dans un fichier non versionné de la copie de travail (absent d'une copie neuve, il rendrait atelier silencieux).
- Plusieurs copies du projet partagent une seule copie du compagnon : le compagnon reste sur une seule branche, chaque chantier n'écrit que dans son dossier et, à la clôture, dans `decisionsDir` (ADR), et chaque commit du compagnon nomme ses chemins (`git commit -- <dossier du chantier> [<ADR>]`) (SD11), pour ne jamais emporter les fichiers d'un autre chantier (SD3).
- Lectures (SD9) : tout ce qui concerne les chantiers se lit dans le compagnon (dossiers, historique des specs, identifiants pris par `next-id`, index des relations) ; seuls le code, les tests et leurs commits se lisent dans le projet. Les identifiants du client (`FIX-3` dans ses commits) n'entrent donc jamais en collision.
- Claude est lancé dans le dossier du **projet** (le code du client), jamais dans le compagnon : les hooks, la branche, le gel des tests, la revue et les contrôles portent sur le code. Le compagnon est le dossier distant, rendu accessible en plus (répertoire additionnel).
- Rien n'est écrit dans un fichier versionné du dépôt du projet. Seuls fichiers locaux tolérés : l'état local dans `.atelier/` (SD10), ignoré via `.git/info/exclude` (jamais via le `.gitignore` du projet), et les réglages personnels de Claude Code non versionnés. En mode compagnon, toute création de `.atelier/` (hook, CLI, skill) pose d'abord, de façon idempotente, son exclusion dans `.git/info/exclude`, que `/atelier:init` ait été lancé dans la copie ou non (SB2).
- En mode compagnon, le plugin est activé au scope **utilisateur** (`~/.claude/settings.json`), une fois par machine : jamais au scope projet (`.claude/settings.json`, versionné chez le client). Sur un dépôt sans configuration ni compagnon enregistré, il reste muet (`loadConfig` rend `null`) ; seules ses commandes `/atelier:*` y sont proposées. Dans un projet atelier, le scope projet reste la règle ; l'activation aux deux scopes désigne le même plugin. `/atelier:init`, dans sa variante compagnon, enregistre le compagnon dans le registre puis configure la copie de travail : accès au compagnon (`additionalDirectories` dans `.claude/settings.local.json`, jamais commité) et exclusion de `.atelier/` (et de `settings.local.json` si besoin) via `.git/info/exclude`. Les règles de la section Process sont injectées par le hook de démarrage de session au lieu du `CLAUDE.md` du projet.
- Choix du scope (SB1) : le scope utilisateur, parce que l'accès au compagnon et l'activation vivent sinon dans un fichier absent de toute copie neuve, et que l'oubli passerait inaperçu ; au scope utilisateur, le hook de démarrage d'une copie neuve trouve le compagnon et demande `/atelier:init`. Écarté : le scope local, qui demanderait une installation en ligne de commande puis `/atelier:init` dans chaque copie, sans rappel. Coût accepté : les commandes `/atelier:*` visibles dans tous les projets de l'utilisateur.
- Conventions de branche et de commit (SD5) : déclarées dans la configuration d'atelier, à côté de la langue du projet. `/atelier:new` propose de rester sur la branche courante ou d'en créer une au format déclaré ; le reviewer vérifie le format de commit déclaré, et rien s'il n'y en a pas ; les messages de commit et de fusion écrits par les skills suivent ce format. Dans un projet atelier, le format par défaut reste `<prefix>(<scope>): [<ID>] <description>` et `<type>/<ID>-<slug>`.
- Les commits de code et de tests vivent dans le dépôt du projet ; les commits de spec, revue, décisions et bilan dans le compagnon. `tests_commit`, `reviewed_commit` et `slice_base` désignent des commits du dépôt du projet.
- FEAT-4 juge un chantier clos sur son statut dans l'arbre courant, ce qui vaut « fusionné » quand les specs voyagent avec le code. Dans un compagnon, ce n'est plus vrai : l'enfant qui livre le compagnon tranche ce que vaut `done` (par exemple, la clôture demande si la PR est fusionnée chez le client).

**Langues.**
- Deux langues distinctes :
  - la **langue du projet** : fichiers d'atelier (templates, titres de sections, spec, revue, bilan), commits et PR. Elle se règle dans la configuration d'atelier (`.claude/atelier.json`, ou celle du compagnon), commitée et partagée par tous ceux qui travaillent sur le projet ; `fr` par défaut, ce qui ne change rien aux projets existants. Elle ne change pas tant qu'un chantier est ouvert : relue avec un autre dictionnaire, une spec perdrait en silence ses critères et ses amendements (SD7). C'est une règle documentée ; l'enfant « langues » décide s'il ajoute un contrôle (par exemple `check-spec` en échec quand une spec ouverte n'a aucun titre du dictionnaire courant) (SD12) ;
  - la **langue de l'utilisateur** : messages des hooks et de la CLI, questions des skills, présentation des revues. C'est un réglage personnel, jamais commité (par exemple `ATELIER_LANG` dans `~/.claude/settings.json`). Par défaut, c'est la langue du projet.
- Les titres de sections que le code lit (`check-spec`, revue, clôture…) viennent d'un **dictionnaire par langue du projet**. Les messages destinés à l'utilisateur viennent d'un **catalogue par langue de l'utilisateur**, et citent les titres du dictionnaire du projet : un utilisateur francophone sur un projet anglais lit « section `Acceptance criteria` : aucun critère numéroté ».
- Les skills et les agents sont écrits dans une langue pivot, l'anglais, et produisent les documents dans la langue du projet et les échanges dans celle de l'utilisateur.
- Les noms de fichiers et de dossiers (`spec.md`, `revue.md`, `bilan.md`, `docs/chantiers/`), les clés d'en-tête et le scope de commit `docs(chantiers)` ne se traduisent pas : ce sont des identifiants que le code lit (SD8).
- Langues livrées : français et anglais. Le site reste en français.
- Prérequis : le vocabulaire lu par le code est centralisé en un seul endroit par REF-34 (lot 5 de l'EPIC-17), avant le premier enfant « langues ». REF-34 ne rend pas ce vocabulaire injectable : c'est le premier enfant « langues » qui le fait, et qui le prouve par la pseudo-langue (AC-9).

**Contraintes communes.** Node ≥ 20, aucune dépendance ; logique pure dans `lib/<domaine>.mjs`, entrées / sorties dans `lib/cli/<domaine>.mjs` (rangement de REF-29) ; toute évolution de hook a son test ; code et commentaires en anglais.

**Pas de branche d'intégration** (`integration_branch: no`) : chaque enfant a de la valeur livré seul dans la branche par défaut (le pointeur dès maintenant, les langues indépendamment du compagnon).

## 5. Hors périmètre
<!-- Ce que l'EPIC ne couvre pas, même si on pourrait l'y attendre. -->
- L'interface graphique qui s'appuierait sur les dépôts compagnons (sujet distinct).
- Un compagnon partagé entre plusieurs projets, ou plusieurs projets par compagnon.
- Le travail en équipe chez le client autour du compagnon (partage, revue des specs par l'équipe du client).
- La lecture des anciennes conventions (nom de branche, commits `[<ID>]`) pour compatibilité.
- Le nettoyage des entrées de pointeur des branches supprimées, et le rattachement automatique après un renommage de branche.
- La synchronisation vers Notion.
- La traduction du site, et toute autre langue que le français et l'anglais.
- La traduction des chantiers existants quand la langue du projet change.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-28 : TEC-37 : les critères s'écrivent AC-n (CA-n → AC-n de même numéro, dans la spec et le plan). Aucun critère ne change de sens.
