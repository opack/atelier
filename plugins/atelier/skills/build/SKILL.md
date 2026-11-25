---
description: Étapes 4 et 5 du TDD pour le chantier actif — faire implémenter la tranche par le sous-agent implementer jusqu'à ce que tous les tests passent sans jamais les modifier, vérifier l'absence de surapprentissage avec un sous-agent indépendant, puis commiter après validation.
argument-hint: "[modèle] [effort] [tranche, seulement pour un SPIKE sans TDD]"
---

# Implémenter (TDD, étapes 4 et 5)

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Tu travailles sur **la tranche en cours** (`slice` dans `atelier status --json`, `null` pour un chantier à tranche unique : tout le chantier). **Tu n'écris pas le code toi-même** : tout le code de cette commande passe par le sous-agent `atelier:implementer`. Toi, tu le lances, tu contrôles, tu fais valider et tu commites.

Pendant la revue du chantier (`slice: "chantier"`), les corrections des points de cette revue sont confiées elles aussi à `atelier:implementer`, avec leurs identifiants (`RB2`…).

## 0. Préalables

- `atelier status --json` : spec **signée**. Si `testDrivenPhase` vaut `writing-tests`, arrête-toi : les tests ne sont pas encore écrits et commités, propose `/atelier:write-tests`.
- Si `testDrivenPhase` vaut `none` (`tdd: no`, ou tranche « TDD : non » d'un chantier TDD), suis la section « Sans TDD » en fin de document à la place des étapes 1 et 2.
- Lis la spec, `plan.md` et `decisions.md` s'ils existent, puis les tests figés du chantier.

### Modèle et effort des sous-agents

Une seule fois pour toute la commande, relances comprises, lance :

```
atelier agent-settings implementer --user-model '${user_config.implementer_model}' --user-effort '${user_config.implementer_effort}' --args '$ARGUMENTS'
```

puis, en TDD seulement (sans TDD, `overfit-checker` n'est pas lancé), sans l'argument de la commande, qui ne règle qu'`implementer` :

```
atelier agent-settings overfit-checker --user-model '${user_config.overfit_checker_model}' --user-effort '${user_config.overfit_checker_effort}'
```

Si l'argument de la commande ou une valeur d'option substituée dans la ligne contient une apostrophe, arrête-toi sans lancer la commande et demande de la retirer : ces valeurs sont placées entre guillemets simples. Si la commande échoue, affiche son message et arrête-toi. Sinon, chacune rend en JSON `model`, `effort`, leurs sources (`argument`, `utilisateur`, `recommandé`), des avertissements et `rest`, le reste de l'argument. Annonce le modèle, l’effort, leur source et les avertissements, par exemple « implementer : sonnet / medium (recommandé) ». Passe `model` et `effort` à l’appel du sous-agent, à chaque lancement. Si cet appel est refusé parce que le modèle n'est pas disponible pour l'organisation, arrête-toi et indique l'argument de la commande ou l'option (`/plugin configure atelier`) à changer.

Le `rest` d'`implementer` est le reste de l'argument, une fois retirés le modèle et l'effort :
- **`SPIKE` sans TDD**, hors du découpage en tranches : `rest` est la tranche demandée (vide : la prochaine tranche non faite de `plan.md`). S'il ne désigne aucune tranche de `plan.md`, arrête-toi et dis-le.
- **Ailleurs**, `build` n'attend pas d'autre mot : un `rest` qui est un numéro de tranche est ignoré (dis-le) ; tout autre mot fait arrêter, car c'est probablement un modèle ou un effort mal écrit (`opsu`, `inherit`) : dis-le, avec les valeurs possibles.

## 1. Faire implémenter jusqu'à ce que tous les tests passent

**Règle absolue : personne ne modifie les tests.** Ils sont commités et figés : le hook d'atelier refuse toute écriture dans un fichier de test, y compris par un sous-agent, et le contrôle de fin signale tout test modifié par un autre moyen.

1. Lance le sous-agent `atelier:implementer` avec le chemin de la spec, de `plan.md` et de `decisions.md`, la tranche en cours et ses `CA`, les fichiers de test figés de la tranche, et sa mission : implémenter la tranche (ou corriger tels points, avec leurs identifiants).
2. Après chaque retour d’`implementer`, lance `atelier checks` toi-même. Tant qu'un contrôle échoue, relance `atelier:implementer` avec les échecs, sans demander l'avis de l'utilisateur à chaque itération. Si le hook de fin te renvoie au travail, fais de même : relance `implementer`, ne corrige pas toi-même, sauf après un « Arrêt : test à revoir » : réponds alors au hook en rappelant cet arrêt, sans relancer.
3. Si son compte rendu commence par « Arrêt : test à revoir », ne le relance pas : présente sa raison à l'utilisateur. C'est à lui de décider de rouvrir les tests (`/atelier:write-tests <raison>`) ou, si c'est la spec qui est fausse, de l'amender (`/atelier:amend`).
4. Consigne dans `decisions.md` les décisions qu'`implementer` te rend (une entrée datée, option écartée et raison) : il n'y écrit pas lui-même.

## 2. Vérifier l'absence de surapprentissage

Quand tout est vert, `atelier review-ids --json` donne le premier numéro libre des points de surapprentissage (`next.OB`, `next.OD`). Lance le sous-agent `atelier:overfit-checker` avec le chemin de la spec, la liste des fichiers de test et des fichiers d'implémentation de la tranche, et ces deux numéros. Il vérifie, sans rien modifier, que l'implémentation résout le problème général et ne se contente pas de satisfaire les tests.

Présente ses points (`OB1`, `OD1`…). Présente chaque point par son identifiant suivi d'un résumé du problème en quelques mots, puis la correction proposée, ses deux coûts (correction, non-correction), le verdict du relecteur et ton avis : `OD1, la liste vide n'est pas traitée : je propose…, ça coûte…, sinon…, avis : …`. Corriger n'est pas le choix par défaut : l'utilisateur tranche avec les deux coûts sous les yeux. Ses **idées** de relance, sans identifiant, se citent en une ligne, sans traitement.

Si tu relances le sous-agent dans la même session après des corrections, c'est une **relance** : dis-le-lui et donne-lui les points du passage précédent et les fichiers modifiés depuis ; continue la numérotation à la suite de ce que tu as déjà présenté. Un passage dans une nouvelle session est un premier passage. Les corrections des points que l'utilisateur retient sont confiées à `atelier:implementer`, avec leurs identifiants, toujours sans toucher aux tests ; puis `atelier checks` comme à l'étape 1. Si un point révèle un test trop faible, ne le fais pas renforcer : signale-le à l'utilisateur. Un point reporté, accepté ou écarté pour une raison qui compte se note dans `decisions.md`, avec son identifiant.

## 3. Faire valider, puis commiter

Présente un résumé de la tranche : fichiers modifiés, tests passés, points du sous-agent traités ou écartés. **Demande à l'utilisateur s'il est satisfait.**

Seulement après son accord :
1. Vérifie `atelier tests-changed` : aucun test ne doit avoir changé depuis leur commit.
2. Commite la tranche : `<prefix>(<scope>): [<ID>] <description>` (un commit par tranche). Un commit qui corrige un point de revue le cite après l'identifiant du chantier : `fix(<scope>): [<ID>] RB2 <description>`.
3. Suite : `/atelier:review`, la revue de la tranche (ou du chantier si tu corrigeais ses points). C'est la validation de cette revue qui fait passer à la tranche suivante. Pour un `SPIKE` sans TDD : la tranche suivante du plan (`/atelier:build <tranche>`), puis `/atelier:close` (revue facultative).

## Sans TDD (`tdd: no`, ou tranche « TDD : non »)

Dans une tranche « TDD : non » d'un chantier TDD, les tests comptent comme du code de la tranche : ils ne sont pas figés.

1. Lance le sous-agent `atelier:implementer` comme à l'étape 1, avec la mission d'implémenter la tranche sans TDD : il ajoute des tests **seulement là où ils ont de la valeur** (logique non triviale, cas limite fragile, bug évité), pas de test pour le principe ni de test redondant avec ceux qui existent.
2. Après chaque retour, `atelier checks`, et relance `implementer` jusqu'à ce que tout soit vert, comme à l'étape 1 : arrêt sur « Arrêt : test à revoir » (point 3) et décisions consignées dans `decisions.md` (point 4).
3. Puis l'étape 3 ci-dessus : résumé, validation de l'utilisateur, commit.
