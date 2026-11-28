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

## 2026-11-24 : un REF supprime la façade `lib/core.mjs` après les rebases de FIX-20 et FEAT-27
- Contexte : REF-29 (lot 2) a gardé `core.mjs` en façade de réexports pour les branches ouvertes avant lui ; sa revue du chantier (RD18) a montré que le test d'architecture interdit désormais à tout test ou module de l'importer : la façade n'a plus d'usager.
- Écarté : la supprimer dans REF-29, parce que sa spec signée la gardait (CA-2, CA-6). Écarté aussi : laisser les tests l'importer, parce qu'elle survivrait indéfiniment.
- Conséquence : petit REF hors lots numérotés, ouvert dès que FIX-20 et FEAT-27 ont rebasé sur `main` ; il retire aussi les renvois à `lib/core.mjs` dans les commentaires (RD8 de REF-29) et la règle de la façade de `CLAUDE.md`.

## 2026-11-25 : lot 5, un REF regroupe dans un module de vocabulaire les mots que le code lit en dur
- Contexte : fil « Rendre atelier multilingue » (EPIC-14). Le code lit en dur des titres de section (« Critères d'acceptation », « Amendements », « Tranches » dans `spec.mjs` et `slices.mjs`), les colonnes et mots-clés de `revue.md` (Point, Fichier, Traitement, corrigé, écarté… dans `review-points.mjs`) et des citations dans `write-guard.mjs`. Accord de Didier le 2026-11-25.
- Décision : un REF enfant d'EPIC-17 les regroupe dans un seul module de vocabulaire. Il ne traduit rien et ne change aucun comportement ; il prépare le multilingue, qui reste un chantier d'EPIC-14.
- Ordre : après les lots 3 et 4, sauf avis contraire de Didier. Comme le lot 2, il touche plusieurs modules de `lib/` : aucun autre chantier sur ces modules pendant qu'il tourne, et preuve de non-régression par la suite inchangée.
- Conséquence : le plan garde ses quatre lots (il n'est pas réécrit) ; la confrontation prévu / réalisé du bilan d'EPIC-17 compte ce lot 5 et le REF de suppression de la façade.

## 2026-11-26 : le lot 5 (REF-34, vocabulaire des documents) passe avant les lots 3 et 4
- Contexte : REF-34 ouvert le 2026-11-25 ; proposition du fil « Rendre atelier multilingue » de le lancer tout de suite. Accord de Didier le 2026-11-26.
- Écarté : attendre les lots 3 et 4, parce que le lot 3 ajouterait d'abord de nouveaux mots lus en dur (sections de critères des TEC et REF) que REF-34 devrait ensuite déplacer.
- Conséquence : ordre REF-34, puis lot 3 (qui ajoute ses sections de critères directement au module de vocabulaire), puis lot 4. Le REF de suppression de la façade (REF-36) tourne en parallèle : il ne partage aucun fichier avec REF-34.

## 2026-11-27 : un REF passe en anglais tous les identifiants du code, après TEC-39 et avant les lots 3 et 4
- Contexte : fil de TEC-39 (noms de fichiers et de dossiers des chantiers en anglais). Les identifiants JS de `lib/` et `test/` mêlent encore le français (`chantier`, `revue`, `bilan`, `tranche` : environ 1000 occurrences dans 54 fichiers). Accord de Didier le 2026-11-27.
- Décision : un REF enfant d'EPIC-17 (`rel_parent: EPIC-17`) les renomme (`chantier` → `workItem`, `revue` → `review`, `bilan` → `report`, `tranche` → `slice`) et ajoute au test d'architecture une règle qui refuse ces mots dans les identifiants. Les textes affichés ne changent pas : ils relèvent du vocabulaire (REF-34) et de la langue de l'utilisateur (EPIC-14).
- Écarté : le faire dans TEC-39, parce qu'un renommage interne de cette taille noierait la revue d'un chantier qui change déjà des noms visibles. Écarté aussi : le laisser à EPIC-14, parce que ses chantiers naîtraient sur des identifiants qu'il faudrait renommer ensuite.
- Ordre : TEC-37 (préfixe AC), TEC-39, ce REF, puis les lots 3 et 4, puis la clôture d'EPIC-17, avant le lot 1 d'EPIC-14. Les trois migrations de nomenclature s'enchaînent sans autre chantier sur `lib/` ni `test/` entre elles : chacune touche presque tous les fichiers. Les lots 3 et 4 naissent ensuite dans la nomenclature définitive, sans réouverture de tests pour renommer.
- Conséquence : la confrontation prévu / réalisé du bilan d'EPIC-17 compte ce REF avec REF-34 et REF-36.

## 2026-11-28 : TEC-37 passe les critères en `AC-n` et livre la partie templates de CA-6
- Contexte : TEC-37 remplace `CA-n` et `V-n` par `AC-n` dans tout le dépôt ; la spec et le plan de cet EPIC sont migrés (entrée datée dans leurs « Amendements »), ce journal garde ses `CA-n`.
- Décision : les templates `spec-tec.md` (section Vérification) et `spec-ref.md` (section Critère de fin) demandent des critères `AC-n` dès TEC-37 (tranche 3), soit la partie templates de CA-6, désormais AC-6 de la spec.
- Conséquence : le lot 3 ne garde de CA-6 que l'exigence de `check-spec` pour TEC et REF, en `AC-n`.
