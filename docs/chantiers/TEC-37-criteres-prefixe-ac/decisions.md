# Décisions : TEC-37 Préfixe AC pour les critères d'acceptation

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-26 : plus aucune lecture de `CA` ni de `V`, migration complète du dépôt
- Contexte : première version de la spec avec double lecture `CA`/`AC` ; relecture SB3, SD1, SD8 (mélanges de préfixes) et question de Didier sur la rétrocompatibilité.
- Écarté : la double lecture, parce qu'aucune commande ne relit les critères d'un chantier clos et que, livré avant EPIC-14, ce chantier garantit que `CA` n'existe hors de ce dépôt ; ce serait du code sans appelant.
- Conséquence : tests et documents des chantiers ouverts migrés ici ; un chantier ouvert ailleurs à la fusion migre en fusionnant `main`.

## 2026-11-26 : `check-plan` échoue sur le plan de TEC-37, c'est attendu
- Contexte : le plan cite des `AC-n` que le plugin installé (et le code de la branche avant la tranche 1) ne lit pas ; chaque tranche « TDD : oui » est signalée sans critère couvert (SD10).
- Écarté : rédiger ce chantier en `CA`, parce que ses tests doivent porter l'étiquette `[TEC-37 AC-n]` que la tranche 1 rend obligatoire.
- Conséquence : couverture du plan vérifiée à la main (AC-1 à AC-8, chacun couvert une fois) ; tranche 1 « TDD : oui », `slice_tdd` des tranches suivantes écrit à la revue.

## 2026-11-26 : tranche 3 « TDD : non », tests AC-6 et AC-7 écrits avec les textes
- Contexte : Didier veut le TDD sauf pour la tranche doc/site ; AC-6 et AC-7 sont pourtant vérifiés par des tests.
- Écarté : passer la tranche 3 en TDD, parce que ses tests ne font que constater des textes.
- Conséquence : les tests de `docs.test.mjs` sont ajoutés pendant la tranche, la revue protège seule ses lignes (pas de gel).

## 2026-11-26 : migration des tests par script rejouable
- Contexte : une trentaine de fichiers de test à renommer à l'étape tests de la tranche 1.
- Écarté : remplacement à la main, parce qu'invérifiable en moins de 15 minutes.
- Conséquence : `migrate-tests.mjs` dans le dossier du chantier, rejoué sur la base par la revue.
