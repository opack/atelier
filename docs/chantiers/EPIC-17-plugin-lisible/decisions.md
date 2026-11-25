# Décisions : EPIC-17 Un plugin qui reste lisible en grandissant

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-22 : la correction du process se fait en deux lots, un FIX et un FEAT
- Contexte : le §2 de la spec parlait d'un seul « FIX du process » ; CA-5 (gel qui tolère un déplacement) demande une détection de lignes déplacées dans un diff, avec ses tests.
- Écarté : un seul FIX couvrant CA-3 à CA-6, parce qu'il mêlerait texte de skills et algorithmique dans une PR lourde à relire. Écarté aussi : CA-5 en FIX, parce que refuser un déplacement n'est pas un bug mais une règle trop stricte qu'on assouplit.
- Conséquence : lot 3 (FIX : CA-3, CA-4, CA-6) puis lot 4 (FEAT : CA-5), enchaînés car tous deux touchent `reviewer.md`.

## 2026-11-22 : le test d'architecture (CA-7) ferme le lot 2
- Contexte : le test vérifie la taille des fichiers de `lib/` et de `test/`.
- Écarté : le poser dès REF-16, parce qu'il échouerait aussitôt sur `lib/core.mjs` (1388 lignes). Écarté aussi : un lot à part, pour un test de quelques dizaines de lignes.
- Conséquence : le lot 2 couvre CA-2 et CA-7.

## 2026-11-22 : TEC-15 est fusionné avant le démarrage de REF-16
- Contexte : TEC-15, en phase d'implémentation, ajoute 60 lignes à `test/core.test.mjs`.
- Écarté : démarrer REF-16 en parallèle, parce que l'un des deux devrait rejouer le découpage à la main sur un fichier de 2000 lignes.
- Conséquence : REF-16 attend la fusion de TEC-15 et part de la branche par défaut à jour.
