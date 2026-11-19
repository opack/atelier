---
id: TEC-2
type: TEC
title: Site VitePress de la méthode
status: draft
tdd: no
created_at: 2026-11-18
signed_by:
signed_at:
---

# TEC-2 Site VitePress de la méthode

## 1. Quoi
Un site VitePress (`site/`) qui présente la méthode atelier de façon didactique : démarrage rapide, puis chapitres regroupés par thème (fondations, cycle d'un chantier, préparation du projet, travail avec l'agent, au-delà du solo, référence). Déploiement sur GitHub Pages.

## 2. Pourquoi
La méthode vit dans des pages Notion difficiles à parcourir et à partager. Un site versionné avec le plugin reste aligné sur lui (les templates sont repris des fichiers du plugin) et se lit sans compte Notion.

## 3. Périmètre
- Inclus : contenu de la méthode, référence des commandes, hooks, configuration, templates et glossaire ; garanties et limites du plugin ; retour arrière d'une installation ; recherche locale ; workflow de déploiement.
- Le site décrit le comportement du plugin tel que fusionné dans `main` (TEC-1, version 0.1.1).
- Hors périmètre : le pitch d'entretien et l'état de la pratique personnelle, qui restent dans Notion.

## 5. Vérification
- `npm run build` dans `site/` sans erreur ni lien mort.
- Relecture visuelle des pages principales.
- Après fusion : site publié sur `https://opack.github.io/atelier/` (Pages à activer avec la source « GitHub Actions »).

## Amendements
