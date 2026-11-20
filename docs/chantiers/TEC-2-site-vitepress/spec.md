---
id: TEC-2
type: TEC
title: Site VitePress de la méthode
status: done
tdd: no
created_at: 2026-11-18
signed_by: Opack
signed_at: 2026-11-20
done_at: 2026-11-20
---

# TEC-2 Site VitePress de la méthode

## 1. Quoi
Un site VitePress (`site/`) qui présente la méthode atelier de façon didactique : démarrage rapide, puis chapitres regroupés par thème (fondations, cycle d'un chantier, préparation du projet, travail avec l'agent, au-delà du solo, référence). Déploiement sur GitHub Pages.

## 2. Pourquoi
La méthode vit dans des pages Notion difficiles à parcourir et à partager. Un site versionné avec le plugin reste aligné sur lui (les templates sont inclus au build directement depuis les fichiers du plugin) et se lit sans compte Notion.

## 3. Périmètre
- Inclus : contenu de la méthode, référence des commandes, hooks, configuration, templates et glossaire ; garanties et limites du plugin ; retour arrière d'une installation ; recherche locale ; workflow de déploiement.
- Le site décrit le comportement du plugin tel que fusionné dans `main` (TEC-1, version 0.1.1).
- La page Référence > Templates inclut les fichiers de `plugins/atelier/templates/` via `<!--@include: ...-->` de VitePress, sans copie manuelle.
- Le site fait foi pour la description de la méthode.
- Hors périmètre : le pitch d'entretien et l'état de la pratique personnelle, qui restent dans Notion ; la réduction du `README.md` à un résumé renvoyant au site (chantier ultérieur).
- Contexte : le site a été écrit avant la signature de cette spec (commits `eaf0d73`, `96b547f`). Écart au process à tracer dans le bilan.
- `tdd: no` : chantier de contenu, sans logique à tester ; l'inclusion des templates au build remplace un test de cohérence.

## 4. Impacts indirects
- Première dépendance npm du dépôt (VitePress), cantonnée à `site/` : le plugin reste sans dépendance.
- Contenu publié publiquement : rien de personnel ni de propre à un client.
- Coût : quelques minutes de GitHub Actions par push sur `main` touchant `site/**`, `plugins/atelier/templates/**` ou le workflow.

## 5. Vérification
- `npm run build` dans `site/` sans erreur ni lien interne mort. Les liens externes ne sont pas vérifiés (trou accepté).
- Les 9 templates de `plugins/atelier/templates/` sont inclus au build : modifier un template change la page Référence > Templates sans autre intervention.
- Relecture humaine de conformité au plugin, avant fusion :
  - chaque skill de `plugins/atelier/skills/` et chaque sous-commande de `bin/atelier` apparaît dans `reference/commandes.md` ;
  - chaque hook de `hooks/hooks.json` apparaît dans `reference/configuration.md` ;
  - chaque agent de `plugins/atelier/agents/` apparaît dans la référence.
- Relecture visuelle humaine, avant fusion, de l'accueil, du démarrage rapide, d'une page du cycle et de la référence : rendu bureau et mobile, mode clair et sombre, recherche en français.
- Relecture du contenu publié : rien de personnel ni de propre à un client.
- [ ] Pages activé sur le dépôt avec la source « GitHub Actions » (action manuelle du propriétaire, préalable).
- Après fusion : un push sur `main` touchant `site/**` publie le site sans erreur et `https://opack.github.io/atelier/` répond.

## 6. Retour arrière
- Site cassé après une publication : revert du commit fautif sur `main`, ce qui republie la version précédente ; ou relancer le workflow sur un commit sain.
- Abandon du site : désactiver Pages dans les réglages du dépôt et supprimer `.github/workflows/site.yml`. Le plugin n'est pas affecté.

## Amendements
