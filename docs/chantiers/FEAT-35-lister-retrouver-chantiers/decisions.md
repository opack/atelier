# Décisions : FEAT-35 Lister et retrouver les chantiers

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-26 : la liste s'appuie sur `chantierIndex` enrichi, pas sur un second lecteur
- Contexte : la liste a besoin, pour chaque version d'un chantier, des fichiers du dossier, du plan, du corps de la spec, du type et de la date des refs ; l'index actuel ne garde que l'en-tête.
- Écarté : un lecteur séparé pour la liste, parce qu'il dupliquerait la lecture git et que le futur rangement par centaine aurait deux lecteurs à reprendre.
- Conséquence : la tranche 3 touche un lecteur partagé ; la vue des consommateurs actuels ne change pas.

## 2026-11-26 : l'index garde des faits extraits, pas les textes
- Contexte : question de Didier sur le coût de lire la spec et le plan en entier.
- Écarté : garder le contenu des fichiers, inutile une fois les faits extraits (en-tête, nombre de tranches, ancien modèle, liste des fichiers).
- Conséquence : les textes sont lus dans l'appel git existant puis jetés.

## 2026-11-26 : le nombre de tranches se lit dans `plan.md`, pas dans un champ de l'en-tête
- Contexte : question de Didier sur l'efficacité du comptage des tranches.
- Écarté : écrire le nombre de tranches dans l'en-tête de la spec, parce que cette valeur dupliquerait le plan et dériverait sans bruit ; le comptage (`planSliceCount`, code Node, aucun token) coûte quelques microsecondes dans l'appel git existant.
- Conséquence : `planSliceCount` reste la seule source.

## 2026-11-26 : TDD déclaré par tranche : oui pour les tranches 1 à 4, non pour la tranche 5
- Contexte : FIX-20 (fusionné après l'écriture du plan) exige que chaque tranche déclare son TDD ; `atelier check-plan` refusait le plan.
- Écarté : « TDD : oui » pour la tranche 5, parce qu'elle ne contient que skills, site et version : CA-20 se vérifie par `npm run build` du site, pas par un test unitaire.
- Conséquence : la tranche 5 se fait directement en `/atelier:build`.

## 2026-11-26 : tests de la tranche 1 (validés par Didier)
- Contexte : relecture des tests de CA-7 et CA-8.
- Décidé : les libellés utilisent l'apostrophe typographique (« tests d’abord »), comme le reste du code ; un `rel_parent` en minuscules désigne le même parent.
- Reporté : les clauses de CA-8 qui passent par la commande (« y compris avec `--type EPIC` », « y compris sans `--all` ») se testent en tranche 2, avec `atelier list` ; ces tests porteront l'étiquette CA-8.

## 2026-11-26 : tranche 1, les faits extraits passent aux règles existantes par un champ `facts`
- Contexte : l'étape doit réutiliser `sliceState` et `testDrivenPhase`, qui lisent les textes du plan et de la spec, que l'index ne garde pas.
- Écarté : recopier ces règles dans `list.mjs` (deux copies divergeraient) ; reconstruire un faux texte de plan ou de spec (fragile).
- Conséquence : `sliceState` lit `facts.sliceCount` et `facts.reopened`, `testDrivenPhase` lit `facts.refreezing`, s'ils sont présents ; sans `facts`, comportement inchangé. La règle « à planifier » est partagée avec `nextStep` (`needsPlan`, OD3), l'enfant d'un EPIC se lit par `parseRelations` (OD1).

## 2026-11-26 : tranche 1, libellés d'étape
- Le préfixe de tranche s'applique aux étapes tests, implémentation et revue enregistrée d'une tranche numérotée d'un chantier découpé, pas à la revue du chantier.
- Un EPIC en branche d'intégration n'a pas d'étape « revue d'ensemble » : la table de la spec ne la prévoit pas, `atelier status` la donne.
- Les libellés sont en dur dans `list.mjs`, comme les textes de `next-step.mjs` : ce ne sont pas des termes des documents.

## 2026-11-26 : OD4 reporté à la tranche 2
- Contexte : le vérificateur de surapprentissage relève trois cas non couverts par les tests figés de la tranche 1 : ancien modèle avec plan découpé et tests rouverts, tranche numérotée avec revue enregistrée, type en minuscules dans l'en-tête.
- Écarté : rouvrir les tests de la tranche 1, pour trois cas que le code traite déjà bien (vérifié à la main par le vérificateur).
- Conséquence : ces cas s'ajoutent aux tests de la tranche 2, étiquetés CA-7.

## 2026-11-26 : le type d'un chantier se lit dans son en-tête, pour la colonne comme pour l'étape
- Contexte : remarque de la revue 1 de la tranche 1 : l'étape se calcule sur le `type` de l'en-tête (comme `nextStep`) ; une colonne type déduite de l'identifiant afficherait « EPIC » avec une étape qui n'en est pas une.
- Écarté : deux sources (en-tête pour l'étape, identifiant pour la colonne), parce qu'elles peuvent se contredire.
- Conséquence : en tranche 2, la colonne type, le filtre `--type` et l'étape lisent le type de l'en-tête, et le préfixe de l'identifiant seulement s'il manque.

## 2026-11-27 : tests de la tranche 2 (validés par Didier)
- Le statut s'affiche par son code (`signed`, `done`…) dans la sortie texte.
- Le type affiché est en majuscules, lu dans l'en-tête, sinon dans le préfixe de l'identifiant ; colonne, `--type` et étape lisent cette même source.
- `--parent` ne tient pas compte de la casse.
- La liste vide ne mentionne `--all` que si le défaut « ouverts » a écarté des chantiers clos (aucun chantier du tout : pas de mention).
- Reporté en tranche 3 : la clause de CA-3 « rattaché à EPIC-17 sur une autre version seulement » (elle a besoin des branches), étiquetée CA-3.
- Les deux cas d'OD4 sur l'étape (ancien modèle à tranches, tranche numérotée revue) sont ajoutés à la fin de `list-step.test.mjs` ; ils passaient déjà.

## 2026-11-27 : tranche 2, implémentation et surapprentissage
- Les étapes se calculent sur toutes les versions connues, avant tout filtre ; le choix de version entre branches (tranche 3) se branchera dans `currentTreeVersions` (`lib/cli/list.mjs`), seule source de versions.
- Le type est calculé une fois (`chantierType`) et injecté dans l'en-tête passé à `versionFacts` : colonne, filtre, tri et étape lisent la même valeur. Un type d'en-tête inconnu se replie sur le préfixe de l'identifiant (OD7).
- Une option à valeur refuse une valeur absente, vide, qui commence par `--` ou qui ne donne rien une fois découpée (`--status ,`, OD6).
- Colonne parent : le texte affiche `parent EPIC-17` ; en JSON, `parent` vaut `rel_parent` en majuscules (« , » entre plusieurs valeurs), sinon `null`.
- OD5 (deux dossiers du même identifiant : lignes incohérentes) reporté à la tranche 3, qui refait le choix de version : une seule version par identifiant, doublon signalé.
- OD8 (combinaisons non couvertes : défaut « ouverts » avec `--type`, mention `--all` quand les filtres écartent aussi les clos, détail de la ligne de FEAT-30) : tests non rouverts, le code les traite ; à surveiller à la revue de la tranche 3.
