# Décisions : FEAT-21 EPIC en branche d'intégration

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR. -->

## 2026-11-25 : un domaine `integration` porte la règle de base
- Contexte : la base sert à la revue, aux tranches, à la détection du chantier et à la clôture ; la spec exige un seul calcul.
- Écarté : la placer dans `relations` (déjà chargé des relations et de l'index, il deviendrait le fourre-tout de tout ce qui remonte `rel_parent`) ; la placer dans `core.mjs` (façade sans logique depuis REF-29).
- Conséquence : `lib/integration.mjs`, `lib/cli/integration.mjs`, `test/integration.test.mjs` ; l'index des chantiers garde le nom du dossier pour construire `epic/<ID>-<slug>`.

## 2026-11-25 : la fusion de la branche d'intégration dans un enfant suit la règle de FIX-28 (CA-15)
- Contexte : la spec, écrite avant FIX-28, périmait la revue d'un enfant à chaque fusion de la branche d'intégration.
- Écarté : garder cette règle, parce que chaque synchronisation forcerait une nouvelle revue dont les problèmes listeraient le code des enfants frères.
- Conséquence : les refs exclues du calcul du code de l'enfant incluent la branche d'intégration ; seules les résolutions de conflits sur du code comptent. Amendement du 2026-11-25.

## 2026-11-25 : quatre tranches, skills et site en dernier
- Contexte : FEAT-27 modifie les skills `review`, `build`, `sign` ; FIX-20 touche `slices`, `tdd`, `next-step`.
- Écarté : skills dans chaque tranche, parce que cela multiplie les conflits avec FEAT-27 sans gain de relecture.
- Conséquence : fusionner `main` au début de chaque tranche ; la tranche 4 attend idéalement la fusion de FEAT-27.

## 2026-11-25 : OD1 (tranche 1) reporté à la tranche 3
- Contexte : la vérification de surapprentissage note qu'aucun test en ligne de commande ne vérifie que `status --json` d'un EPIC à l'option donne la base de son parent (règle testée seulement sur la fonction pure).
- Écarté : renforcer les tests figés de la tranche 1, parce que le code est juste et que la tranche 3 teste déjà l'EPIC à l'option en ligne de commande (CA-8, CA-14).
- Conséquence : la tranche 3 ajoute un cas `status --json` sur `epic/EPIC-1-x` à l'option, qui attend `baseBranch: "main"` et `baseEpic: null`.

## 2026-11-25 : la branche distante de la branche d'intégration est lue sur `origin`
- Contexte : CA-6 compare la branche locale `epic/<ID>-<slug>` à « sa branche de suivi distante ».
- Écarté : lire la branche suivie configurée (`branch.<nom>.merge`), parce qu'une branche seulement distante n'a pas de configuration de suivi, et que la branche par défaut est déjà lue sur `origin` (`defaultBaseRef`).
- Conséquence : `refs/remotes/origin/epic/<ID>-<slug>` ; un dépôt dont le remote principal porte un autre nom n'a que la branche locale.

## 2026-11-25 : l'index des chantiers est passé d'une fonction à l'autre plutôt que mis en cache
- Contexte : `status` et `close-check` ont besoin de l'index pour les relations, la base et maintenant la revue (refs à exclure).
- Écarté : un cache par processus dans `chantierIndex`, parce qu'il cacherait un état partagé et qu'une commande écrit parfois la spec avant de relire l'index.
- Conséquence : `reviewFacts`, `reviewSummary` et `sliceCodeFiles` prennent un `index` optionnel ; sans lui, ils le construisent eux-mêmes.

## 2026-11-25 : OD3 (tranche 2) corrigé, OD2 reporté à la tranche 3
- OD3 : la base et les refs de la branche d'intégration étaient calculées deux fois par `sliceCodeFiles`, et l'index deux fois par `set-reviewed`. Corrigé : `integrationBranchOf` calcule une fois `{ branch, local, remote }`, dont on tire la ref de base (`baseRefOf`) et les refs à exclure (`integrationRefsOf`) ; `set-reviewed` construit l'index une fois.
- OD2 : les tests figés de CA-6 ne distinguent pas « toujours la locale » de « toujours la distante » quand les deux existent, parce que les deux refs sont exclues du calcul du code. Écarté : rouvrir les tests de la tranche 2 pour un cas que la fonction pure couvre simplement. Conséquence : la tranche 3 ajoute un test pur de `integrationRefChoice` (ni l'une ni l'autre, une seule, l'une contient l'autre dans chaque sens, divergence).

## 2026-11-25 : RD1 (revue 1 de la tranche 2) corrigé ; OD4 reporté à la tranche 3
- RD1 : `chantierTestFiles` exclut aussi les refs de la branche d'intégration ; freeze-tests, tests-changed, le hook Stop et set-reviewed en profitent. Test ajouté après réouverture (64aa051).
- OD4 : le test de RD1 ne vérifie que le gel, et pas qu'un test commun retouché par l'enfant lui-même reste compté. Écarté : rouvrir encore les tests de la tranche 2. Conséquence : la tranche 3 ajoute, dans le même scénario, `atelier tests-changed` après le gel (fichier du frère non cité), puis une retouche de l'enfant (fichier cité).
