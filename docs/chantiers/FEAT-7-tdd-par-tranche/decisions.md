# Décisions : FEAT-7 Cycle tests, build, revue par tranche

## 2026-11-21 : le plan est lu par `readChantier` (`chantier.plan`)
- Contexte : `nextStep`, `closeProblems` et les refus ont besoin du nombre de tranches.
- Écarté : passer le texte du plan en paramètre à chaque fonction, parce que cela modifie toutes les signatures et tous les appelants sans bénéfice.
- Conséquence : une seule fonction, `sliceState`, interprète `slice`, `last_slice` et le plan.

## 2026-11-21 : ce chantier suit l'ancien modèle
- Contexte : il est piloté par atelier 0.2.0 installé, qui écrit les tests de tous les CA d'un coup et fait une revue unique.
- Écarté : se piloter avec la version en cours d'écriture, parce qu'elle est incomplète jusqu'à la dernière tranche.
- Conséquence : tests des 27 CA écrits et figés d'un coup ; build tranche par tranche ; une revue sur tout le chantier.

## 2026-11-21 : `slice_base` invalidé par un rebase : correction manuelle par l'utilisateur
- Contexte : la spec impose un refus sans recalcul ; le champ est protégé contre l'agent.
- Écarté : un amendement de la spec, parce que c'est le contenu d'un message d'erreur, pas un comportement nouveau.
- Conséquence : le message de refus indique que l'utilisateur doit corriger `slice_base` lui-même.

## 2026-11-21 : décisions tranchées pendant la rédaction de la spec
- Pas de commande « tranche suivante » : passage à la validation de la revue de tranche (`set-reviewed`).
- Tests d'une tranche précédente modifiés : refus au gel sans option pour passer outre ; on passe par `/atelier:amend` et / ou `/atelier:write-tests <raison>`.
- Revue du chantier séparée, à mandat transversal, plutôt qu'un passage de cohérence dans la dernière revue de tranche.
- « Tour » de revue remplacé par « revue ».
- Tranche identifiée par son numéro ; tranche en cours retirée du plan : sa revue mène à la revue du chantier.
- `slice` écrit dès le premier gel ou la première revue, quel que soit le plan : marqueur du nouveau modèle.
- `SPIKE` : le TDD décide du cadre, pas le type.
- Contrôle des tests antérieurs par lignes (`git diff`), pas par tests ; le reviewer complète.
- `slice_base` non ancêtre de `HEAD` : refus, pas de recalcul.
