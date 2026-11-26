---
description: Ouvre un chantier atelier (FEAT, FIX, REF, TEC, SPIKE, EPIC) — identifiant, branche, dossier — et construit la spec en posant des questions uniquement sur ce qui manque.
argument-hint: "[type] [titre, description, lien Notion ou Sentry]"
---

# Ouvrir un chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Arguments reçus : `$ARGUMENTS`

## 1. Préalables

- Lance `atelier status --json`. Si `installed` vaut `false`, arrête-toi et propose `/atelier:init`.
- Si un chantier est actif (nom de branche ou commits de la branche), demande s'il faut en ouvrir un nouveau ou continuer celui-ci. Si tu continues un chantier dont la spec est en brouillon, toute retouche de la spec est commitée et poussée comme en §7, avec le même message.
- Si le dépôt a des modifications non commitées, signale-le avant de changer de branche.

## 2. Type

Déduis le type des arguments s'il est donné ou évident, sinon demande-le :

| Type | Pour |
|---|---|
| `FEAT` | Fonctionnalité à créer ou améliorer (impact utilisateur) |
| `FIX` | Correction d'un bug |
| `REF` | Restructuration du code, comportement inchangé |
| `TEC` | Technique sans impact utilisateur direct : CI, outillage, dépendances, config, sécurité, infra, migration, petite maintenance |
| `SPIKE` | Exploration bornée dans le temps ; code jetable |
| `EPIC` | Chantier d'organisation : une vision que plusieurs chantiers rattachés réalisent ; n'implémente rien |

**EPIC ou pas ?** Si la demande couvre plusieurs livrables indépendants (types différents, ou plusieurs PR inévitables), propose d'ouvrir d'abord un `EPIC`, puis les chantiers qui s'y rattachent. À l'inverse, un EPIC demandé pour un seul livrable est un `FEAT` : dis-le. L'utilisateur tranche.

## 3. Identifiant, branche, dossier

