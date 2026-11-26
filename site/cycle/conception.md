# 3. Conception

**Objectif** : choisir une approche et découper le travail en tranches livrables, **avant** d’écrire du code.

Obligatoire pour `FEAT` et `REF`, recommandée pour les gros `TEC`, inutile pour un `FIX` simple.

## Avec atelier

```text
/atelier:plan
```

Passez en **mode plan** pendant cette étape : l’agent analyse sans modifier de fichier.

L’agent lit la spec et le code concerné, puis propose :

- **l’approche** recommandée, et s’il existe un vrai choix, deux ou trois options avec leurs compromis ;
- **les fichiers et couches touchés** ;
- **les tranches**, chacune livrable seule, avec les critères qu’elle couvre et leur décision TDD (oui ou non, avec une recommandation : c’est vous qui tranchez) ;
- **les risques** et les zones critiques à relire ligne à ligne ;
- **ce qui manque dans la spec**, si la conception révèle un trou (on l’amende plutôt que de le combler en silence).

## Votre rôle : challenger

C’est l’étape où l’on évite le plus d’erreurs. Questions utiles :

- Qu’est-ce qui peut casser ?
- Existe-t-il une solution plus simple ?
- Qu’est-ce qui existe déjà dans le code et qu’on devrait réutiliser ?
- Cette tranche peut-elle vraiment être livrée seule ?

## La tranche

Une tranche est un morceau de chantier :

- **livrable seul** ;
- **relisible en moins de 15 minutes** (environ 300 lignes hors code généré) ;
- **testée, implémentée et revue à part** : le cycle tests → implémentation → revue se fait tranche par tranche.

Plus gros : on redécoupe. Les petites tranches gardent les revues lisibles et les retours en arrière simples.

Dans `plan.md`, chaque tranche est une entrée numérotée de premier niveau de la section « Tranches », avec ses critères : `2. Export CSV — CA couverts : CA-3, CA-4 — TDD : oui`. atelier y lit le nombre de tranches. Une tranche garde son numéro : on peut ajouter ou redécouper des tranches à venir, pas retirer une tranche déjà revue.

Chaque tranche déclare son TDD : `TDD : oui` ou `TDD : non`. Le `tdd` du chantier est la valeur proposée par défaut. Une tranche qui n’a rien à tester (doc, site, version) se déclare `TDD : non` ; `TDD : oui` exige au moins un critère. Avant de commiter le plan, `/atelier:plan` lance `atelier check-plan`, qui signale les problèmes du plan (TDD non déclaré, `TDD : oui` sans critère, critère non couvert…) (sortie 2 : on corrige le plan avec vous et on relance), puis recopie le TDD de la tranche 1 dans la spec (`slice_tdd`) : la spec est commitée avec le plan. Les EPIC n’ont pas ce contrôle.

Le plan d’un EPIC découpe en lots, pas en tranches. Ensuite, sa branche est fusionnée dans la branche par défaut avant l’ouverture des lots ; celle d’un [EPIC à branche d’intégration](../fondations/types#epic-a-branche-d-integration) est seulement poussée : elle est la branche d’intégration dont partent les lots, et ne rejoint la branche par défaut qu’à la clôture de l’EPIC.

## Sortie

- `plan.md` dans le dossier du chantier.
- Une entrée dans `decisions.md` pour chaque choix tranché (option écartée, raison).

::: tip Repartir d’un contexte propre
Une fois le plan écrit, commencez l’étape suivante dans une nouvelle session : **le plan porte la mémoire, pas la conversation.**
:::
