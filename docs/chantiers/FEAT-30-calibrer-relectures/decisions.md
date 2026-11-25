# Décisions : FEAT-30 Calibrer la rigueur des relectures

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-24 : chantier à part plutôt que lot 3 d'EPIC-17
- Contexte : le coordinateur proposait de l'ajouter au lot 3 d'EPIC-17.
- Écarté : lot 3, parce que le hors-périmètre d'EPIC-17 exclut le contenu des agents et skills hors rangement ; l'y glisser le dénaturerait.
- Conséquence : FEAT-30 autonome, sans `rel_parent`.

## 2026-11-24 : pistes écartées pendant le cadrage
- Contexte : première proposition de calibrage.
- Écarté : nouveau vocabulaire de traitement, retrait des cas limites génériques des grilles et du template, réglage par projet des domaines de relecture, quota de points par passage, grille d'étiquettes probabilité × gravité, parce que Didier juge que le vocabulaire n'est pas en cause, que les grilles sont légitimes, et qu'un réglage par projet alourdirait sans valeur.
- Conséquence : le chantier outille la décision (coûts, verdict, proportion, relance) sans réduire la recherche.

## 2026-11-24 : bilan pour tous les points, bloquants compris
- Contexte : SD3 de la relecture de spec ; première version réservant le bilan aux points à discuter.
- Écarté : bilan réservé aux points à discuter, parce que les bloquants imposent les corrections les plus lourdes et qu'un bloquant gonflé est le cas le plus coûteux.
- Conséquence : le bilan d'un bloquant justifie sa gravité ; son option la moins chère doit supprimer le problème bloquant.

## 2026-11-24 : deux tranches
- Contexte : découpage du plan.
- Écarté : une tranche par fichier, parce que six cycles de revue pour environ 200 lignes de texte contredirait le sujet du chantier.
- Conséquence : tranche 1 consignes du plugin, tranche 2 documentation.
