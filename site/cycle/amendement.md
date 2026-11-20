# Amender la spec

**Objectif** : corriger une spec signée qui s’avère fausse ou incomplète, sans perdre la trace ni la décision humaine.

Une spec signée est un engagement : elle ne se réécrit pas, elle s’**amende**. C’est le cas le plus courant après la signature : un critère mal formulé, un cas limite oublié, une contrainte découverte en codant.

## Avec atelier

```text
/atelier:amend <ce qui change, et pourquoi>
```

0. **Si la décision TDD change** : votre accord à part, `atelier set-tdd`, commit aussitôt, avant le reste de l’amendement.
1. **Entrée datée d’abord** : une ligne `- AAAA-MM-JJ : quoi, pourquoi` à la fin de la section « Amendements ».
2. **Éditions ciblées** de la spec, jamais une réécriture.
3. **Impact** : critères ajoutés, modifiés, supprimés (pour un `TEC`, points de vérification), et ce qu’ils entraînent (tests, code, revue).
4. **Nouvel accord** : vous validez l’amendement. C’est une petite re-signature : le commit `amend spec` en est la trace, `signed_by` et `signed_at` restent ceux de la signature initiale. Sans votre accord, les modifications de la spec sont annulées. Pour que cette annulation ne perde rien d’autre, la commande exige au départ une spec sans changement non commité.
5. **Suite** : en TDD, si des critères ont bougé, on rouvre les tests (`/atelier:write-tests <raison>`) ; sinon, retour à l’implémentation ou à la revue.

## Ce que le hook garantit

Dès que la spec n’est plus en brouillon, le hook refuse :

- toute modification du corps ou du titre **sans nouvelle entrée datée** dans « Amendements » ;
- la modification ou la suppression d’une entrée existante, et l’insertion d’une entrée avant elle : on ne fait qu’ajouter, à la fin ;
- une seconde section « Amendements » ;
- la réécriture complète de la spec ;
- la modification de `id`, `type` et `tdd` (ce dernier ne change que par `atelier set-tdd`, tracé en amendement), et des champs écrits par la commande.

La comparaison se fait avec la **version commitée** de la spec : on peut écrire l’entrée, puis modifier la spec en plusieurs éditions. Conséquence : une modification non commitée sans entrée, même faite par vous, bloque les éditions suivantes de l’agent jusqu’à son commit ou l’ajout d’une entrée.

Le hook garantit qu’une modification laisse une **trace datée**. Il ne vérifie pas que l’entrée décrit bien la modification : c’est votre nouvel accord qui en juge.

## Amendement ou nouveau chantier ?

| Situation | Bonne voie |
|---|---|
| Erreur, oubli, critère mal formulé, petit ajout | Amendement |
| Le périmètre grossit vraiment | Nouveau chantier (`/atelier:new`) |
| La spec a été signée par erreur | Abandon (`atelier set-status abandoned`), puis nouveau chantier |

Une spec signée ne repasse jamais en brouillon : sinon, il suffirait de la repasser en brouillon pour la modifier librement, puis de la re-signer.
