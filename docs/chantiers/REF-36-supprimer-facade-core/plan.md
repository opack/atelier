# Plan : REF-36 Supprimer la façade lib/core.mjs

## Approche
Suppression pure, en un seul commit de code : le fichier, les règles de test qui ne protègent que lui, les mentions dans `CLAUDE.md`, et les trois commentaires de `lib/cli/` redirigés vers le module qui déclare la fonction. Pas de garde de remplacement contre un retour de `core.mjs` : un import du fichier disparu échoue au chargement, `npm test` le voit. Pas de montée de version : le comportement du plugin ne change pas, et aucune page du site ne mentionne `core.mjs`.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : supprimé.
- `plugins/atelier/test/architecture.test.mjs` : retrait de `facadeProblems`, `coreImportProblems`, de l'exception `core.mjs` dans `importProblems`, de la ligne façade du test « ce dépôt respecte toutes les règles [REF-29 CA-4] », et des trois tests de la façade.
- `plugins/atelier/lib/cli/close.mjs`, `lib/cli/stop-hook.mjs`, `lib/cli/review.mjs` : commentaires vers `lib/close.mjs`, `lib/stop-hook.mjs`, `lib/review.mjs`.
- `CLAUDE.md` : description de `lib/core.mjs` (Structure) et règles de la façade (Conventions) retirées, le reste des règles gardé.

## Tranches
1. Suppression de la façade, de ses règles de test, de ses mentions — CA couverts : CA-1, CA-2, CA-3 — TDD : non

## Risques et points d'attention
- Test d'architecture modifié par un chantier sans TDD : seules des suppressions, à vérifier en revue (les tests restants gardent nom et corps).
- REF-34 en parallèle : aucun fichier commun ; si `main` bouge sur `architecture.test.mjs` ou `CLAUDE.md`, fusionner `main` avant la revue.
- Liste des noms de tests avant / après (CA-2) : à produire pour la revue, base 498 → 495.
