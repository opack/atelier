# Templates

Ces templates sont ceux du plugin : `/atelier:new` les remplit pour vous. Sans le plugin, copiez-les dans `docs/chantiers/<ID>-<slug>/`.

Les commentaires `<!-- -->` donnent les questions à se poser pour chaque section.

## Spec FEAT

````markdown
---
id: {{ID}}
type: FEAT
title: {{TITLE}}
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: {{DATE}}
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation :
- Performance :
- Accessibilité :
- Données personnelles :
- Compatibilité :

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
````

## Spec FIX

````markdown
---
id: {{ID}}
type: FIX
title: {{TITLE}}
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: {{DATE}}
source:
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé :
- Attendu :
- Impact :
- Source :

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
````

## Spec REF

````markdown
---
id: {{ID}}
type: REF
title: {{TITLE}}
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: {{DATE}}
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
````

## Spec TEC

````markdown
---
id: {{ID}}
type: TEC
title: {{TITLE}}
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: {{DATE}}
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
````

## Spec SPIKE

````markdown
---
id: {{ID}}
type: SPIKE
title: {{TITLE}}
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: {{DATE}}
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

<!-- Exploration bornée dans le temps. Le code produit est jetable et n'est jamais fusionné. Le livrable est une réponse. -->

## 1. Question à laquelle répondre
<!-- Une seule question, à laquelle on peut répondre par oui / non ou par un choix entre options. -->

## 2. Pourquoi
<!-- Quelle décision attend cette réponse ? -->

## 3. Budget
<!-- Temps maximum. Au-delà, on s'arrête et on note ce qu'on sait. -->

## 4. Ce qui compte comme réponse
<!-- Critères pour départager les options (perf mesurée, faisabilité, coût, complexité). -->

## 5. Pistes à explorer
<!-- Options envisagées. Optionnel. -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
````

## Plan

````markdown
# Plan : {{ID}} {{TITLE}}

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

## Tranches
<!-- Chaque tranche : livrable seule, relisible en moins de 15 minutes, un commit.
1. <tranche> — CA couverts : CA-1, CA-2 -->

## Risques et points d'attention
<!-- - risque : parade -->
````

## Journal de décisions

````markdown
# Décisions : {{ID}} {{TITLE}}

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->
````

## Bilan

````markdown
# Bilan : {{ID}} {{TITLE}}

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de la revue. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
<!-- 3 lignes : ce qui a été fait, pour qui, état final. -->

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|

<!-- Écarts par rapport à la spec, et pourquoi. -->

## 3. Choix techniques
<!-- Les décisions structurantes, une ligne chacune. -->

## 4. Éléments de code principaux
<!-- Points d'entrée, modules / composants / fonctions créés ou modifiés, avec leur rôle. Ce qu'un nouveau venu doit lire en premier. -->

## 5. Pistes écartées
<!-- Ce qui a été envisagé ou essayé puis abandonné, et pourquoi. -->

## 6. Dette et suites
<!-- Ce qui reste à faire, raccourcis assumés, chantiers à ouvrir. -->

## 7. Verdict de revue
<!-- Points bloquants traités, points à discuter et leur sort, exceptions acceptées. -->
- Verdict :
- Validé par :
- Date :
````

## ADR

````markdown
# {{NUMBER}}. {{TITLE}}

- Date : {{DATE}}
- Statut : acceptée
- Chantier d'origine : {{ID}}

## Contexte
<!-- Ce qui impose une décision. -->

## Décision
<!-- Ce qu'on fait. -->

## Alternatives rejetées
<!-- Option : raison. -->

## Conséquences
<!-- Ce que ça implique, y compris les inconvénients acceptés. -->
````
