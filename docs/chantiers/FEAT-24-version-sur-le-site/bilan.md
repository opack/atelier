# Bilan : FEAT-24 Afficher la version d'atelier sur le site

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
Le site affiche la version d'atelier dans la barre de navigation de chaque page et dans la section « Mettre à jour » de la page d'installation, avec la commande pour comparer avec la version installée. La version est lue au build dans `plugin.json`, seule source de vérité ; le site se redéploie quand elle change et la CI échoue si elle manque dans le rendu. Chantier à tranche unique, sans TDD, revu sans bloquant.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 | Livré | Contrôle CI `>v<version></span>` sur `index.html` ; build local : `v0.4.0` dans toutes les pages de `dist/` |
| CA-2 | Livré | Contrôle CI `<strong><version></strong>` sur `projet/installation.html` |
| CA-3 | Livré | Build local avec `9.9.9` : nav et page affichent 9.9.9 ; aucune occurrence de `0.4.0` dans `site/` hors `node_modules` et `dist` |
| CA-4 | Livré, preuve partielle | Relecture du filtre `paths` ; preuve complète au premier bump de version après fusion |
| CA-5 | Livré | Local : le contrôle échoue avec un `dist/` d'une autre version, sans l'entrée de nav, et sans l'interpolation |
| CA-6 | Livré | Build local sur fichier absent, JSON tronqué, champ absent, version vide : échec, message nommant `plugin.json` |

Écart : la page lit la version avec `useData()` au lieu de `$theme`, qui n'existe pas dans les pages VitePress (amendement du 2026-11-23, RD2).

## 3. Choix techniques
- `themeConfig.version` comme unique point d'exposition, lu par la nav et par la page.
- Validation explicite de la version (`X.Y.Z`) au chargement de la config : un build cassé plutôt qu'un site affichant « vundefined ».
- Contrôle CI sur le balisage rendu, pas sur la chaîne brute, présente aussi dans le JSON de données de chaque page (RD1).
- Entrée de nav avec `activeMatch: '^$'` : un repère, pas une rubrique.

## 4. Éléments de code principaux
- `site/.vitepress/config.mjs` : `readPluginVersion()` et l'entrée de nav.
- `site/projet/installation.md` : `<script setup>` + `{{ theme.version }}` dans « Mettre à jour ».
- `.github/workflows/site.yml` : `plugin.json` dans `paths`, étape « Fail when the plugin version is missing ».

## 5. Pistes écartées
- Lien de nav vers l'historique des commits de `main` (Q1) : ne dit pas au lecteur quoi faire de la version.
- Thème personnalisé pour exposer `$theme` aux pages : un fichier de plus pour une seule page.
- CHANGELOG, tags, releases, sélecteur de versions : hors périmètre.

## 6. Dette et suites
- CA-4 à confirmer sur l'onglet Actions au premier bump de version après fusion.
- Hors chantier : `atelier sign` écrit `git user.name` dans `signed_by`, soit « Claude » en session cloud ; corrigé à la main ici, FIX à ouvrir.

## 7. Verdict de revue
<!-- Repris de revue.md : revues de tranche et du chantier, puis un point par identifiant (RB1, RD1…) avec son traitement final, exceptions acceptées comprises. -->
Une revue (chantier à tranche unique, 2026-11-23, commit 1c7f9e4) : aucun bloquant, deux points à discuter.

| Point | Traitement |
|---|---|
| RD1. Garde-fou CI vide : la version brute est aussi dans le JSON de données du site | corrigé (1c7f9e4) |
| RD2. Écart useData() / $theme non reporté en amendement | spec amendée |

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-23
