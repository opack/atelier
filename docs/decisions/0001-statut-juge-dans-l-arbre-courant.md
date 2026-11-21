# 0001. Le statut d'un chantier se juge dans l'arbre courant, ses liens dans toutes les branches

- Date : 2026-11-21
- Statut : acceptée
- Chantier d'origine : FEAT-4

## Contexte
Chaque chantier vit sur sa branche jusqu'à sa fusion : sa spec, donc son statut et ses relations (`rel_*`), peut différer d'une branche à l'autre. Tout ce qui raisonne sur plusieurs chantiers (clôture d'un EPIC, dépendances, `status`, et demain un index Notion ou une vue d'ensemble) doit dire quelle version fait foi. Lire seulement l'arbre courant ignore les chantiers pas encore fusionnés ; lire seulement les branches laisse croire livré ce qui ne l'est pas dans la branche où l'on est.

## Décision
- **Découverte et liens : toutes les branches.** Un chantier est connu s'il existe dans l'arbre courant, une branche locale ou une branche distante connue. Un lien (`rel_parent`, `rel_depends_on`…) compte dès qu'**une** de ses versions le déclare.
- **Statut : l'arbre courant seulement.** Un chantier ne compte comme clos que si son statut clos est présent dans la branche où l'on est, c'est-à-dire fusionné. Un chantier présent seulement sur une autre branche compte comme ouvert, quel que soit son statut là-bas.
- Pour la branche courante, le disque fait foi (modifications non commitées comprises), pas sa version commitée.

## Alternatives rejetées
- Tout juger dans l'arbre courant : un enfant rattaché ou une dépendance déclarée sur une branche non fusionnée est invisible, et un EPIC peut se clore à tort.
- Juger le statut sur la branche du chantier : on livrerait FEAT-14 sans le code de FEAT-12 dans la branche, ou on clôturerait un EPIC pendant qu'un enfant avance ailleurs.
- Ne retenir que la version la plus récente d'un chantier : « récente » n'a pas de sens stable entre branches divergentes, et la règle redeviendrait implicite.

## Conséquences
- Un refus de clôture peut venir d'une branche oubliée (enfant abandonné jamais fusionné, branche distante supprimée mais non élaguée) : le message nomme la branche et invite à la fusionner ou à la supprimer.
- La découverte coûte des appels git (trois au total dans FEAT-4, indépendants du nombre de branches) : tout index futur doit garder un coût qui ne croît pas avec le nombre de branches.
- Tout nouvel outil qui agrège des chantiers (synchronisation Notion, vue globale des relations) applique la même règle : liens par union des branches, statut par l'arbre courant.