1. Si l'utilisateur a fourni un identifiant, utilise-le. Sinon, récupère d'abord le remote pour voir les identifiants déjà pris ailleurs : `git fetch --quiet <remote>`, puis `atelier next-id <TYPE>`. Si le fetch échoue, signale-le (l'identifiant peut entrer en collision avec un chantier non récupéré) sans bloquer.
   - **Remote** (ici et en §7) : celui de la branche de suivi de la branche courante, sinon `origin`, sinon le seul remote existant. S'il y en a plusieurs sans qu'aucune de ces règles ne tranche, demande. Sans remote : ni fetch ni push.
2. Slug : 2 à 5 mots du titre, en minuscules, sans accents, séparés par des tirets.
3. Branche. **Parent d'abord** : avant de créer la branche, cherche les EPIC à branche d'intégration ouverts : les branches `epic/*` (`git branch -a --list '*epic/*'`), dont la spec (`git show <branche>:<dossier des chantiers>/<ID>-<slug>/spec.md`) porte `integration_branch: yes` et un statut ni `done` ni `abandoned`. S'il y en a un et que le parent n'est pas déjà donné, **demande** si le chantier se rattache à lui (ou à un EPIC enfant de celui-ci) ; le parent retenu s'écrit en `rel_parent` dans la spec (étape 5). Pour un chantier qui a un parent, le point de départ est la sortie de `atelier base --parent <ID du parent>` : la branche d'intégration de l'EPIC à branche d'intégration le plus proche en remontant les parents, sinon la branche par défaut ; présente à l'utilisateur un éventuel avertissement de la commande (parent introuvable, cycle). Quand c'est une branche d'intégration, fais le `git fetch <remote>` du 1. même si l'identifiant est fourni, puis pars de la plus avancée entre la branche locale et `<remote>/<branche>` (celle qui contient l'autre, ou la seule qui existe) ; si elles ont divergé, arrête-toi et demande de synchroniser la branche (`git pull` puis `git push`).

   Puis `git switch --no-track -c <type en minuscules>/<ID>-<slug> <point de départ>`, le point de départ étant la branche par défaut à jour sans parent. `--no-track` est indispensable : partie de `<remote>/<branche par défaut>`, la branche la suivrait sinon, et le push du §7 enverrait le brouillon sur la branche par défaut. Si tu n'es pas sur la branche par défaut :
   - si le nom de la branche courante porte un identifiant (`chantierSource` vaut `"branch"` dans `atelier status --json`), crée la branche comme ci-dessus sans poser de question : sur cette branche, son nom l'emporterait toujours et le nouveau chantier ne serait jamais reconnu ;
   - sinon (branche imposée, par exemple `claude/...` dans une session cloud), demande s'il faut rester sur la branche courante. Si oui, ne crée pas de branche, et commite puis pousse le brouillon dès qu'il est écrit (étape 6).
   - **Branche imposée** et point de départ qui est une branche d'intégration : fusionne-la dans la branche courante (`git merge -m "[<ID>] merge <branche d'intégration>" <référence choisie ci-dessus>`) avant le commit du brouillon, pour que l'enfant parte bien d'elle ; le `[<ID>]` du message tient la règle « chaque commit porte `[<ID>]` » de la revue.
4. Dossier : `docs/chantiers/<ID>-<slug>/` (ou le `chantiersDir` de la configuration).
5. Spec : `atelier template spec-<type en minuscules>` ; remplace `{{ID}}`, `{{TITLE}}`, `{{DATE}}` (AAAA-MM-JJ) et écris `spec.md`.
6. **Si tu es resté sur une branche imposée** (sans identifiant dans son nom) : commite et pousse le brouillon tout de suite, exactement comme en §7 (même message, même push). Sur une telle branche, atelier ne reconnaît le chantier qu'à son commit `[<ID>]` : sans lui, `atelier set-tdd` (§5) refuserait, ou écrirait dans la spec d'un chantier précédent de la branche. Dis-le à l'utilisateur en une phrase. Ensuite, chaque retouche de la spec est commitée et poussée comme en §7 : un conteneur éphémère perd ce qui n'est pas poussé.

## 4. Remplir la spec

Sources possibles, à exploiter avant de poser la moindre question :

- **Lien Notion** : récupère la page avec l'outil Notion et reporte son contenu dans les sections correspondantes. Ne recopie pas le brouillon tel quel : reformule dans la structure du template, sans rien inventer. Note le lien dans l'en-tête (`notion:`).
- **Lien Sentry ou issue** (surtout pour un `FIX`) : récupère trace, breadcrumbs, release, volume, et rédige problème, reproduction et cause probable avec sa preuve. Note la source dans l'en-tête (`source:`).
- **Description dans les arguments ou la conversation.**
- **Le code** : lis les fichiers concernés pour ancrer la spec dans la réalité (noms exacts, couches, contraintes).

Puis, **section par section**, pose des questions **uniquement** quand une section est :
- absente ou vide ;
- imprécise (ex. « rapide », « simple », sans valeur ni seuil) ;
- invérifiable (un critère d'acceptation qui ne peut pas devenir un test automatique) ;
- contredite par le code ;
- marquée « N/A » sans raison.

**Relations** (en-tête, préfixe `rel_`, un identifiant ou plusieurs séparés par des virgules) : `rel_parent` (l'EPIC auquel le chantier appartient, un seul), `rel_depends_on` (chantiers à livrer avant celui-ci), `rel_origin` (le chantier dont il découle : SPIKE, régression, suite d'un bilan), `rel_replaces` (chantier abandonné qu'il reprend). Le lien se déclare chez l'enfant seulement. Ne pose une question sur les relations que si le contexte en suggère une (un EPIC ouvert sur le sujet, un SPIKE cité, un chantier prérequis), sauf le parent quand un EPIC à branche d'intégration est ouvert : il a déjà été demandé au §3, avant la branche. Un EPIC peut avoir un EPIC pour parent : au-delà de deux niveaux d'imbrication, mets en garde (découpage sans doute trop fin).

**EPIC à branche d'intégration** (`integration_branch: yes`, EPIC seulement, absent ou `no` par défaut) : propose-la quand les lots ne doivent rejoindre la branche par défaut qu'ensemble (fonctionnalité incomplète tant que tous les lots ne sont pas livrés). La branche de l'EPIC devient alors la base de ses enfants : ils en partent, y sont fusionnés par commit de fusion, et une revue d'ensemble précède la fusion de l'EPIC dans la branche par défaut. L'option se fige à la signature et impose des fusions par commit de fusion : un dépôt réglé pour n'accepter que le squash ne peut pas l'utiliser. Ne la propose pas si rien ne suggère ce besoin.

Ne fais jamais confirmer ce qui est déjà écrit et correct. Les commentaires `<!-- -->` du template donnent les questions utiles par section. Pose au plus 5 questions à la fois, groupées, en citant la section.

Règles d'écriture :
- Critères d'acceptation numérotés `CA-1`, `CA-2`… au format « Étant donné …, quand …, alors … », chacun testable.
- Laisse les commentaires du template en place : ils guident les relectures suivantes.
- Ne tranche pas le périmètre à la place de l'utilisateur : propose, il décide.

## 5. Décider : TDD ou pas ?

Cette décision appartient à l'utilisateur : **pose toujours la question**, même si tout le reste de la spec est complet, sauf s'il y a déjà répondu (champ `tdd` renseigné ou réponse explicite dans la conversation).

Formule-la avec ta recommandation, en une ou deux lignes : « Faut-il mener ce chantier en TDD (tests écrits, commités et figés avant l'implémentation) ? Je recommande oui / non, parce que … ».

Repères pour recommander :
- **Oui** quand le comportement se décrit en paires entrée / sortie vérifiables : logique métier, calculs, règles d'autorisation, transformations de données, bug reproductible, refactor d'un code sensible.
- **Non** quand un test coûterait plus qu'il ne protège : configuration, montée de version, changement de texte ou de mise en page, prototype, exploration, câblage trivial déjà couvert ailleurs.
- Par défaut selon le type : `FEAT`, `FIX`, `REF` → plutôt oui ; `TEC`, `SPIKE` → plutôt non. Le contenu du chantier prime sur le type.

« Non » ne veut pas dire « aucun test » : des tests peuvent être ajoutés là où ils ont de la valeur, simplement sans phase imposée. Pas de test pour le principe.

Ce `tdd` du chantier est la valeur par défaut des tranches : le plan pourra déclarer chaque tranche « TDD : oui » ou « TDD : non ».

Enregistre la réponse : `atelier set-tdd yes` ou `atelier set-tdd no [raison]`.

**EPIC** : ne pose pas la question. Un EPIC n'implémente rien, il est toujours en `tdd: no` (déjà dans son template ; `atelier set-tdd yes` est refusé).

## 6. Vérifier

Lance `atelier check-spec docs/chantiers/<ID>-<slug>/spec.md`. Il vérifie aussi les relations (identifiants connus dans les branches, parent unique et EPIC non clos, ni auto-référence ni cycle). Tant qu'il reste des points, traite-les avec l'utilisateur ou note ceux qu'il choisit de laisser pour plus tard.

## 7. Fin

Commite la spec seule, même en brouillon (si tout est déjà commité et poussé, étape 6 du §3, il n'y a rien à faire) :

```
git add <dossier du chantier>/spec.md
git commit -m "docs(chantiers): [<ID>] spec draft" -- <dossier du chantier>/spec.md
```

Le `--` limite le commit à la spec, même si d'autres fichiers étaient déjà dans l'index.

Puis pousse-le, sauf si l'utilisateur le refuse explicitement : le sujet de ce commit, visible de tous après un `git fetch`, **réserve l'identifiant**, quel que soit le nom de la branche distante.
- Si la branche courante suit une branche distante **autre que la branche par défaut** (par exemple une branche imposée par l'environnement) : `git push <remote> HEAD:<nom distant>`, où `<nom distant>` est `git config branch.<branche>.merge` sans `refs/heads/` (jamais la sortie de `@{u}`, préfixée par le remote : elle créerait une branche distante `origin/…`). Garde cette forme explicite : un `git push` nu est refusé quand les noms local et distant diffèrent.
- Sinon (pas de suivi, ou suivi de la branche par défaut) : `git push -u <remote> <branche>`. **Ne pousse jamais le brouillon sur la branche par défaut.**
- Si le push échoue, dis-le : l'identifiant n'est pas réservé tant que le commit n'est pas poussé.

Indique ensuite : `/atelier:sign` quand la spec te convient.
