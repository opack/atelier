---
id: FEAT-35
type: FEAT
title: Lister et retrouver les chantiers
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-25
signed_by:
signed_at:
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

**`atelier list [filtres] [--all] [--sort <clé>] [--json]`** affiche un chantier par ligne : identifiant, type, titre, statut, étape en quelques mots, et où il se trouve (« ici » pour l'arbre courant, sinon le nom de sa branche), avec le parent s'il en a un.
- Par défaut, seuls les chantiers **ouverts** sont listés (ni `done` ni `abandoned`). `--all` ajoute les chantiers clos. Ce défaut garde la liste courte quel que soit l'âge du projet.
- Tri par défaut : numérique sur l'identifiant (FEAT-4 avant FEAT-30). `--sort status` et `--sort type` groupent par statut ou par type, dans l'ordre numérique à l'intérieur de chaque groupe.
- Filtres, cumulables (ET entre filtres différents, OU entre les valeurs d'un même filtre séparées par des virgules) : `--status <s,…>`, `--type <T,…>`, `--parent <ID>`, et un texte libre cherché sans tenir compte de la casse ni des accents dans l'identifiant et le titre.
- `--json` rend la même sélection en JSON : un tableau d'objets avec les mêmes champs, pour un usage par un outil (l'app de gestion à venir notamment).
- Aucun chantier à afficher : une ligne le dit, et rappelle `--all` si des chantiers clos ont été écartés.

**L'étape** se déduit de l'en-tête de la spec et des documents présents dans le dossier du chantier, sans aucune commande git par chantier : brouillon, à planifier, tranche N/M en tests d'abord ou en implémentation, revue du chantier, clos, abandonné. C'est un repère, pas la prochaine étape exacte : celle-ci reste donnée par `atelier status` sur la branche du chantier (elle dépend du code commité, que la liste ne lit pas).

**La version affichée** d'un chantier présent à plusieurs endroits est celle de **sa propre branche** (la branche dont le nom porte son identifiant), sinon celle de l'arbre courant, sinon la première branche trouvée. Un chantier en cours se voit donc avec son état réel, même depuis `main`.

**`atelier path <ID>`** affiche le chemin du dossier du chantier dans l'arbre courant, relatif à la racine du projet. L'identifiant est reconnu sans tenir compte de la casse. Il se combine avec le shell : `cd "$(atelier path FIX-18)"`.

**`atelier open <ID>`** ouvre ce dossier dans l'explorateur de fichiers du système (`open` sur macOS, `explorer` sur Windows, `xdg-open` ailleurs). Si l'ouverture est impossible (aucun explorateur, session sans affichage comme en cloud), la commande affiche le chemin et dit pourquoi elle n'a pas ouvert.

Pour `path` comme pour `open`, un chantier absent de l'arbre courant mais présent sur une branche donne une erreur qui nomme cette branche (« FEAT-21 n'existe que sur la branche feat/FEAT-21-… : bascule dessus pour l'ouvrir ») ; un identifiant inconnu partout donne une erreur claire.

**`/atelier:list [demande]`** : le skill traduit une demande en langage naturel (« les FIX en cours », « tout ce qui dépend d'EPIC-17 ») en arguments de `atelier list`, lance la commande et présente le résultat tel quel, sans commentaire. Pas de skill pour `path` ni `open` : ce sont des commandes de terminal.

**Hors périmètre** :
- le rangement des dossiers par centaine (chantier séparé, qui suivra) ;
- un filtre interactif (sélection au clavier, mise à jour en direct) : ce sera le rôle de l'app de gestion ;
- la prochaine étape exacte de chaque chantier (voir plus haut) ;
- ouvrir un fichier précis d'un chantier, ou extraire le dossier d'une autre branche.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- `lib/cli/relations.mjs` : `chantierIndex` lit déjà l'arbre courant et les arbres `chantiersDir` de toutes les branches en trois appels git, quel que soit le nombre de branches. La liste s'appuie dessus. Il faut y ajouter la liste des fichiers de chaque dossier (déjà présente dans l'arbre git lu, et lisible sur disque pour l'arbre courant) pour déduire l'étape.
- `lib/cli/identifiers.mjs` : `findChantierDirectory` trouve déjà un dossier par identifiant ; `path` et `open` s'appuient dessus, pour que le futur rangement par centaine n'ait qu'un endroit à changer.
- Nouveau domaine `list` : `lib/list.mjs` (sélection, tri, étape, mise en forme : fonctions pures testées) et `lib/cli/list.mjs` (commandes `list`, `path`, `open`) ; entrées dans la table de `lib/cli.mjs`. Le choix de l'explorateur selon la plateforme est une fonction pure ; le lancement se fait dans `lib/cli/`.
- Nouveau skill `skills/list/SKILL.md`.
- Site : `site/reference/commandes.md` (les trois commandes et le skill), et toute page qui conseille de parcourir `docs/chantiers/`. Bump mineur de `plugin.json`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

- Un chantier présent sur sa branche locale et sur sa branche distante, avec des en-têtes différents : laquelle l'emporte ? Proposition : la locale (c'est là qu'on travaille), à confirmer au plan.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné des chantiers FEAT-4, FEAT-30 et TEC-2 ouverts, quand on lance `atelier list`, alors ils sont listés dans l'ordre TEC-2, FEAT-4, FEAT-30, chacun avec son identifiant, son type, son titre, son statut et son étape.
- [ ] CA-2 : Étant donné un chantier `done`, un `abandoned` et un `signed`, quand on lance `atelier list`, alors seul le `signed` est listé ; avec `--all`, les trois le sont.
- [ ] CA-3 : Étant donné des chantiers de plusieurs types et statuts, quand on lance `atelier list --type FIX,TEC --status signed`, alors ne sont listés que les FIX et TEC signés ; avec `--parent EPIC-17`, seuls les enfants directs d'EPIC-17 ; avec un texte libre `relecture`, seuls ceux dont l'identifiant ou le titre le contient, sans tenir compte de la casse ni des accents (« Relectures » et « relécture » correspondent).
- [ ] CA-4 : Étant donné des chantiers de plusieurs statuts, quand on lance `atelier list --sort status`, alors ils sont groupés par statut et, à l'intérieur d'un groupe, triés par numéro ; de même avec `--sort type`. Une valeur de `--sort` inconnue est refusée avec la liste des valeurs admises.
- [ ] CA-5 : Étant donné un chantier signé dont la spec indique `slice: 2` et dont le plan compte 3 tranches, en TDD avec les tests de la tranche figés, quand on liste, alors son étape est « tranche 2/3 : implémentation » ; une spec en brouillon donne « brouillon », un FEAT signé sans `plan.md` donne « à planifier », un chantier en `slice: chantier` donne « revue du chantier ».
- [ ] CA-6 : Étant donné FEAT-40 absent de l'arbre courant et présent signé sur la branche `feat/FEAT-40-x`, et FEAT-41 présent en brouillon dans l'arbre courant et signé sur `feat/FEAT-41-y`, quand on lance `atelier list` depuis `main`, alors FEAT-40 est listé avec la branche `feat/FEAT-40-x` comme emplacement, et FEAT-41 est listé signé, avec sa branche comme emplacement.
- [ ] CA-7 : Étant donné des chantiers, quand on lance `atelier list --json` avec des filtres, alors la sortie est un tableau JSON des chantiers sélectionnés, dans le même ordre que l'affichage, chacun avec `id`, `type`, `title`, `status`, `step`, `location`, `parent`.
- [ ] CA-8 : Étant donné que les filtres écartent tout, ou qu'aucun chantier n'est ouvert alors que des chantiers clos existent, quand on lance `atelier list`, alors une ligne dit qu'aucun chantier ne correspond et, dans le second cas, mentionne `--all` ; `--json` rend `[]`.
- [ ] CA-9 : Étant donné le chantier FIX-18 dans l'arbre courant, quand on lance `atelier path fix-18`, alors la commande affiche `docs/chantiers/FIX-18-<slug>` (ou le `chantiersDir` configuré) et réussit.
- [ ] CA-10 : Étant donné FEAT-40 présent seulement sur la branche `feat/FEAT-40-x`, quand on lance `atelier path FEAT-40` ou `atelier open FEAT-40`, alors la commande échoue avec un message qui nomme cette branche ; pour un identifiant inconnu partout, elle échoue avec un message qui le dit ; sans argument, elle affiche son usage et échoue.
- [ ] CA-11 : Étant donné les plateformes `darwin`, `win32` et `linux`, quand on demande la commande d'ouverture d'un dossier, alors on obtient respectivement `open`, `explorer` et `xdg-open`.
- [ ] CA-12 : Étant donné que le lancement de l'explorateur échoue (commande absente), quand on lance `atelier open FIX-18`, alors la commande affiche le chemin du dossier et une phrase qui dit qu'elle n'a pas pu l'ouvrir.
- [ ] CA-13 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit, et la page des commandes décrit `atelier list`, `atelier path`, `atelier open` et `/atelier:list`.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : `open` lance l'explorateur avec le chemin en argument séparé (jamais via un shell), donc un nom de dossier ne peut pas injecter de commande. Les commandes ne font que lire.
- Performance : le nombre d'appels git ne dépend ni du nombre de chantiers ni du nombre de branches (les trois appels de l'index, aucun appel par chantier). Ordre de grandeur visé : moins d'une seconde pour 1 000 chantiers et 50 branches.
- Accessibilité : sortie texte en colonnes lisible sans couleur ; `--json` pour tout autre usage.
- Données personnelles : N/A, aucune donnée personnelle lue ni produite.
- Compatibilité : Node ≥ 20, aucune dépendance ; macOS, Windows et Linux pour `open`. En session cloud, `open` se replie sur l'affichage du chemin.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Dépôts jetables construits par les tests : chantiers dans l'arbre courant et sur des branches locales, de tous types et statuts, un EPIC avec enfants, un FEAT découpé en tranches avec `plan.md`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
