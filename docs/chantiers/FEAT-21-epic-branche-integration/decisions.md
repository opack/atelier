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
