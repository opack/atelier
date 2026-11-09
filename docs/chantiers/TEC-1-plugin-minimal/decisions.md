# Décisions : TEC-1 Plugin atelier minimal

## 2026-11-09 : code écrit avant la signature de la spec
- Contexte : chantier d'amorçage ; l'outil qui bloque le code avant signature n'existait pas encore.
- Conséquence : commits marqués `Atelier-Bypass`. La spec est à relire et signer par le propriétaire du dépôt avant fusion ; le bilan sera écrit après l'essai sur envo-admin.

## 2026-11-09 : une CLI Node sans dépendance partagée par les skills et les hooks
- Contexte : les skills ont besoin d'opérations déterministes (identifiant suivant, complétude de spec, signature) et les hooks de la même logique.
- Écarté : tout faire en prose dans les skills, parce que la complétude et le blocage doivent être vérifiables et testés.
- Conséquence : logique pure dans `lib/core.mjs`, testée avec `node:test` ; `bin/atelier` exposé aux skills par le `bin/` du plugin.

## 2026-11-09 : état du chantier dans l'en-tête de spec.md, chantier actif déduit de la branche
- Écarté : un fichier d'état séparé ou une base, parce que l'état doit survivre au plugin et se lire dans git.
- Conséquence : statuts `draft | signed | done | abandoned` ; pas de statut « en cours », la prochaine étape se déduit des fichiers présents.

## 2026-11-09 : réécriture d'une spec signée bloquée, éditions ciblées autorisées
- Contexte : historiser sans réécrire.
- Écarté : bloquer toute édition de la spec signée, parce que les amendements datés doivent rester possibles.

## 2026-11-09 : le hook Stop ne lance les contrôles que si du code a changé hors des documents
- Contexte : éviter de lancer la suite de tests à chaque fin de réponse purement conversationnelle ou documentaire.
