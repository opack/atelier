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
