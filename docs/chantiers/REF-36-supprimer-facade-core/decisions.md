# Décisions : REF-36 Supprimer la façade lib/core.mjs

## 2026-11-26 : pas de règle d'architecture qui interdise le retour de core.mjs
- Contexte : `coreImportProblems` interdisait d'importer la façade ; la façade disparue, la règle n'a plus d'objet.
- Écarté : une règle « aucun fichier lib/core.mjs », parce qu'un import du fichier disparu échoue déjà au chargement des tests, et qu'un nouveau `core.mjs` serait un module de domaine comme un autre.
- Conséquence : `architecture.test.mjs` ne parle plus de façade.

## 2026-11-26 : pas de montée de version du plugin
- Contexte : le fichier sort du plugin distribué.
- Écarté : 0.8.1, parce que le comportement est inchangé et qu'aucune page du site ne cite `core.mjs` : rien à annoncer aux usagers.
- Conséquence : le site n'est pas touché.
