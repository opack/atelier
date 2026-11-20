# Chez un client ou en entreprise

Avant d’utiliser un agent sur un code qui ne vous appartient pas, clarifiez le cadre. C’est un **contrat**, pas un choix technique.

## Les questions à poser avant

- **Confidentialité** : le code et les données peuvent-ils être envoyés à un modèle tiers ? Quel fournisseur, quel accord (pas d’entraînement sur les données, durée de rétention, localisation) ? Faut-il une offre entreprise ou passer par le cloud du client ?
- **Propriété** : à qui appartient le code généré ? Quelles licences ?
- **Données** : jamais de données de production ni de données personnelles dans le contexte de l’agent. Des jeux de test anonymisés.
- **Secrets** : aucun secret accessible à l’agent, des droits minimaux, une validation humaine des commandes risquées.
- **Traçabilité** : indiquer dans les PR ce qui a été généré.

## Si l’IA est interdite

La méthode reste valable **sans agent** : chantiers identifiés, specs signées, tests d’abord, revue, bilan. Seul l’agent disparaît.
