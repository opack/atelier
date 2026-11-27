---
id: FEAT-35
type: FEAT
title: Lister et retrouver les chantiers
status: signed
tdd: yes
created_at: 2026-11-25
signed_by: Opack
signed_at: 2026-11-26
slice_tdd: yes
tests_commit: 
slice: 3
slice_base: 6bcfa74260fd64b57c84642552d3ca3499982204
---

# FEAT-35 Lister et retrouver les chantiers

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

Le dossier `docs/chantiers/` grossit d'un dossier par chantier : 24 sur `main` à l'ID 34. Pour savoir ce qui est en cours, où en est chaque chantier ou où sont ses fichiers, l'utilisateur parcourt ce dossier à la main. Le tri y est lexical (TEC-1, TEC-15, TEC-19, TEC-2), les chantiers clos se mêlent aux chantiers en cours, et un chantier en cours n'y figure pas du tout : sa spec n'existe que sur sa branche jusqu'à la fusion.

`atelier status` ne renseigne que sur le chantier actif. L'index des chantiers (`chantierIndex`, qui lit l'arbre courant et toutes les branches) existe déjà pour les relations, mais rien ne l'expose à l'utilisateur.

Sans rien faire, retrouver un chantier coûte de plus en plus cher à mesure que le projet avance. Et le rangement par centaine prévu ensuite (sous-dossiers `000-099/`, `100-199/`…) ajouterait un niveau de navigation à la main.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

L'utilisateur passe par Claude : deux skills, `/atelier:list` et `/atelier:open`, s'appuient sur trois commandes de la CLI `atelier` (`list`, `path`, `open`), qui restent de la plomberie lancée par l'agent, comme les autres commandes (SB1).

### `/atelier:list [demande]`

