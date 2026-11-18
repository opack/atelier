# Corriger un bug : la voie rapide

Un bug ne doit pas coûter une demi-journée de process. La voie rapide garde l’essentiel (intention tracée, signature, preuve de correction) en quelques minutes.

## Le déroulé

1. **L’agent rédige la spec** `FIX` à partir de la source : trace Sentry, breadcrumbs, release, volume, ou issue. Il remplit problème, reproduction et **cause probable avec sa preuve**.
2. **Il ne pose des questions que sur ce qu’il ne peut pas établir.**
3. **Vous signez.**
4. **Test de non-régression** qui reproduit le bug, rouge (si TDD).
5. **Correction**, contrôles verts.
6. **Bilan court** : cause réelle, correction, autres endroits où le même schéma existe.

Objectif : moins de cinq minutes de surcoût par rapport à une correction sans process.

## Avec atelier aujourd’hui

```text
/atelier:new FIX <lien Sentry ou description>
/atelier:sign
/atelier:tests      (si TDD)
/atelier:build
/atelier:close
```

::: info Bientôt
Une commande `/atelier:fix <source>` enchaînera ces étapes. Elle sera ajoutée quand l’usage l’aura précisée.
:::

## Les questions qui comptent

- Arrive-t-on à reproduire ? Sinon, quel signal prouvera la correction (zéro événement Sentry sur la release suivante) ?
- Qu’est-ce qui **prouve** la cause, au-delà de l’intuition ?
- Corrige-t-on la cause ou le symptôme ?
- Le même schéma existe-t-il ailleurs dans le code ?
- Des données déjà corrompues sont-elles à réparer ?
