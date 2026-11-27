# Le chantier

Le **chantier** est l’unité de travail d’atelier : une modification du logiciel, de l’intention au bilan.

> Un chantier = un identifiant, un dossier, une branche, une PR.

## L’identifiant

Format `<TYPE>-<numéro>` : `FEAT-412`, `FIX-431`, `TEC-437`.

- Le **compteur est unique par projet**, tous types confondus. `FIX-431` peut suivre `FEAT-430`.
- Sans identifiant fourni, `/atelier:new` récupère d’abord le remote (`git fetch`), puis prend le numéro suivant le plus grand déjà utilisé, y compris dans l’historique git de toutes les branches (les anciens préfixes comme `FEA-26` ou `BUG-421` comptent).
- Le commit du brouillon (`docs(chantiers): [<ID>] spec draft`), poussé dès l’ouverture, **réserve le numéro** : les autres le voient après leur propre `git fetch`. Un numéro réservé reste pris, même si le chantier est abandonné ou renuméroté.

## Partout le même identifiant

| Où | Format | Exemple |
|---|---|---|
| Dossier | `docs/chantiers/<ID>-<slug>/` | `docs/chantiers/FIX-431-reconnexion/` |
| Branche | `<type>/<ID>-<slug>` | `fix/FIX-431-reconnexion` |
| Commits | `<prefix>(<scope>): [<ID>] <description>` | `fix(sync): [FIX-431] disable network in background` |
| PR | `[<ID>] <titre>` | `[FIX-431] Reconnexion après mise en veille` |
| Tests | Le nom cite le critère | `CA-1 : reconnecte après 30 s en arrière-plan` |

Le type de chantier est indépendant du préfixe de commit : un chantier `TEC` peut produire des commits `fix(ci)` ou `feat(envelopes)`.

Pour parcourir les chantiers du projet sans fouiller `docs/chantiers/`, `/atelier:list` les liste (arbre courant et autres branches) avec leur statut et leur étape, et `/atelier:open <ID>` ouvre le dossier d’un chantier de l’arbre courant.

## Le chantier actif

atelier déduit le chantier en cours **du nom de la branche** (`<type>/<ID>-<slug>`).

Quand la branche est imposée et ne porte pas d’identifiant (session Claude Code cloud sur `claude/...`, convention d’équipe comme `feature/JIRA-123`), atelier lit **les commits propres à la branche** : le chantier actif est celui du commit `[<ID>]` le plus récent entre la branche par défaut (`origin/HEAD`, sinon `origin/main`, `origin/master`, `main`, `master`) et `HEAD`. `atelier status` l’indique par « (déduit des commits) ». Le chantier n’est reconnu qu’après son premier commit `[<ID>]`. Le nom de branche, s’il porte un identifiant, reste prioritaire ; sur la branche par défaut, aucune déduction.

Le code est bloqué :

- sur une branche sans chantier (`main`, HEAD détachée, branche sans commit `[<ID>]`) : on ne travaille pas directement sur la branche principale ;
- tant que la spec est en brouillon ;
- une fois le chantier clos (`done` ou `abandoned`) : une nouvelle modification, c’est un nouveau chantier.

## L’état du chantier

L’état vit dans l’en-tête de `spec.md`, pas dans un outil :

```yaml
---
id: FEAT-27
type: FEAT
title: Total des enveloppes
status: signed        # draft | signed | done | abandoned
tdd: yes              # yes | no : décision humaine
signed_by: opack
signed_at: 2026-11-18
tests_commit: 8cfa4be # posé au gel des tests, si TDD
---
```

Les champs `status`, `signed_by`, `signed_at`, `done_at` et `tests_commit` ne changent que par la commande `atelier`, et `tdd` aussi une fois la spec signée : l’agent ne peut pas les modifier avec ses outils d’édition.

## Relations entre chantiers

Un chantier en suppose un autre, naît d’un SPIKE ou d’une régression, ou contribue à un EPIC. Ces liens se déclarent dans l’en-tête de la spec, **chez l’enfant seulement** :

| Champ | Sens | Effet |
|---|---|---|
| `rel_parent` | Le chantier appartient à cet EPIC (un seul) | Affiché ; compte pour la clôture de l’EPIC |
| `rel_depends_on` | Le chantier ne peut être livré qu’après ceux-ci | Affiché avec leur statut ; vérifié à la clôture |
| `rel_origin` | Le chantier découle de celui-ci (SPIKE, régression, suite d’un bilan) | Trace seule |
| `rel_replaces` | Le chantier reprend un chantier abandonné | Trace seule |

```yaml
rel_parent: EPIC-40
rel_depends_on: FEAT-41, TEC-42
```

- **Découverts partout, jugés ici.** atelier trouve les chantiers dans toutes les branches (locales et distantes connues), mais un chantier ne compte comme clos que si son statut clos est **dans la branche courante**, c’est-à-dire fusionné. On ne livre pas un chantier dont le prérequis n’est pas dans la branche, et on ne clôt pas un EPIC pendant qu’un enfant avance ailleurs.
- **Vérifiés avant signature** : un `rel_parent` ou un `rel_depends_on` doit exister dans l’une des branches ; un seul parent, qui est un EPIC non clos ; ni auto-référence ni cycle. `rel_origin` et `rel_replaces` acceptent les identifiants historiques (`BUG-421`).
- **Une dépendance abandonnée bloque** la clôture comme une dépendance ouverte : on retire la relation par amendement, ou on dépend du chantier qui la remplace.
- **Rattachement après coup** : ajouter `rel_parent` à une spec signée passe par un amendement. Un chantier déjà clos ne se rattache pas : l’EPIC le cite dans son contexte.
- `atelier status` affiche les relations du chantier courant et, pour un EPIC, ses enfants calculés.
- **Base d’un chantier** : la branche dont il part et contre laquelle il est revu. C’est la branche par défaut, sauf pour l’enfant d’un [EPIC à branche d’intégration](./types#epic-a-branche-d-integration) : sa base est la branche d’intégration de l’EPIC ancêtre le plus proche qui déclare `integration_branch: yes`. `atelier status --json` l’expose (`baseBranch`, et l’EPIC qui l’impose dans `baseEpic`).

Supprimer le plugin ne fait rien perdre : tout est lisible dans git.
