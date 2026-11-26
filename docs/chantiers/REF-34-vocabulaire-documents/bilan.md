# Bilan : REF-34 Regrouper le vocabulaire des documents lu par le code

## 1. Résumé
Les termes français que le code lit ou écrit dans les documents d'un chantier (titres de section, colonnes et mots-clés de revue, segments du plan, entrées d'amendement) viennent désormais d'un seul module pur, `lib/vocabulary.mjs`, sous des clés anglaises. Le comportement est inchangé : mêmes 495 tests à l'identique, plus 18 tests ajoutés, 513 verts. Un test d'architecture empêche un terme de revenir en dur. C'est le socle des documents multilingues d'EPIC-14.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : tests identiques avant / après, tous verts | Livré | `docs/chantiers/REF-34-vocabulaire-documents/check-tests.mjs` (base 84bff20 : 29 fichiers de test identiques, 495 + 18 = 513 tests, tous verts ; `--self-test` prouve la détection) |
| CA-2 : test d'architecture sur les positions de grammaire | Livré, avec une limite acceptée (RD18) | `test/architecture-vocabulary.test.mjs` (10 tests `[REF-34 CA-2]` : lecteur de code, liste calculée depuis `VOCABULARY`, chaîne, gabarit, regex, citation « », titre, prose non signalée, import interdit, passage propre sur le vrai `lib/`) |
| CA-3 : clés et valeurs du vocabulaire, exports inchangés | Livré | `test/vocabulary.test.mjs` (7 tests `[REF-34 CA-3]` : sections, autres clés, ordre des traitements, gel profond, `REQUIRED_SECTIONS`, `isTreatment`, `parseReviewPoints`) |

Écarts par rapport à la spec signée, tous passés par amendement :
- `review.postponedSlice` ajoutée (2026-11-25), parce que la regex de « reporté (tranche N) » contient ce mot.
- `plan.coverage`, `plan.tdd`, `plan.yes`, `plan.no` et `amendmentEntries.leftFreeze` ajoutées (2026-11-26, RD2), sans quoi un plan dans une autre langue perdait en silence les CA et le TDD de chaque tranche.
- CA-2 vise aussi un titre `## terme` écrit en dur (2026-11-26, RD13), qui ne protégeait pas la création de la section « Amendements ».

## 3. Choix techniques
- `VOCABULARY` est gelé en profondeur, sans import. Ses clés sont anglaises en camelCase. `criteria.<TYPE>` désigne une clé de section au lieu de répéter le titre.
- Les exports existants sont dérivés du vocabulaire, pas recopiés : par exemple, `REQUIRED_SECTIONS` découle de `sections.<TYPE>`.
- Les expressions régulières sont reconstruites une seule fois au chargement du module, avec `escapeRegExp` (ajouté à `lib/common.mjs`) et les mêmes drapeaux qu'avant.
- Seules les citations entre « » deviennent des interpolations. Un mot employé dans une phrase reste dans la phrase, qui se traduira entière dans le catalogue de messages d'EPIC-14.
- Une seule typographie pour toutes les langues (« Libellé : », date AAAA-MM-JJ), sans clé de vocabulaire. C'était le choix de Didier : pas d'usine à gaz.
- Les nouveaux tests sont dans deux fichiers neufs et aucun fichier de test existant n'a été touché, ce qui garde la preuve de CA-1 directe.
- Le lecteur de code de CA-2 reste local au fichier de test. Les mots courants (« Description », « Point »…) ne sont exclus que comme chaîne entière.

## 4. Éléments de code principaux
- `plugins/atelier/lib/vocabulary.mjs` : à lire en premier, c'est tout le vocabulaire.
- `plugins/atelier/lib/review-points.mjs` : la plus grosse reprise. Tableaux, colonnes, mots-clés, marqueurs (« repris », « ex- »), « Aucun », « Tour », « reporté (tranche N) » et « requalifié (RBn) » y sont reconstruits depuis le vocabulaire.
- `plugins/atelier/lib/spec.mjs`, `slices.mjs`, `tdd.mjs`, `write-guard.mjs` : sections exigées, section « Amendements », tranches du plan, entrées de gel, citations des messages.
- `plugins/atelier/lib/cli/next-step.mjs` et `lib/cli/slices.mjs` : affichage de « TDD : oui|non ».
- `plugins/atelier/test/architecture-vocabulary.test.mjs` : le garde-fou. Son message d'échec indique quoi faire.
- `CLAUDE.md` : le module est cité dans Structure, et la convention « jamais en dur » est ajoutée dans Conventions.

