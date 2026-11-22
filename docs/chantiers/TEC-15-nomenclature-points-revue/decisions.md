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

## 2026-11-22 : l'en-tête d'un tableau de points se décide par sa position (RD10)
- Contexte : revue 4 de la tranche 1 : `| B1. x | Point | c |` suivi d'un séparateur, en plein tableau, devenait un nouvel en-tête ; troisième défaut de la même famille (RD6, RD7), chaque fois corrigé par un filtre sur le contenu de la ligne.
- Retenu : comme en CommonMark, seule une ligne qui ouvre un tableau (la ligne précédente n'est pas une ligne `|`) et qu'un séparateur suit peut être l'en-tête ; elle doit en plus avoir une cellule `Point` et aucun point. Une ligne en plein tableau est toujours un point.
- Écarté : un filtre de plus sur le contenu, parce qu'il laisserait la famille ouverte.
- Reporté en tranche 2, avec CA-6 : le cas de RD10 rejoint ceux de RD6 et RD7 dans les tests attendus.

## 2026-11-22 : un en-tête de tableau de points n'a que des noms de colonnes (RD11)
- Contexte : revue 5 de la tranche 1 : la règle de position (RD10) ne fermait pas la famille, contrairement à ce que disait l'entrée précédente ; une ligne mal formée qui ouvre un tableau après une rupture (ligne vide, texte, commentaire) devenait encore l'en-tête.
- Retenu : un en-tête ouvre un tableau, est suivi d'un séparateur, et toutes ses cellules sont des noms de colonnes (`Point`, plus `Fichier` ou `Traitement`, dans n'importe quel ordre). La seule ligne qui puisse être prise pour l'en-tête est un vrai en-tête : aucun point ne peut plus se perdre ainsi.
- Écarté : les filtres « contient `Point` » et « ne contient pas de point », qui laissaient chaque fois un cas ouvert.
- Conséquence : un en-tête mal écrit (`File`, `**Point**`) est lu comme un point mal formé, signalé en tranche 2.
- Reporté en tranche 2, avec CA-6 : le cas de RD11 (après une ligne vide et après un commentaire) rejoint ceux de RD6, RD7 et RD10.

## 2026-11-22 : contrôle des points (tranche 2), suites de la vérification de surapprentissage
- Contexte : implémentation de `reviewPointProblems` et `isTreatment` ; `overfit-checker` a relevé OB2 et OD12 à OD18.
- Retenu : un identifiant présent deux fois dans une même section est signalé quel que soit son marqueur, `(repris)` compris (OB2 : la dernière occurrence masquait l'autre) ; « nouveau dans plusieurs sections » ne compte que les occurrences sans `(repris)`. Le report à une tranche est reconnu aussi sous des formes libres (`reporté en tranche 3`, `reporté (tranche 2, avec CA-6)`) : à la clôture, une forme non reconnue passerait pour un report vers un autre chantier (OD12). Le message d'un traitement refusé cite la cellule et la liste des mots-clés (OD16).
- Retenu : une ligne de point sous un titre proche (`### Bloquants`) n'est pas signalée en plus du titre : un seul problème, sur sa cause.
- Écarté : retirer les `*` ou les accents avant de reconnaître un traitement (OD16), parce que la spec n'ignore que la casse et que l'erreur va dans le sens prudent (point signalé, pas perdu) ; contrôler le « par qui, pourquoi » d'une `exception acceptée` (OD17), parce que la spec laisse le détail libre après le mot-clé.
- Signalé à l'utilisateur, hors spec : OD13 (`(repris)` ou `ex-` sans occurrence antérieure), OD14 (`requalifié (RB4)` sans `RB4 (ex-RD3)` ferme le point), OD15 (tableau de points avant le premier `## `).
- Signalé à l'utilisateur, sans renforcer les tests : OD18 (CA-3 et CA-14 ne vérifient pas la nature du message ; `## tour` en minuscules non testé) ; OB2 et OD12 ne sont pas couverts par les tests figés.
