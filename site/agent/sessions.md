# Sessions et worktrees

## Une session = un chantier

Une conversation qui dure dérive : le contexte se remplit, les premières consignes s’estompent. Gardez des sessions courtes :

- **une session par chantier**, voire par tranche ;
- après une longue conception, **consignez** (spec, plan, journal) puis **repartez d’un contexte propre**.

Les documents du chantier portent la mémoire, pas la conversation. Au démarrage d’une session, atelier vous rappelle d’ailleurs le chantier actif et la prochaine étape.

## Les worktrees

Un worktree git est un second dossier de travail sur le même dépôt, avec sa propre branche.

**Utiles pour** :

- deux chantiers indépendants en parallèle (une fonctionnalité et un correctif urgent) ;
- comparer deux approches et garder la meilleure ;
- laisser un agent travailler en autonomie sur une branche isolée pendant que vous travaillez ailleurs.

**Inutiles pour** :

- un travail séquentiel ;
- des chantiers qui touchent les mêmes fichiers (conflits assurés).

**Pilotage** :

- 1 worktree = 1 branche = 1 chantier = 1 session ;
- **deux en parallèle au maximum** : votre capacité de relecture est le goulot, pas celle de l’agent ;
- supprimez le worktree à la fusion.

Coûts cachés : dépendances à installer dans chaque worktree, ports et émulateurs qui se télescopent.