## 5. Pistes écartées
- Une clé `colon` pour l'espace avant les deux-points : écartée, parce qu'il faudrait concaténer des clés pour un gain nul.
- Interpoler les mots d'une phrase : écarté, parce que c'est traduire mot à mot.
- La preuve de traduisibilité (pseudo-langue) dans ce chantier : écartée, parce qu'elle exige un vocabulaire injectable, c'est-à-dire concevoir EPIC-14 en avance.
- Le test de CA-2 dans `architecture.test.mjs` : écarté, pour ne pas modifier un fichier de test existant (preuve de CA-1).
- Exporter `POINT_TABLES`, `POINT_COLUMNS` et `TREATMENTS` pour CA-3 : écarté, parce que des tests de comportement prouvent la même chose sans élargir l'interface.
- `(?![\p{L}\p{N}_])` à la place de `\b` : écarté, parce que cela change des cas limites, ce qu'un REF n'a pas le droit de faire.

## 6. Dette et suites
- Limites connues du test de CA-2, toutes à reprendre avec la pseudo-langue d'EPIC-14 :
  - un terme dans l'argument chaîne de `new RegExp` n'est signalé que s'il est la chaîne entière, un titre ou une citation (RD18, exception acceptée) ;
  - les citations composées (« TDD : oui ») ne sont pas couvertes ;
  - un `/` après `}` ou `)` est lu comme une division.
- `\b` après un terme qui finit par une lettre accentuée (« sí ») ne trouve pas de frontière. À traiter dans le premier chantier multilingue d'EPIC-14.
- Les identifiants `CA-n`, `RB`, `RD` restent neutres, hors vocabulaire. TEC-37 (CA→AC) s'en occupe.
- Le lot 3 d'EPIC-17 ajoutera les sections de critères TEC et REF au vocabulaire. Le test de CA-2 l'y obligera.
- Le test d'`escapeRegExp` peut être déplacé de `vocabulary.test.mjs` vers `common.test.mjs` (RD3), maintenant que la preuve de CA-1 est faite.
- Le futur FEAT des suites des bilans doit passer par `VOCABULARY` pour les titres qu'il lit.

## 7. Verdict de revue
Revues : tranche 1 (3 revues), tranche 2 (2), tranche 3 (2), chantier (1). Le seul bloquant (RB1) a été corrigé. Le comportement est identique sur 263 comparaisons entre l'ancien et le nouveau module dans la revue du chantier. Avant le chantier, la règle de CA-2 signalait 68 termes en dur.

| Point | Traitement |
|---|---|
| RB1. Terme précédé d'un échappement dans une regex non signalé | corrigé (d45af60) |
| RD1. Commit de fusion 5ef9b80 sans `[REF-34]` | exception acceptée (Didier, 2026-11-26 : réécrire l'historique poussé coûte plus que le bruit au contrôle) |
| RD2. « CA couverts », « TDD : oui/non », « gel quitté » en dur | corrigé (1fb64f9), spec amendée (bd093a2) |
| RD3. Test d'`escapeRegExp` dans `vocabulary.test.mjs` | corrigé (fd19c72 : limite documentée ; déplacement en suite) |
| RD4. « oui » / « non » en dur dans la CLI | corrigé (b1a2ab2) |
| RD5. Citations « TDD : oui / non » en dur dans les messages | corrigé (b1a2ab2) |
| RD6. Comparaison du « oui » et `\b` supposant l'ASCII | corrigé (b1a2ab2 ; limite du `\b` en suite) |
| RD7. Import hors de l'ordre alphabétique | corrigé (a6787dc) |
| RD8. « Point » et « Traitement » en dur dans deux messages | corrigé (e8bded8) |
| RD9. Tableaux désignés par leur position | corrigé (e8bded8) |
| RD10. Regex dans un deuxième `${…}` lue comme une division | corrigé (d45af60) |
| RD11. `export * as ns from` hors du contrôle d'import | corrigé (d45af60) |
| RD12. Fichier de test qui exporte et recopie `escapeRegExp` | corrigé (d45af60) |
| RD13. Titre « ## terme » non couvert par CA-2 | corrigé (d45af60), spec amendée (59549ed) |
| RD14. Chiffres de preuve périmés dans decisions.md | corrigé |
| RD15. Antislash échappé devant un terme non signalé | corrigé (0e1d38a) |
| RD16. `.` sans effet dans le lookbehind d'import | corrigé (0e1d38a) |
| RD17. `CLAUDE.md` muet sur `lib/vocabulary.mjs` | corrigé (45e18d7) |
| RD18. Terme dans l'argument chaîne de `new RegExp` non signalé | exception acceptée (Didier, 2026-11-26 : limite consignée pour la pseudo-langue d'EPIC-14) |
| RD19. `export` inutile dans le script de preuve | corrigé (45e18d7) |

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-26
