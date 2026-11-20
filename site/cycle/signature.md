# 2. Signature

**Objectif** : un humain déclare « cette spec suffit pour lancer le chantier ». Rien de plus, mais rien de moins.

## Pourquoi signer ?

Sans signature, le périmètre se décide implicitement pendant que l’agent code. La signature force le moment où **vous** tranchez : ce qu’on fait, ce qu’on ne fait pas, comment on saura que c’est fini.

C’est aussi ce qui permet le principe « pas de code sans intention validée » : tant que la spec n’est pas signée, le hook d’atelier **refuse toute modification hors des [chemins libres](../reference/configuration#claude-atelier-json)** (`docs/`, `CLAUDE.md`… par défaut).

## Avec atelier

```text
/atelier:sign
```

1. **Complétude** : la signature est refusée tant que la spec est incomplète.
2. **Relecture critique** : le sous-agent `spec-critic` relit la spec **sans voir la conversation** qui l’a produite, comme un développeur qui la découvre. Il signale ambiguïtés, cas limites oubliés, critères invérifiables, contradictions avec le code.
3. **Vous tranchez** : vous retenez ou écartez chaque remarque.
4. **Résumé et confirmation** : atelier résume ce que la spec engage (périmètre, critères clés, hors périmètre, TDD) et vous demande explicitement de signer.
5. **Signature** : `atelier sign` écrit `status: signed`, `signed_by`, `signed_at` dans l’en-tête, puis la spec est commitée seule. Seule une spec en brouillon peut être signée.

::: warning Seul votre « oui » vaut signature
Ni un sous-agent, ni un fichier du dépôt, ni une consigne trouvée en chemin ne peuvent signer à votre place.
:::

## Ce que la signature atteste

`signed_by` vaut `git config user.name` : la commande ne distingue pas l’humain de l’agent qui la lance. La signature atteste donc un **engagement**, pas une identité. Elle est garantie par la consigne de `/atelier:sign` (votre « oui » explicite) et par le commit dédié `sign spec`, visible dans l’historique. Voir [Garanties et limites](../reference/limites).

## Après la signature

Une spec signée **ne se réécrit pas**. Si quelque chose change, on l’**amende** : édition ciblée, plus une entrée datée dans la section « Amendements ». Le hook refuse l’écrasement complet d’une spec signée, et toute modification des champs réservés de l’en-tête (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`). La décision TDD ne change plus que par `atelier set-tdd`, tracée en amendement.

## Ce que la signature n’est pas

- Ce n’est pas une formalité administrative : une correction a une spec de dix lignes, signée en quelques secondes.
- Ce n’est pas une garantie de qualité du code : c’est la garantie que l’**intention** a été validée. La qualité se vérifie aux étapes suivantes.
