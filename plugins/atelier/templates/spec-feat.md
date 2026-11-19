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
