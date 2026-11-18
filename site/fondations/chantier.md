# Le chantier

Le **chantier** est l’unité de travail d’atelier : une modification du logiciel, de l’intention au bilan.

> Un chantier = un identifiant, un dossier, une branche, une PR.

## L’identifiant

Format `<TYPE>-<numéro>` : `FEAT-412`, `FIX-431`, `TEC-437`.

- Le **compteur est unique par projet**, tous types confondus. `FIX-431` peut suivre `FEAT-430`.
- Sans identifiant fourni, `/atelier:new` prend le numéro suivant le plus grand déjà utilisé, y compris dans l’historique git (les anciens préfixes comme `FEA-26` ou `BUG-421` comptent).

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

atelier déduit le chantier en cours **du nom de la branche**. Sur `main`, il n’y a pas de chantier actif : le code y est bloqué. C’est voulu : on ne travaille pas directement sur la branche principale.

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

Supprimer le plugin ne fait rien perdre : tout est lisible dans git.
