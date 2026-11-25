# Plan : FEAT-24 Afficher la version d'atelier sur le site

## Approche
La spec a déjà tranché l'essentiel (SD1, SD2, SD4, SD6) : `config.mjs` lit et valide `plugin.json` au chargement, expose `themeConfig.version`, ajoute l'entrée de nav ; la page d'installation interpole `{{ $theme.version }}` ; le workflow « Site » surveille `plugin.json` et vérifie la présence de la version dans le HTML généré. Le tout tient en une tranche d'une soixantaine de lignes : un découpage plus fin produirait des tranches qui ne se vérifient pas seules (la nav sans le contrôle CI, ou l'inverse).

## Fichiers et couches touchés
- `site/.vitepress/config.mjs` : lecture validée de `plugin.json` (erreur nommant le fichier), `themeConfig.version`, entrée de nav avec `activeMatch`.
- `site/projet/installation.md` : version courante et `claude plugin list` dans « Mettre à jour ».
- `.github/workflows/site.yml` : `plugin.json` dans `paths` ; contrôle post-build sur `index.html` et `projet/installation.html`.
- `CLAUDE.md` : section Structure, le site lit la version dans `plugin.json`.

## Tranches
1. Version lue au build, affichée dans la nav et la page d'installation, redéploiement et garde-fou CI — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5, CA-6

## Risques et points d'attention
- Ancre `#mettre-a-jour` : dépend du slug VitePress de « Mettre à jour » (accents retirés) ; vérifiée dans le HTML construit.
- Le contrôle CI réutilise la lecture de version en shell : s'il diverge de celle de `config.mjs`, il peut passer à tort. Parade : même source (`plugin.json`), même champ, et CA-5 vérifié en local contre un `dist/` construit avec une autre version.
- CA-4 ne se prouve vraiment qu'au premier bump après fusion : à surveiller sur l'onglet Actions.
