# Décisions : TEC-15 Identifiants stables des points de relecture

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-21 : un SPIKE et un EPIC échappent au contrôle des points de revue
- Contexte : la spec ne dit pas si le contrôle s'applique aux chantiers exemptés de revue (`isReviewExempt`).
- Écarté : contrôler un `revue.md` facultatif, parce que la clôture de ces chantiers ignore déjà tout ce qui touche à la revue.
- Conséquence : `closeProblems` n'appelle `reviewPointProblems` que hors exemption.

## 2026-11-21 : `reporté (tranche N)` accepté par `set-reviewed`, même en revue du chantier
- Contexte : en revue du chantier, il n'y a plus de tranche suivante pour reprendre le point.
- Écarté : refuser dès `set-reviewed`, parce que CA-16 l'accepte ; `close-check` le refuse de toute façon.
- Conséquence : le point est bloqué à la clôture, pas à l'enregistrement de la revue.

## 2026-11-21 : `chantier.revue` lu par `readChantier`
- Contexte : `setReviewedRefusal` et `closeProblems` ont besoin du contenu de `revue.md`.
- Écarté : passer le texte en paramètre de chaque fonction, parce que FEAT-7 a fait le même choix pour `chantier.plan` et que les signatures restent stables.
- Conséquence : `set-reviewed` lit la copie de travail de `revue.md` ; `close-check` aussi, et refuse en plus un `revue.md` non commité.

## 2026-11-21 : suites de la vérification de surapprentissage de la tranche 1
- Contexte : `overfit-checker` a relevé OD1 à OD6 sur `parseReviewPoints`.
- Retenu : titres en NFC et indentés jusqu'à 3 espaces (OD1), en-tête remis à zéro hors ligne de tableau (OD2), blocs de code ignorés (OD3), ligne `Aucun` sautée seulement si elle est seule (OD4).
- Reporté en tranche 2 : signaler une ligne `RB`/`RD` hors tableau de points, ou un titre `###` proche de « Bloquant » / « À discuter » (OD1) ; `legacy` dès une section `## Tour` ou seulement si toutes le sont (OD3, avec CA-7).
- Écarté : tableau sans `|` en tête de ligne (OD1), parce que le template et le reviewer écrivent toujours la forme avec `|` ; `\|` lu comme séparateur (OD5), cas marginal.
- Signalé à l'utilisateur, sans renforcer les tests : OD6 (`Aucun`, `legacy`, `line`, `point`, ordre des colonnes non testés).
