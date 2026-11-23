---
id: FEAT-24
type: FEAT
title: Afficher la version d'atelier sur le site
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
signed_by:
signed_at:
---

# FEAT-24 Afficher la version d'atelier sur le site

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->
Le site de la méthode ne dit nulle part quelle version d'atelier il décrit. Un lecteur ne peut donc pas savoir si son plugin installé est à jour, ni si la page qu'il lit correspond à ce qu'il a sous la main. La source de vérité de la version est `plugins/atelier/.claude-plugin/plugin.json` (`version`, actuellement `0.4.0`), incrémentée par `npm run version:patch|minor` avant chaque fusion sur `main`.

Si on ne fait rien : l'écart entre le site et le plugin installé reste invisible, et la section « Mettre à jour » de la page d'installation ne donne aucun repère.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->
- Le site affiche la version courante d'atelier dans la barre de navigation, sur toutes les pages (convention VitePress : une entrée `v0.4.0` à droite de la nav).
- La page « Installer atelier », section « Mettre à jour », indique la version courante et la commande pour connaître la version installée (`claude plugin list`), pour que le lecteur compare.
- La version est **lue au build** dans `plugin.json` : aucune recopie à la main, aucune seconde source.
- Le site est reconstruit et redéployé quand la version change, même si rien d'autre dans `site/` ne bouge.

**Hors périmètre** : un journal des modifications (CHANGELOG), des tags git ou des releases GitHub, un site par version (sélecteur de versions), l'affichage de la version dans le plugin lui-même (`atelier --version`).

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->
- `site/.vitepress/config.mjs` : lire `../../plugins/atelier/.claude-plugin/plugin.json` (chemin relatif au fichier de config, `readFileSync` + `JSON.parse`), ajouter l'entrée de nav. Exposer aussi la version aux pages Markdown (par exemple via `themeConfig` lu avec `useData()`, ou une constante `vite.define`) pour la page d'installation.
- `site/projet/installation.md` : mention de la version dans « Mettre à jour ».
- `.github/workflows/site.yml` : **piège trouvé** : le workflow ne se déclenche que sur `site/**`, `plugins/atelier/templates/**` et lui-même. Une PR qui ne fait que monter la version ne redéploierait pas le site, qui afficherait alors l'ancienne version. Ajouter `plugins/atelier/.claude-plugin/plugin.json` aux `paths`.
- Garde-fou dans le même workflow, sur le modèle du contrôle `@include` existant : après le build, vérifier que la version de `plugin.json` apparaît dans le HTML généré, sinon échec.
- `CLAUDE.md` (section Structure, `site/`) : signaler que le site lit la version dans `plugin.json`.
- Aucune dépendance ajoutée.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->
- Q1 : cible du lien de l'entrée de nav (VitePress exige un lien ou un sous-menu). Proposition : la page « Installer atelier », section « Mettre à jour ». Alternative : l'historique des commits de `main` sur GitHub.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->
- [ ] CA-1 : Étant donné `plugin.json` en version `X.Y.Z`, quand le site est construit, alors chaque page HTML générée contient `vX.Y.Z` dans la barre de navigation.
- [ ] CA-2 : Étant donné `plugin.json` en version `X.Y.Z`, quand le site est construit, alors la page `projet/installation.html` contient `X.Y.Z` dans la section « Mettre à jour ».
- [ ] CA-3 : Étant donné une version modifiée dans `plugin.json` sans autre changement, quand le site est reconstruit, alors il affiche la nouvelle version (aucune valeur codée en dur dans `site/`).
- [ ] CA-4 : Étant donné un push sur `main` qui ne modifie que `plugins/atelier/.claude-plugin/plugin.json`, alors le workflow « Site » se déclenche (filtre `paths`).
- [ ] CA-5 : Étant donné un build où la version de `plugin.json` est absente du HTML généré, alors le workflow « Site » échoue avant le déploiement.
- [ ] CA-6 : Étant donné un `plugin.json` illisible ou sans champ `version`, quand le site est construit, alors le build échoue avec un message qui nomme le fichier (pas de site publié avec « vundefined »).

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, site statique public, la version est déjà publique dans le dépôt.
- Performance : N/A, une lecture de fichier au build.
- Accessibilité : l'entrée de nav est un lien VitePress standard, accessible au clavier ; son libellé (`v0.4.0`) suffit au lecteur d'écran.
- Données personnelles : N/A.
- Compatibilité : VitePress ^1.6.4, Node 22 en CI ; aucune dépendance ajoutée.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->
- Version actuelle : `0.4.0`. Pour CA-3 et CA-6 : build local avec un `plugin.json` modifié temporairement (version `9.9.9`, puis champ supprimé).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
