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

## 2026-11-22 : correction de RD1 à RD3, puis suites de la vérification de surapprentissage
- Contexte : revue 1 de la tranche 1 (RD1 à RD3) ; `overfit-checker` a relevé OB1 et OD7 à OD11 sur la correction.
- Retenu : en-tête reconnu par la ligne de séparation qui le suit, sauf s'il contient un point (RD1, OD7) ; tableau sans en-tête lu avec les colonnes du template, `cellCountMismatch` comparé à leur nombre (RD2, OD8) ; commentaire HTML masqué seulement s'il ouvre une ligne, jusqu'à la ligne qui contient `-->`, comme en CommonMark (RD3, OB1 : un `` `<!--` `` dans une cellule masquait tout le reste du fichier) ; bloc de code fermé seulement par le même caractère, au moins aussi long (OD9).
- Écarté : retirer les commentaires `<!-- … -->` au milieu d'une ligne, parce que c'est ce qui a produit OB1 et qu'aucun template n'en écrit dans un tableau ; remettre l'en-tête à zéro après un texte libre (OD11), parce qu'une ligne lue en trop est signalée alors qu'une ligne sautée serait perdue (documenté dans le commentaire de `parseReviewPoints`).
- Signalé à l'utilisateur, sans renforcer les tests : OD10 (`<!--` dans une cellule, `file` et `treatment` d'un tableau sans en-tête, colonnes réordonnées, séparateur aligné `:---:` non testés).

## 2026-11-22 : règle d'en-tête des tableaux de points, tests attendus en tranche 2
- Contexte : revues 2 et 3 de la tranche 1 (RD6, RD7, RD8) : une ligne prise à tort pour l'en-tête disparaît sans signalement ; les tests figés ne couvrent pas ces cas.
- Retenu : une ligne est l'en-tête si elle a une cellule `Point`, aucune cellule au format d'un point, et qu'une ligne de séparation la suit ; toute autre ligne `|` est un point, bien formé ou non.
- Écarté : la règle « aucune cellule au format d'un point » seule (RD6 : un `B1.` devenait l'en-tête), puis « une cellule `Point` » seule (RD7 : `| RB1. x | Point | c |` devenait l'en-tête).
- Reporté en tranche 2, à l'écriture des tests de CA-6 : `| B1. … |` suivi de `|---|---|---|` signalé (RD6) ; `| RB1. x | Point | c |` suivi d'un séparateur lu comme point (RD7) ; un en-tête mal écrit (`point`, `**Point**`) est signalé comme point mal formé, le message doit évoquer un en-tête non reconnu.