Le skill récupère d'abord le remote s'il y en a un (`git fetch --prune --quiet`, avec `GIT_TERMINAL_PROMPT=0` pour ne jamais attendre d'identifiants ; échec signalé sans bloquer : la liste se fait alors avec les branches distantes telles qu'elles sont ; sans remote, ni fetch ni message) (SD12), traduit la demande en langage naturel (« les FIX en cours », « les enfants d'EPIC-17 », « tout, triés par statut ») en arguments de `atelier list`, lance la commande et présente le résultat tel quel. Une demande qu'aucun filtre ne sait traduire (par auteur, par date, par dépendance) : le skill dit ce qu'il ne peut pas filtrer et ne l'approche pas par un autre filtre (SD7).

### `atelier list [texte…] [--status <s,…>] [--type <T,…>] [--parent <ID>] [--all] [--sort id|status|type] [--json]`

Un chantier par ligne : identifiant, type, titre, statut, étape, emplacement (« ici » pour l'arbre courant, sinon le nom de la branche lue) et parent s'il en a un.
- **Défaut « ouverts »** : sans `--status`, seuls les chantiers ni `done` ni `abandoned` sont listés ; `--all` ajoute les clos. Un `--status` explicite remplace ce défaut : `--status done` liste les chantiers clos sans `--all` (SB5) ; `--all` avec `--status` est sans effet.
- **Filtres**, cumulables : ET entre filtres différents, OU entre les valeurs d'un même filtre séparées par des virgules. `--type` et `--status` ne tiennent pas compte de la casse. `--parent <ID>` garde les chantiers dont le `rel_parent` de la version affichée vaut cet identifiant (SD9). Le texte libre (un ou plusieurs mots) garde les chantiers dont l'identifiant ou le titre contient **chaque** mot, sans tenir compte de la casse ni des accents ; c'est une recherche de texte (`FIX-1` trouve aussi FIX-12).
- **Tri** : par défaut, numérique sur l'identifiant (FEAT-4 avant FEAT-30). `--sort status` groupe dans l'ordre draft, signed, done, abandoned ; `--sort type` dans l'ordre FEAT, FIX, REF, TEC, SPIKE, EPIC ; ordre numérique dans chaque groupe (SD4).
- **Arguments refusés** (message d'usage, échec) : option inconnue, option répétée, option sans valeur, valeur inconnue de `--status`, `--type` ou `--sort` (le message liste les valeurs admises) (SD6).
- **Liste vide** : une ligne dit qu'aucun chantier ne correspond et, si le défaut « ouverts » a écarté des chantiers clos, mentionne `--all`. Code de sortie 0 ; `--json` rend `[]`.
- **`--json`** : la même sélection, dans le même ordre, en tableau d'objets `{ id, type, title, status, step, stepLabel, location, path, parent }` : `status` vaut `draft` si l'en-tête ne le dit pas ; `step` est un code stable et `stepLabel` le libellé affiché ; `location` vaut `null` (arbre courant) ou le nom court de la branche lue (`feat/FEAT-40-x`, `origin/feat/FEAT-40-x`) ; `path` est le chemin absolu du dossier dans l'arbre courant, `null` s'il n'y est pas ; `parent` vaut l'identifiant ou `null` (SD5).

### La version affichée (SB2, SB3)

Un chantier peut exister dans l'arbre courant et sur plusieurs branches, avec des en-têtes différents. La version lue est la première qui s'applique :
1. si la branche courante porte l'identifiant du chantier (en tête d'un segment de son nom, comme pour `next-id`) et que le chantier est dans l'arbre courant : l'arbre courant, copie de travail comprise ;
2. si le chantier est `done` ou `abandoned` dans l'arbre courant : l'arbre courant (un statut ne recule jamais : clos ici, il est clos) ;
3. si des branches portent son identifiant : celle, locale ou distante, dont le dernier commit est le plus récent (date de commit, `%(committerdate:unix)`) ; à égalité, la locale ;
4. si le chantier est dans l'arbre courant : l'arbre courant ;
5. sinon, parmi les autres branches, celle dont le dernier commit est le plus récent.

### L'étape (SB4)

Elle se déduit de la version affichée seule (en-tête, corps de la spec, `plan.md`, liste des fichiers du dossier) et, pour un EPIC, de ses enfants, sans aucune commande git par chantier. Elle réutilise les règles de `atelier status` (`sliceState`, `sliceLabel`, `testDrivenPhase`) et suit l'ordre de `nextStep` (SD13). Comme elle ne lit pas le code commité, elle ne distingue pas « implémentation en cours » de « implémentation commitée, revue à faire » : la prochaine étape exacte reste donnée par `atelier status` sur la branche du chantier.

| Cas (premier qui s'applique) | `step` | `stepLabel` |
|---|---|---|
| statut `abandoned` | `abandoned` | abandonné |
| statut `done` | `done` | clos |
| statut `draft` ou absent | `draft` | brouillon |
| FEAT, REF ou EPIC signé sans `plan.md` | `plan` | à planifier |
| EPIC signé avec `plan.md`, aucun enfant | `epic-children` | aucun enfant |
| EPIC signé, des enfants non clos | `epic-children` | N enfant(s) ouvert(s) |
| EPIC signé, enfants tous clos, au moins un `done` | `epic-close` | enfants clos : à clôturer |
| EPIC signé, enfants tous clos, aucun `done` | `epic-abandon` | enfants clos, aucun livré : à abandonner |
| TDD, tests pas encore figés (`tests_commit` vide), y compris tests rouverts | `tests` | tests d'abord |
| tranche du chantier (`slice: chantier`), revue non enregistrée | `chantier-review` | revue du chantier |
| `reviewed_commit` renseigné (chantier à tranche unique, ancien modèle, ou revue du chantier faite) | `reviewed` | revue enregistrée |
| sinon (TDD figé, sans TDD, SPIKE sans TDD) | `build` | implémentation |

Pour un chantier découpé (`sliceState` : modèle `sliced`) sur une tranche numérotée, le libellé est préfixé de `sliceLabel` : « Tranche 2/3 : implémentation », « Tranche 4 (absente du plan) : tests d'abord ». Les enfants d'un EPIC se cherchent dans **tous** les chantiers connus (l'index entier, avant filtres et défaut « ouverts ») : ce sont ceux dont la version affichée a `rel_parent` égal à son identifiant ; « clos » veut dire `done` ou `abandoned` dans cette version. Le libellé d'un EPIC ne dépend donc pas des filtres (SB6).

### `/atelier:open <ID>` et `atelier open <ID>`

Le skill lance `atelier open <ID>`, qui ouvre le dossier du chantier dans l'explorateur de fichiers du système, et rend son chemin à l'utilisateur. L'explorateur est lancé détaché, sans shell, le chemin en argument séparé : `open` sur macOS, `explorer` sur Windows (dont le code de sortie, non fiable, est ignoré), `xdg-open` ailleurs. Il n'est pas lancé, et la commande dit pourquoi en affichant le chemin, quand : sous Linux, ni `DISPLAY` ni `WAYLAND_DISPLAY` n'est défini (session sans affichage, comme en cloud) ; le lancement échoue (commande absente). Dans ces cas, la commande réussit quand même : le chemin est la réponse utile (SD3).

### `atelier path <ID>`

Affiche le chemin **absolu** du dossier du chantier dans l'arbre courant (SD2). Elle sert aux skills (et à Claude pour lire les fichiers d'un chantier). L'identifiant est reconnu sans tenir compte de la casse (`fix-18`).

Pour `path` comme pour `open` :
- chantier absent de l'arbre courant mais présent sur des branches : erreur qui nomme la branche de la version affichée (« FEAT-40 n'existe que sur la branche feat/FEAT-40-x : bascule dessus pour l'ouvrir ») ;
- identifiant inconnu partout : erreur qui le dit ;
- deux dossiers du même identifiant dans l'arbre courant : erreur qui les nomme (SD8) ;
- argument absent ou qui n'est pas un identifiant : usage et échec.

### Cas particuliers (SD10)

- Projet sans configuration atelier : même message que les autres commandes.
- Dossier de `chantiersDir` sans `spec.md` : ignoré, comme dans l'index actuel.
- Pas de remote ou pas de branche : la liste se fait sur l'arbre courant seul.

### Hors périmètre

- Le rangement des dossiers par centaine (chantier séparé, qui suivra).
- Un filtre interactif (sélection au clavier, mise à jour en direct) : ce sera le rôle de l'app de gestion.
- La prochaine étape exacte de chaque chantier, le filtre par dépendance, par auteur ou par date.
- Ouvrir un fichier précis d'un chantier, ou extraire le dossier d'une autre branche.
- Utiliser `atelier` directement dans un terminal : ce n'est pas un usage documenté.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- `lib/cli/relations.mjs` : `chantierIndex` lit l'arbre courant (disque) et, pour les autres branches, en trois appels git : les refs, l'arbre `chantiersDir` de chaque ref, puis le contenu des dossiers. Aujourd'hui, il ne garde que les en-têtes des specs et efface la différence entre branche locale et distante (`shortRefName`). Il faut en plus (SD1), toujours en trois appels : la date du dernier commit de chaque ref (`%(committerdate)` dans le `for-each-ref` existant), le type de ref (locale ou distante), et pour chaque arbre de chantier distinct la liste de ses fichiers, la spec entière (corps compris, pour le modèle « ancien ») et `plan.md`. Les autres utilisateurs de l'index (relations, `check-spec`) ne doivent pas changer de comportement.
- `lib/cli/identifiers.mjs` : `findChantierDirectory` compare l'identifiant en respectant la casse ; `path` et `open` normalisent l'identifiant avant (SD8). Le rangement à plat est aussi supposé par `chantiersHere`, `chantierTreesOf` et `collectUsedIdentifiers` : le futur rangement par centaine devra les reprendre tous.
- Nouveau domaine `list` : `lib/list.mjs` (choix de la version, étape, sélection, tri, mise en forme, analyse des arguments, choix de l'explorateur : fonctions pures testées) et `lib/cli/list.mjs` (commandes `list`, `path`, `open`) ; entrées dans la table de `lib/cli.mjs`.
- Nouveaux skills `skills/list/SKILL.md` et `skills/open/SKILL.md`.
- Site : `site/reference/commandes.md` (les deux skills et les trois commandes) et toute page qui conseille de parcourir `docs/chantiers/`. Bump mineur de `plugin.json`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

Aucune.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné des chantiers FEAT-4, FEAT-30 et TEC-2 ouverts, quand on lance `atelier list`, alors ils sont listés dans l'ordre TEC-2, FEAT-4, FEAT-30, chacun avec son identifiant, son type, son titre, son statut, son étape et son emplacement.
- [ ] CA-2 : Étant donné un chantier `done`, un `abandoned` et un `signed`, quand on lance `atelier list`, alors seul le `signed` est listé ; avec `--all`, les trois ; avec `--status done`, seul le `done` ; avec `--status done,signed`, le `done` et le `signed`.
- [ ] CA-3 : Étant donné des chantiers de plusieurs types et statuts, quand on lance `atelier list --type fix,TEC --status signed`, alors ne sont listés que les FIX et TEC signés ; avec `--parent EPIC-17`, seuls les chantiers ouverts dont la version affichée a `rel_parent: EPIC-17` (un chantier rattaché à EPIC-17 sur une autre version seulement n'est pas listé).
- [ ] CA-4 : Étant donné les titres « Calibrer les relectures » et « Rélecture du plan », quand on lance `atelier list relecture`, alors les deux sont listés ; avec `atelier list relecture plan`, seul le second.
- [ ] CA-5 : Étant donné des chantiers de tous statuts et types, quand on lance `atelier list --all --sort status`, alors les groupes se suivent dans l'ordre draft, signed, done, abandoned, et dans chaque groupe par numéro ; avec `--sort type`, dans l'ordre FEAT, FIX, REF, TEC, SPIKE, EPIC.
- [ ] CA-6 : Étant donné `atelier list` lancé avec une option inconnue, une option répétée, une option sans valeur, ou une valeur inconnue de `--status`, `--type` ou `--sort`, alors la commande échoue avec un message qui nomme l'argument fautif et, pour une valeur inconnue, liste les valeurs admises.
- [ ] CA-7 : Étant donné chaque ligne de la table de l'étape (§2), quand on liste un chantier dans ce cas, alors son `step` et son `stepLabel` sont ceux de la table, dans l'ordre de la table (un chantier en `slice: chantier` dont les tests sont rouverts est en « tests d'abord ») ; et un chantier découpé en 3 tranches, sur la tranche 2, en TDD avec tests figés, a le libellé « Tranche 2/3 : implémentation » ; sur une tranche 4 absente du plan, sans tests figés, « Tranche 4 (absente du plan) : tests d'abord ».
- [ ] CA-8 : Étant donné un EPIC signé avec `plan.md`, quand ses enfants (selon leur version affichée) sont deux ouverts et un clos, alors son libellé est « 2 enfant(s) ouvert(s) », y compris avec `atelier list --type EPIC` ; tous clos dont un `done`, « enfants clos : à clôturer », y compris sans `--all` ; tous `abandoned`, « enfants clos, aucun livré : à abandonner » ; aucun, « aucun enfant ».
- [ ] CA-9 : Étant donné `main` comme branche courante, FEAT-40 absent de l'arbre courant et signé sur `feat/FEAT-40-x`, et FEAT-41 en brouillon dans l'arbre courant et signé sur `feat/FEAT-41-y`, quand on lance `atelier list`, alors FEAT-40 et FEAT-41 sont listés signés, avec leur branche comme emplacement.
- [ ] CA-10 : Étant donné la branche courante `feat/FEAT-42-z` où FEAT-42 est signé (copie de travail), et `origin/feat/FEAT-42-z` où il est en brouillon avec un commit plus récent, quand on lance `atelier list`, alors FEAT-42 est listé signé, emplacement « ici ».
- [ ] CA-11 : Étant donné FEAT-43 `done` dans l'arbre courant et `signed` sur une branche locale `feat/FEAT-43-w` restée en arrière, quand on lance `atelier list --all` depuis `main`, alors FEAT-43 est listé `done`, emplacement « ici » ; sans `--all`, il n'est pas listé.
- [ ] CA-12 : Étant donné FEAT-44 signé en tranche 1 sur la branche locale `feat/FEAT-44-v` et en tranche 2 sur `origin/feat/FEAT-44-v` dont le dernier commit est plus récent, quand on lance `atelier list` depuis `main`, alors FEAT-44 est lu sur `origin/feat/FEAT-44-v` (tranche 2) ; si c'est la branche locale qui a le commit le plus récent, il est lu sur elle.
- [ ] CA-13 : Étant donné des chantiers, quand on lance `atelier list --json` avec des filtres, alors la sortie est un tableau JSON des chantiers sélectionnés, dans l'ordre de l'affichage, chacun avec `id`, `type`, `title`, `status`, `step`, `stepLabel`, `location` (`null` pour l'arbre courant, sinon le nom de la branche), `path` (absolu, ou `null` hors de l'arbre courant) et `parent` (identifiant ou `null`).
- [ ] CA-14 : Étant donné que les filtres écartent tout, ou qu'aucun chantier n'est ouvert alors que des chantiers clos existent, quand on lance `atelier list`, alors une ligne dit qu'aucun chantier ne correspond et, dans le second cas seulement, mentionne `--all` ; la commande réussit ; `--json` rend `[]`.
- [ ] CA-15 : Étant donné un projet sans aucune branche autre que la courante, avec un dossier de chantier sans `spec.md`, quand on lance `atelier list`, alors les chantiers de l'arbre courant sont listés et le dossier sans spec est ignoré.
- [ ] CA-16 : Étant donné le chantier FIX-18 dans l'arbre courant, quand on lance `atelier path fix-18` depuis un sous-dossier du projet, alors la commande affiche le chemin absolu de `docs/chantiers/FIX-18-<slug>` (ou du `chantiersDir` configuré) et réussit.
- [ ] CA-17 : Étant donné FEAT-40 présent seulement sur la branche `feat/FEAT-40-x`, quand on lance `atelier path FEAT-40` ou `atelier open FEAT-40`, alors la commande échoue avec un message qui nomme cette branche ; pour un identifiant inconnu partout, avec un message qui le dit ; pour deux dossiers du même identifiant, avec un message qui les nomme ; sans argument ou avec un argument qui n'est pas un identifiant, avec l'usage.
- [ ] CA-18 : Étant donné les plateformes `darwin`, `win32` et `linux` (avec `DISPLAY` ou `WAYLAND_DISPLAY`), quand on demande comment ouvrir un dossier, alors on obtient respectivement `open`, `explorer` (code de sortie ignoré) et `xdg-open` ; sous `linux` sans `DISPLAY` ni `WAYLAND_DISPLAY`, on obtient « ne rien lancer » avec la raison.
- [ ] CA-19 : Étant donné que l'explorateur n'est pas lancé (pas d'affichage) ou que son lancement échoue (commande absente), quand on lance `atelier open FIX-18`, alors la commande affiche le chemin absolu du dossier et une phrase qui dit pourquoi elle ne l'a pas ouvert, et réussit.
- [ ] CA-20 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit, et la page des commandes décrit `/atelier:list`, `/atelier:open`, `atelier list`, `atelier path` et `atelier open`.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : l'explorateur est lancé sans shell, le chemin en argument séparé : un nom de dossier ne peut pas injecter de commande. Les commandes ne font que lire (hors `git fetch` du skill).
- Performance : trois appels git au plus pour l'index, quel que soit le nombre de chantiers et de branches, aucun appel par chantier. Ordre de grandeur visé : moins d'une seconde pour 1 000 chantiers et 50 branches, mesuré à la main sur un dépôt généré et noté dans le bilan (SD11).
- Vérification manuelle des skills, notée dans le bilan (SD14) : `/atelier:list` traduit « les FIX en cours » en `--type FIX`, « les enfants d'EPIC-17 » en `--parent EPIC-17`, et refuse explicitement « les chantiers de Didier » ; `/atelier:open FIX-18` ouvre le dossier en local et donne son chemin en session cloud.
- Accessibilité : sortie texte en colonnes lisible sans couleur ; `--json` pour tout autre usage.
- Données personnelles : N/A, aucune donnée personnelle lue ni produite.
- Compatibilité : Node ≥ 20, aucune dépendance ; macOS, Windows et Linux pour `open`. En session cloud, `open` se replie sur l'affichage du chemin.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Dépôts jetables construits par les tests : chantiers dans l'arbre courant et sur des branches locales, de tous types et statuts, un EPIC avec enfants, un FEAT découpé en tranches avec `plan.md`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
