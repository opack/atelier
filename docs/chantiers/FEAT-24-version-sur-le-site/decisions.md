# Décisions : FEAT-24 Afficher la version d'atelier sur le site

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-23 : Q1, l'entrée de nav pointe vers « Mettre à jour »
- Contexte : VitePress exige un lien ou un sous-menu pour une entrée de nav.
- Écarté : l'historique des commits de `main`, parce qu'il ne dit pas au lecteur quoi faire de la version ; « Mettre à jour » donne la version et la commande pour comparer.
- Conséquence : `activeMatch: '^$'` pour que l'entrée ne soit pas surlignée sur la page d'installation (SD6).

## 2026-11-23 : la page lit la version via `useData()`, pas `$theme`
- Contexte : la spec (§3, SD2) prévoyait `{{ $theme.version }}`. VitePress 1.6 n'expose que `$frontmatter` et `$params` aux pages ; `$theme` plante au rendu (`Cannot read properties of undefined`).
- Écarté : un thème personnalisé qui ajouterait `$theme` en propriété globale, parce que c'est un fichier de plus pour une seule page.
- Conséquence : `installation.md` ouvre par un `<script setup>` qui lit `theme` avec `useData()`, puis `{{ theme.version }}`. Même source (`themeConfig.version`), seule la syntaxe change.
