# Plan : EPIC-17 Un plugin qui reste lisible en grandissant

<!-- Découpage prévu de l'EPIC, écrit une fois puis laissé tel quel : les écarts vont dans decisions.md,
la confrontation prévu / réalisé dans bilan.md. -->

## Approche
<!-- 2 à 5 lignes : comment la vision se découpe et dans quel ordre on la réalise, et pourquoi. -->

Ranger d'abord, puis corriger le process sur le rangement obtenu. Les tests passent en premier : leur découpage fixe la liste des domaines que `lib/` reprend ensuite. Le test d'architecture ferme le lot 2, quand les deux rangements existent. La correction du process est scindée : les consignes et `check-spec` (texte et règles simples) d'un côté, le gel qui tolère un déplacement (détection de lignes déplacées dans un diff) de l'autre.

## Lots
<!-- Un lot = un chantier enfant à ouvrir (/atelier:new, avec rel_parent: EPIC-17), livrable seul. -->

| Ordre | Lot | Type envisagé | Dépendances pressenties | CA globaux couverts |
|---|---|---|---|---|
| 1 | Tests rangés par domaine (REF-16, déjà ouvert) | REF | TEC-15 fusionné | CA-1 |
| 2 | `lib/` rangé par domaine, logique pure et entrées / sorties séparées ; test d'architecture | REF | lot 1 | CA-2, CA-7 |
| 3 | Règles de rangement, d'étiquetage et de numérotation : consignes de `write-tests` et `build`, grille du reviewer, `CA-x` exigé par `check-spec` pour TEC et REF, templates | FIX | lot 2 | CA-3, CA-4, CA-6 |
| 4 | Le gel accepte un test seulement déplacé, le reviewer ne le signale pas | FEAT | lot 3 | CA-5 |

## Risques et points d'attention
<!-- - risque : parade -->

- TEC-15, en cours, ajoute 60 lignes à `test/core.test.mjs` : le fusionner avant de démarrer REF-16, sinon l'un des deux rejoue le découpage à la main.
- Le lot 2 redistribue plus de 2300 lignes et fait rebaser tout chantier ouvert qui touche `lib/` : le découper en tranches par domaine, et n'ouvrir aucun autre chantier sur `lib/` pendant qu'il tourne.
- Les REF n'ont pas de filet TDD : la comparaison par script (nombre de tests, noms et corps) accompagne chaque revue.
- REF-16 et le lot 2 précèdent le lot 3 qui impose les `CA-x` aux REF : leurs specs numérotent déjà leurs critères `CA-x`, pour ne pas livrer l'EPIC avec deux specs hors de sa propre règle.
- Le test d'architecture posé avant le découpage de `lib/` échouerait aussitôt sur `core.mjs` : il vient en fin de lot 2, pas avant.
