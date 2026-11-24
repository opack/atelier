# Décisions : FIX-28 Le code fusionné depuis main compte comme code du chantier

## 2026-11-24 : une fusion de main sans résolution propre ne rend plus la revue obsolète
- Contexte : TEC-3 avait assumé qu'une fusion de la branche par défaut après la revue impose une nouvelle revue. En pratique, cela pousse à fusionner main le plus tard possible et fait refaire des revues pour du code déjà relu dans son propre chantier.
- Décision (validée par Didier) : seule compte la résolution d'une fusion, c'est-à-dire ce qui diffère de la fusion automatique sur un fichier de code. L'interaction avec le code de main est couverte par les contrôles relancés à la clôture.
- Écarté : `--first-parent` seul (le commit de fusion porte tout le diff de main) ; garder la règle de TEC-3.

## 2026-11-24 : les références de main sont exclues par les commits, pas par les noms (SB1)
- Contexte : exclure `^main` quand HEAD est déjà contenu dans main (branche courante = main, PR fusionnée puis travail repris) vide la liste, et `close-check` ne voit plus le code commité après la revue.
- Décision : une référence n'est exclue que si HEAD n'en est pas un ancêtre ; sans référence à exclure, repli sur le calcul actuel.
- Écarté : comparer le nom de la branche courante à celui de la branche par défaut (ne couvre ni HEAD détachée ni branche déjà fusionnée).

## 2026-11-24 : une seule tranche
- Contexte : le correctif tient en une soixantaine de lignes autour d'un seul calcul.
- Écarté : deux tranches (revue, puis tranche) : on relirait deux fois le même calcul.

## 2026-11-24 : exclusion décidée sur le plus ancien commit du chantier depuis le début, pas sur HEAD (OD2)
- Contexte : vérification de surapprentissage. Revue en R, commit de code, branche fusionnée dans main, puis un commit de plus sur la branche : HEAD n'est plus un ancêtre de main, `^main` était appliqué et cachait le code commité après la revue.
- Décision : une référence de la branche par défaut n'est exclue que si le plus ancien commit de la chaîne des premiers parents de HEAD après le début n'en est pas un ancêtre (l'ascendance est monotone le long de cette chaîne). Couvre la règle de SB1 (HEAD ancêtre de main) et ce cas.
- Écarté : tester si le début est un ancêtre de la référence (vrai par construction pour la première tranche, dont le début est la base de fusion avec main) ; `--first-parent` sans `^main` (cacherait les commits du chantier apportés par un `git pull` de la même branche poussée ailleurs).
- Conséquence : une fusion de main en avance rapide (branche sans commit propre depuis le début) met des commits de main sur la chaîne des premiers parents ; on revient alors au calcul actuel.

## 2026-11-24 : « Référence distante périmée » de limites.md reste tel quel (OD4)
- Contexte : la spec demandait de revoir ce paragraphe.
- Décision : il porte sur l'identification du chantier par ses commits (`branchCommitSubjects`), hors périmètre ; il reste juste.
