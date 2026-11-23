# Décisions : FIX-22 Faux positifs de checkSpec sur « … »

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-23 : les « … » se cherchent sur le texte brut de la section, pas sur `meaningfulContent`
- Contexte : `meaningfulContent` retire les puces et numéros même sans espace derrière : `-… suite`, `1.… suite` et `*…*` (italique) devenaient des « … » en début de ligne, donc signalés, contre la règle de la §4 (relevé par la vérification de surapprentissage).
- Écarté : exiger une espace après la puce dans `meaningfulContent`, parce que ça change aussi les contrôles « vide » et « critère numéroté », que la spec veut inchangés.
- Conséquence : la recherche part des lignes de la section, commentaires HTML remplacés par un caractère neutre (comme le code en ligne), ce qui garde collé un « … » qui suit un commentaire. `hideCode` reconnaît une ouverture de bloc précédée d'une puce, d'une case à cocher ou d'un `>` de citation, puisque ces préfixes ne sont plus retirés en amont.
