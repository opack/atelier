---
id: TEC-5
type: TEC
title: Commiter la spec en brouillon
status: draft
tdd: no
created_at: 2026-11-20
signed_by:
signed_at:
---

# TEC-5 Commiter la spec en brouillon

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
`/atelier:new` commite systématiquement la spec en brouillon à sa fin (`docs(chantiers): [<ID>] spec draft`) au lieu d'interdire tout commit avant la signature, et le pousse : le sujet de ce commit, visible de tous après un `git fetch`, réserve l'identifiant, quel que soit le nom de la branche distante. Il récupère le remote (`git fetch`) avant de choisir l'identifiant. `/atelier:sign` fonctionne qu'un ou plusieurs commits de brouillon existent ou non, et le commit `sign spec` reste le seul à porter `status: signed`.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- `plugins/atelier/skills/new/SKILL.md` §7 dit « Ne commite pas encore : la spec est commitée à la signature. »
- Dans une session Claude Code cloud, le conteneur est éphémère et un hook de fin de tour exige que tout fichier non suivi soit commité et poussé. La spec de FEAT-4 (autre projet) a donc dû être commitée en brouillon (`docs(chantiers): [FEAT-4] spec draft`), contre la consigne. TEC-3 l'a fait aussi (`docs(chantiers): [TEC-3] draft spec`).
- Une consigne que l'environnement oblige à violer n'est plus une consigne : l'agent apprend à l'ignorer. Et un brouillon non commité se perd avec le conteneur, ou entre deux sessions locales.
- **Collision d'identifiants** : `atelier next-id` cherche le plus grand numéro dans les dossiers de chantier, l'historique et les branches connues localement (`collectUsedIdentifiers`, `plugins/atelier/lib/core.mjs`), sans `git fetch`. Ce chantier a d'abord reçu `TEC-4` alors que `FEAT-4` existait déjà sur le remote. Et tant qu'un commit du chantier n'est pas poussé, personne d'autre ne sait que son numéro est pris. Commiter le brouillon sans le pousser ne règle que la moitié du problème.
- `collectUsedIdentifiers` lit déjà les sujets de commits de toutes les branches (`git log --all --format=%s`) : un commit `[<ID>] spec draft` poussé sur n'importe quelle branche, y compris une branche imposée `claude/...`, suffit à réserver le numéro. Pousser une branche nommée `<type>/<ID>-<slug>` n'est pas nécessaire, et c'est impossible dans une session cloud.
- La consigne n'apporte rien : ce qui atteste la signature, c'est `status: signed` écrit par `atelier sign` et le commit dédié `sign spec`, pas le fait que la spec n'ait jamais été commitée avant. Commiter le brouillon ajoute même une trace utile : le diff `spec draft` → `sign spec` montre ce que la relecture critique a changé.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->
- Inclus :
  - `plugins/atelier/skills/new/SKILL.md` :
    - §1 : en reprenant un chantier existant en brouillon, toute retouche de la spec est commitée et poussée comme en §7, avec le même message ;
    - §3 : quand l'identifiant n'est pas fourni par l'utilisateur, `git fetch --quiet <remote>` avant `atelier next-id` ; un échec est signalé, sans bloquer. Le remote est celui de suivi de la branche courante, sinon `origin`, sinon le seul remote existant ; s'il y en a plusieurs sans qu'aucune de ces règles ne tranche, demander. Pas de remote : ni fetch ni push ;
    - §7 : toujours commiter la spec seule à la fin, `git add <dossier>/spec.md` puis `git commit -m "docs(chantiers): [<ID>] spec draft" -- <dossier>/spec.md` (le `--` exclut tout ce qui était déjà dans l'index), puis pousser, sauf refus explicite de l'utilisateur :
      - si la branche courante a une branche de suivi (cas d'une branche imposée par l'environnement) : `git push <remote> HEAD:<branche de suivi>`, forme explicite (un `git push` nu est refusé par `push.default=simple` quand les noms local et distant diffèrent) ;
      - sinon : `git push -u <remote> <branche>` ;
      - si le push échoue, le dire : l'identifiant n'est pas réservé.
  - `plugins/atelier/skills/sign/SKILL.md` :
    - §2 : si l'utilisateur ne signe pas au bout de la relecture, les retouches de la spec sont commitées et poussées en `docs(chantiers): [<ID>] spec draft`, comme dans `new` §7 ;
    - §4 : le commit de signature fonctionne qu'un brouillon ait déjà été commité ou non ; il emporte aussi les retouches issues de la relecture critique non commitées. La spec seule, toujours : `git commit -m "docs(chantiers): [<ID>] sign spec" -- <dossier>/spec.md`.
  - `plugins/atelier/test/core.test.mjs` : tests qui figent le comportement de la garde de spec (`specWriteRefusal`, via `decideWrite`) quand la version commitée est un brouillon (voir §5).
  - Site : `site/cycle/intention.md` (étape « commit du brouillon » dans « Avec atelier »), `site/cycle/signature.md` (étape 5 : la spec est commitée, qu'un brouillon l'ait été ou non ; seul le commit `sign spec` porte `status: signed`), `site/reference/commandes.md` (ligne `/atelier:new` : commit et push du brouillon).
  - `README.md` si une ligne y contredit la nouvelle consigne (aucune trouvée à l'ouverture).
- Hors périmètre :
  - toute modification de `lib/core.mjs` ou `lib/cli.mjs` : l'analyse (§4) montre que la garde est déjà correcte ;
  - la reconnaissance du chantier actif sur une branche dont le nom ne porte pas d'identifiant (branche imposée `claude/...`) : traitée par TEC-6 (`tec/TEC-6-chantier-hors-branche`), qui s'appuie sur le commit `[<ID>] spec draft` rendu systématique ici ;
  - la fenêtre de course entre `git fetch` et `git push` (deux personnes qui ouvrent un chantier dans la même minute) : le doublon n'est pas détecté (branches et dossiers de noms différents, les push et la fusion passent) et ne se voit que dans l'historique. Risque rare, accepté ; pas de mécanisme de verrou ;
  - un `git fetch` fait par `atelier next-id` lui-même (la CLI reste sans accès réseau) ;
  - un hook ou une commande `atelier` qui ferait le commit à la place du skill.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->
- **Historique et remote** : un ou plusieurs commits `spec draft` de plus par chantier, avant `sign spec`, et une branche de chantier visible sur le remote dès son ouverture (y compris pour un chantier abandonné ensuite) ; c'est assumé, l'utilisateur peut refuser le push. Le relecteur d'une PR lit toujours la signature dans le commit `sign spec`.
- **Numéros consommés** : un commit `[<ID>] spec draft` poussé consomme le numéro pour de bon, puisque `next-id` lit les sujets de commits de toutes les branches. Un chantier renuméroté ou abandonné laisse son numéro pris (déjà le cas de `[TEC-4] spec draft`, renuméroté en TEC-5). C'est le prix de la réservation.
- **Garde de la spec** (`specWriteRefusal`, `plugins/atelier/lib/core.mjs`), analysée à l'ouverture :
  - la spec est « gardée » si la version de travail **ou** la version commitée n'est pas en brouillon. Une version commitée en brouillon ne garde rien : elle se comporte exactement comme une spec absente de `HEAD` (`committedSpec` à `null`) ;
  - entre `atelier sign` et le commit `sign spec`, la version de travail est signée et la version commitée est le brouillon : la spec est gardée par la version de travail, et la référence des amendements est la version de travail (puisque la commitée est en brouillon). C'est le même comportement que sans commit de brouillon ;
  - repasser `status` de `signed` à `draft` par l'outil d'édition reste refusé (champ réservé à la commande), avec ou sans brouillon commité.
  - Conclusion : aucun changement de code nécessaire, seulement des tests qui le prouvent.
- **Clôture et revue** : `set-reviewed` exige une spec commitée, `close-check` compare au commit revu ; un commit de brouillon antérieur à la signature n'y change rien.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
- `npm test` vert, avec de nouveaux tests dans `plugins/atelier/test/core.test.mjs` :
  - V-1 : version commitée en brouillon, version de travail en brouillon → réécriture complète (`Write`) et éditions libres acceptées, sauf les champs réservés à la commande (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`, `reviewed_commit`) ;
  - V-2 : version commitée en brouillon, version de travail signée (après `atelier sign`, avant le commit) → `Write` refusé ; édition du corps sans nouvelle entrée datée refusée ; édition avec nouvelle entrée acceptée ; retour de `status` à `draft` refusé ;
  - V-3 : pour chacun des cas de V-1 et V-2, la décision est identique à celle obtenue avec `committedSpec` à `null` (pas de brouillon commité).
- Relecture des deux skills :
  - `new` §1 commite et pousse les retouches d'un brouillon repris ; `new` §3 récupère le remote avant `next-id` (sauf identifiant fourni) avec la règle de choix du remote ; `new` §7 commite la spec seule (`-- <dossier>/spec.md`) puis pousse vers la branche de suivi existante ou une nouvelle branche ;
  - `sign` §2 commite et pousse les retouches en l'absence de signature ; `sign` §4 commite la spec seule (`--`) et ne suppose plus que la spec est absente de l'historique.
- `site/` : `npm run build` passe ; `intention.md`, `signature.md` et `commandes.md` décrivent le commit et le push du brouillon.
- `claude plugin validate ./plugins/atelier` passe.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
`git revert` du merge : textes de skills et de site uniquement, plus des tests. Aucune donnée, aucun état.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
