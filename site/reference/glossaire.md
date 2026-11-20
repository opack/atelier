# Glossaire

| Terme | Définition |
|---|---|
| **ADR** (Architecture Decision Record) | Fiche courte qui consigne une décision d’architecture dépassant un chantier : contexte, décision, alternatives rejetées, conséquences. Rangée dans `docs/decisions/`. |
| **Amendement** | Modification d’une spec après signature (`/atelier:amend`) : entrée datée dans la section « Amendements », éditions ciblées, nouvel accord humain. |
| **Bilan** | `bilan.md` : synthèse écrite à la clôture (livré vs spécifié, choix, code principal, pistes écartées, dette, verdict). Sert d’historique. |
| **Commit revu** | Commit sur lequel porte la revue (`reviewed_commit`). La clôture vérifie qu’aucun code n’a changé depuis. |
| **CA (critère d’acceptation)** | Condition vérifiable qui dit quand le chantier est réussi, au format « Étant donné…, quand…, alors… ». Numéroté (`CA-1`) et couvert par au moins un test qui le cite. |
| **Chantier** | Unité de travail identifiée (`FEAT-412`), de la spec au bilan. Un chantier = un dossier, une branche, une PR. |
| **Débrayage** | Levée tracée du blocage avant signature, réservée à l’urgence de production. |
| **Gel des tests** | En TDD, moment où les tests commités deviennent non modifiables par l’agent (`tests_commit`). |
| **Journal de décisions** | `decisions.md` : une entrée datée par décision prise pendant le chantier. |
| **Regel** | Nouveau gel des tests après une réouverture, tracé dans la spec. |
| **Porte** | Contrôle à passer pour changer d’étape : automatique (types, lint, tests, complétude) ou humaine (signature, verdict). |
| **Revue** | Relecture du chantier par un sous-agent indépendant, en tours successifs jusqu’à zéro point bloquant ; consignée dans `revue.md`. Obsolète dès que du code est commité ou la spec amendée après le commit revu. |
| **Signature** | Validation humaine qu’une spec suffit pour lancer le chantier. |
| **Socle commun** | Règles partagées par tous les projets, dont chaque projet hérite. |
| **Spec** | Document qui décrit l’intention du chantier : quoi, pourquoi, comment on saura que c’est réussi. |
| **Spike** | Exploration bornée dans le temps ; code jetable, livrable = une réponse. |
| **Surapprentissage** | Implémentation qui fait passer les tests sans résoudre le problème (valeurs codées en dur, cas particuliers). |
| **TDD** | Développement piloté par les tests : tests écrits, échoués et commités avant l’implémentation. Décidé chantier par chantier. |
| **Test de caractérisation** | Test qui fige le comportement actuel d’un code avant de le restructurer. |
| **Test de non-régression** | Test qui reproduit un bug : rouge avant la correction, vert après. |
| **Tranche** | Morceau de chantier livrable seul, relisible en moins de 15 minutes. Un commit par tranche. |
| **Verdict** | Décision humaine finale à la clôture : accepté, accepté avec exceptions, refusé. |
| **Voie rapide** | Enchaînement court pour les corrections de bugs. |
