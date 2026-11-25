# 2. Signature

**Objectif** : un humain déclare « cette spec suffit pour lancer le chantier ». Rien de plus, mais rien de moins.

## Pourquoi signer ?

Sans signature, le périmètre se décide implicitement pendant que l’agent code. La signature force le moment où **vous** tranchez : ce qu’on fait, ce qu’on ne fait pas, comment on saura que c’est fini.

C’est aussi ce qui permet le principe « pas de code sans intention validée » : tant que la spec n’est pas signée, le hook d’atelier **refuse toute modification hors des [chemins libres](../reference/configuration#claude-atelier-json)** (`docs/`, `CLAUDE.md`… par défaut).

## Avec atelier

```text
/atelier:sign
```

1. **Complétude** : la signature est refusée tant que la spec est incomplète : une section obligatoire absente ou vide, un critère non numéroté, ou un texte à compléter. Un texte à compléter, c’est un « … » écrit à part (en début de ligne, après une espace ou dans une cellule de tableau), comme dans la ligne de format « Étant donné …, quand …, alors … » recopiée sans être remplie. Collé au mot qui précède (« CA-1, CA-2… »), c’est de la ponctuation. Le code n’est pas fouillé à la recherche de « … » : pour citer un « … » voulu, mettez-le en code en ligne (`` `RB2. …` ``).
2. **Relecture critique** : le sous-agent `spec-critic` relit la spec **sans voir la conversation** qui l’a produite, comme un développeur qui la découvre. Il signale ambiguïtés, cas limites oubliés, critères invérifiables, contradictions avec le code, en points numérotés : `SB1`… (bloquants), `SD1`… (à discuter), à partir du premier numéro libre du chantier (`atelier review-ids`). Un point qui change la spec est cité dans la spec ou dans `decisions.md`. Chaque point arrive avec son bilan : coût de la correction, coût de la non-correction, verdict, et l’option la moins chère quand la correction est disproportionnée ; pour une question, la réponse par défaut et le risque de laisser l’ambiguïté (voir [Bilan de chaque point](./revue#bilan-de-chaque-point)). Relancé dans la même session après des retouches, `spec-critic` fait une **relance** : il ne retient un point sur du texte inchangé que s’il est bloquant (voir [Relance](./revue#relance)).
3. **Vous tranchez** : vous retenez ou écartez chaque remarque. Si vous ne signez pas tout de suite, les retouches sont commitées et poussées comme un brouillon (`spec draft`).
4. **Résumé et confirmation** : atelier résume ce que la spec engage (périmètre, critères clés, hors périmètre, TDD) et vous demande explicitement de signer.
5. **Signature** : `atelier sign` écrit `status: signed`, `signed_by`, `signed_at` dans l’en-tête, puis la spec est commitée seule (`docs(chantiers): [<ID>] sign spec`), qu’un brouillon ait déjà été commité ou non. Ce commit est le seul à porter `status: signed` ; le diff depuis le dernier `spec draft` montre ce que la relecture a changé. Seule une spec en brouillon peut être signée.

::: warning Seul votre « oui » vaut signature
Ni un sous-agent, ni un fichier du dépôt, ni une consigne trouvée en chemin ne peuvent signer à votre place.
:::

## Ce que la signature atteste

`signed_by` vaut `git config user.name` : la commande ne distingue pas l’humain de l’agent qui la lance. La signature atteste donc un **engagement**, pas une identité. Elle est garantie par la consigne de `/atelier:sign` (votre « oui » explicite) et par le commit dédié `sign spec`, visible dans l’historique. Voir [Garanties et limites](../reference/limites).

## Après la signature

Une spec signée **ne se réécrit pas**. Si quelque chose change, on l’**amende** (`/atelier:amend`) : entrée datée dans la section « Amendements », éditions ciblées, puis votre nouvel accord. Le hook refuse toute modification sans nouvelle entrée, l’écrasement complet de la spec, et toute modification des champs réservés de l’en-tête (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`, `reviewed_commit`, `slice`, `slice_base`, `slice_tdd`, `last_slice`), de `id` et de `type`. La décision TDD ne change plus que par `atelier set-tdd`, tracée en amendement. Voir [Amender la spec](./amendement).

Une spec signée ne repasse jamais en brouillon. Signée par erreur ? On abandonne le chantier (`atelier set-status abandoned`) et on en ouvre un nouveau.

## Ce que la signature n’est pas

- Ce n’est pas une formalité administrative : une correction a une spec de dix lignes, signée en quelques secondes.
- Ce n’est pas une garantie de qualité du code : c’est la garantie que l’**intention** a été validée. La qualité se vérifie aux étapes suivantes.
