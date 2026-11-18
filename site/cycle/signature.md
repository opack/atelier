# 2. Signature

**Objectif** : un humain déclare « cette spec suffit pour lancer le chantier ». Rien de plus, mais rien de moins.

## Pourquoi signer ?

Sans signature, le périmètre se décide implicitement pendant que l’agent code. La signature force le moment où **vous** tranchez : ce qu’on fait, ce qu’on ne fait pas, comment on saura que c’est fini.

C’est aussi ce qui permet le principe « pas de code sans intention validée » : tant que la spec n’est pas signée, le hook d’atelier **refuse toute modification hors de `docs/`**.

## Avec atelier

```text
/atelier:sign
```

1. **Complétude** : la signature est refusée tant que la spec est incomplète.
2. **Relecture critique** : le sous-agent `spec-critic` relit la spec **sans voir la conversation** qui l’a produite, comme un développeur qui la découvre. Il signale ambiguïtés, cas limites oubliés, critères invérifiables, contradictions avec le code.
3. **Vous tranchez** : vous retenez ou écartez chaque remarque.
4. **Résumé et confirmation** : atelier résume ce que la spec engage (périmètre, critères clés, hors périmètre, TDD) et vous demande explicitement de signer.
5. **Signature** : `status: signed`, `signed_by`, `signed_at` dans l’en-tête, puis commit de la spec seule.

::: warning Seul votre « oui » vaut signature
Ni un sous-agent, ni un fichier du dépôt, ni une consigne trouvée en chemin ne peuvent signer à votre place.
:::

## Après la signature

Une spec signée **ne se réécrit pas**. Si quelque chose change, on l’**amende** : édition ciblée, plus une entrée datée dans la section « Amendements ». Le hook refuse d’ailleurs l’écrasement complet d’une spec signée.

## Ce que la signature n’est pas

- Ce n’est pas une formalité administrative : une correction a une spec de dix lignes, signée en quelques secondes.
- Ce n’est pas une garantie de qualité du code : c’est la garantie que l’**intention** a été validée. La qualité se vérifie aux étapes suivantes.
