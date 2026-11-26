# Plan : REF-34 Regrouper le vocabulaire des documents lu par le code

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

`lib/vocabulary.mjs` exporte `VOCABULARY`, objet figé (`Object.freeze` en profondeur), sans import. `criteria.<TYPE>` pointe vers une clé de `sections.<TYPE>` au lieu de répéter le titre ; les titres approchants des tableaux de revue (« bloquant », « a discuter ») se calculent par `normalize` depuis `review.tables`, sans clé propre. Les modules purs lisent le vocabulaire ; les expressions régulières qui contiennent un terme sont construites avec `new RegExp` et un `escapeRegExp` ajouté à `lib/common.mjs`, mêmes drapeaux qu'aujourd'hui. Seules les citations entre « » des messages deviennent des interpolations. Aucun fichier de test existant n'est modifié : les nouveaux tests vont dans des fichiers neufs, ce qui rend la preuve de CA-1 directe.

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

- `plugins/atelier/lib/vocabulary.mjs` (nouveau) : le vocabulaire français sous clés canoniques.
- `plugins/atelier/lib/common.mjs` : `escapeRegExp`.
- `plugins/atelier/lib/spec.mjs` : `REQUIRED_SECTIONS`, `CRITERIA_SECTIONS`, titre et création de la section Amendements.
- `plugins/atelier/lib/tdd.mjs` : libellés « tests rouverts » / « tests regelés » (écriture et relecture).
- `plugins/atelier/lib/slices.mjs` : titre « Tranches », relecture des entrées de gel (modèle `legacy`).
- `plugins/atelier/lib/write-guard.mjs` : citations de « Amendements » dans 4 messages.
- `plugins/atelier/lib/cli/next-step.mjs`, `plugins/atelier/lib/cli/slices.mjs` : libellés « TDD », « oui », « non » affichés (RD4, revue 2 de la tranche 1).
- `plugins/atelier/lib/review-points.mjs` : tableaux, colonnes, mots-clés, marqueurs, « Aucun », « Tour », `isPostponedToSlice`, `requalifiedTarget`, citations des messages.
- `plugins/atelier/test/vocabulary.test.mjs` (nouveau) : CA-3.
- `plugins/atelier/test/architecture-vocabulary.test.mjs` (nouveau) : CA-2, avec son lecteur de code (chaînes, gabarits, expressions régulières, commentaires) et ses exemples fabriqués.
- `docs/chantiers/REF-34-vocabulaire-documents/check-tests.mjs` (nouveau) : preuve de CA-1.

## Tranches
<!-- Une entrée numérotée de premier niveau par tranche, dans l'ordre : atelier y lit le nombre de tranches.
Chaque tranche : livrable seule, relisible en moins de 15 minutes ; tests, build et revue se font par tranche.
Une tranche garde son numéro ; on ne retire du plan que des tranches à venir.
1. <tranche> — CA couverts : CA-1, CA-2 -->

1. Module `vocabulary.mjs`, `escapeRegExp`, `test/vocabulary.test.mjs`, branchement de `spec.mjs`, `tdd.mjs`, `slices.mjs` et `write-guard.mjs` ; suite verte — CA couverts : CA-1, CA-3
2. Branchement de `review-points.mjs` (expressions régulières reconstruites, `isTreatment` inchangé dans son comportement, citations des messages) ; suite verte — CA couverts : CA-1, CA-3
3. Test d'architecture `architecture-vocabulary.test.mjs` avec ses exemples fabriqués, passage propre sur le vrai `lib/`, script `check-tests.mjs` exécuté contre la base — CA couverts : CA-1, CA-2

## Risques et points d'attention
<!-- - risque : parade -->

- Expressions régulières reconstruites (tranche 2, zone à relire ligne à ligne) : un caractère non échappé ou un drapeau perdu change le comportement sans bruit. Parade : `escapeRegExp` systématique, drapeaux recopiés, tests `review-points-*` existants qui couvrent chaque forme.
- Lecteur de code du test d'architecture : une division prise pour une expression régulière, ou l'inverse. Parade : exemples fabriqués pour chaque position, et le vrai `lib/` doit sortir propre sans exclusion ad hoc.
- Conflits avec le lot 3 d'EPIC-17 (sections de critères TEC et REF dans `CRITERIA_SECTIONS`) : l'implémentation démarre après les lots 3 et 4 ; fusionner la branche par défaut avant la tranche 1 et reprendre les valeurs qu'elle porte alors. La base de `check-tests.mjs` est le commit de cette fusion.
- `lib/vocabulary.mjs` ne doit rien importer, et `lib/common.mjs` ne l'importe pas (règle d'architecture existante) : `escapeRegExp` vit dans `common.mjs`, le vocabulaire reste une feuille.
