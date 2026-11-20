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

## Le chantier actif

atelier déduit le chantier en cours **du nom de la branche**. Le code est bloqué :

- sur une branche sans chantier (`main`, HEAD détachée) : on ne travaille pas directement sur la branche principale ;
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

Supprimer le plugin ne fait rien perdre : tout est lisible dans git.
