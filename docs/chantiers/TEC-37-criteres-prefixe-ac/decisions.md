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

## 2026-11-28 : ligne de format des templates de spec migrée dès la tranche 1
- Contexte : `spec-ellipsis.test.mjs` cherche `AC-1 :` dans les templates `spec-feat.md`, `spec-fix.md` et `spec-epic.md`.
- Écarté : attendre la tranche 3, parce que la suite resterait rouge pendant deux tranches.
- Conséquence : seule la ligne « AC-1 : Étant donné… » de ces trois templates change ici ; le reste des textes (dont « CA globaux » de `spec-epic.md`, `plan.md`, `plan-epic.md`) reste pour la tranche 3.

## 2026-11-28 : OB1, pas d'exception pour l'exemple à ellipse dans la règle d'étiquette
- Contexte : un nom de test figé citait « AC-1, AC-2… » hors de l'étiquette finale ; l'implémentation l'avait toléré par un lookahead dans `CRITERION_ID` (relevé par le contrôle de surapprentissage).
- Écarté : garder l'exception, parce qu'elle laissait passer tout `AC-n` suivi d'une ellipse, contre AC-4.
- Conséquence : tests rouverts (458391e) et regelés (672edd4) : test renommé, cas refusés `AC-1, AC-2… : …` et étiquette en minuscules (OD2) ajoutés ; `CRITERION_ID` insensible à la casse, `FINAL_TAG` en majuscules.

## 2026-11-28 : OD1, `criteria.mjs` importe `CHANTIER_TYPES` de `common.mjs`
- Contexte : le plan disait « sans import de `lib/` » ; `FINAL_TAG` doit refuser un type de chantier inconnu.
- Écarté : recopier la liste des types, parce qu'elle divergerait.
- Conséquence : seul `common.mjs`, socle autorisé par la règle d'architecture, est importé.

## 2026-11-28 : OD4 reporté, `checkSpec` accepte un `AC-n` cité n'importe où dans la section
- Contexte : une section de critères qui ne cite qu'un « voir AC-2 de FEAT-3 » n'est pas signalée, alors que `specCriteria` n'en tire aucun critère.
- Écarté : aligner sur `CRITERION_ITEM` ici, parce que c'est un changement de comportement antérieur au chantier, hors d'AC-2.
- Conséquence : suite à noter au bilan.

## 2026-11-28 : les mentions historiques de la spec d'EPIC-17 sont reformulées, AC-5 n'est pas amendé
- Contexte : la spec d'EPIC-17 décrit l'état d'avant REF-16 (« TEC-5 et TEC-6 chacun un `V-2` », « 17 tests `V-x` », « aucun `V-x` ne subsiste ») ; le remplacement `CA-n` → `AC-n` n'en a pas de traduction, et AC-5 refuse toute forme `V-n`.
- Écarté : amender AC-5 pour exclure ces lignes, parce qu'une exception au test durerait plus longtemps que l'histoire qu'elle protège ; écarté aussi `V-2` → `AC-2`, parce que ce serait faux historiquement.
- Conséquence : ces lignes parlent de « vérification numéro 2 », « tests de vérification », sans l'ancienne forme ; le sens ne change pas, l'entrée d'amendement d'EPIC-17 le dit.

## 2026-11-28 : OD5 à OD8 corrigés, OD9 signalé
- Contexte : contrôle de surapprentissage de la tranche 2.
- Conséquence : AC-1 d'EPIC-17 dit « aucun identifiant de vérification ne subsiste » (OD5) ; son §4 dit que les tests de vérification deviennent des tests étiquetés par critère (OD6) ; le lot 3 de son plan renvoie à TEC-37 pour les templates (OD7) ; l'entrée précédente perd son étiquette « D1 », hors nomenclature (OD8).
- OD9 : le test d'AC-5 ne voit ni `CA-x` ni « CA globaux », et ne vérifie pas la conservation des numéros ; la migration les traite quand même. Signalé à Didier, accepté tel quel le 2026-11-28 : test figé non renforcé.
