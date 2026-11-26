# Plan : FEAT-35 Lister et retrouver les chantiers

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

Enrichir le lecteur existant `chantierIndex` (trois appels git, quel que soit le nombre de branches) plutôt qu'en écrire un second pour la liste. Pour chaque version d'un chantier (arbre courant ou branche), l'index garde en plus les faits utiles à la liste : liste des fichiers du dossier, nombre de tranches de `plan.md` (`planSliceCount`), marqueur d'ancien modèle (amendements de la spec), type de ref (locale ou distante) et date du dernier commit de la ref (`%(committerdate:unix)`). Les textes de la spec et du plan sont lus dans le même appel git que l'en-tête aujourd'hui, puis jetés. Les consommateurs actuels (relations, `check-spec`, `close`) gardent la même vue.

Toute la logique de la liste est pure dans un nouveau domaine `list` : choix de la version affichée, étape, arguments, sélection, tri, mise en forme, choix de l'explorateur. Les commandes `list`, `path`, `open` sont dans `lib/cli/list.mjs`. Les skills `/atelier:list` et `/atelier:open` ne font que traduire et présenter.

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

- `plugins/atelier/lib/list.mjs` (nouveau, scindé en `list-<sous-domaine>.mjs` au-delà de 400 lignes) : étape, version affichée, arguments, sélection, tri, affichage, explorateur selon la plateforme.
- `plugins/atelier/lib/cli/list.mjs` (nouveau) : commandes `list`, `path`, `open` ; lancement détaché de l'explorateur.
- `plugins/atelier/lib/relations.mjs` et `lib/cli/relations.mjs` : index enrichi (fichiers, nombre de tranches, ancien modèle, type et date des refs), sans changer la vue des consommateurs actuels.
- `plugins/atelier/lib/cli/identifiers.mjs` : recherche du dossier par identifiant normalisé, doublons signalés.
- `plugins/atelier/lib/cli.mjs` : entrées `list`, `path`, `open`.
- `plugins/atelier/skills/list/SKILL.md`, `plugins/atelier/skills/open/SKILL.md` (nouveaux).
- `plugins/atelier/test/list-step.test.mjs`, `list-selection.test.mjs`, `list-versions.test.mjs`, `list-open.test.mjs` (nouveaux) ; `helpers.mjs` seulement pour un utilitaire partagé (dates de commit fixées).
- `site/reference/commandes.md`, pages qui conseillent de parcourir `docs/chantiers/` ; `plugins/atelier/.claude-plugin/plugin.json` (bump mineur).

## Tranches
<!-- Une entrée numérotée de premier niveau par tranche, dans l'ordre : atelier y lit le nombre de tranches.
Chaque tranche : livrable seule, relisible en moins de 15 minutes ; tests, build et revue se font par tranche.
Une tranche garde son numéro ; on ne retire du plan que des tranches à venir.
1. <tranche> — CA couverts : CA-1, CA-2 -->

1. L'étape d'un chantier, en fonction pure : table de la spec dans l'ordre de `nextStep`, préfixe de tranche (`sliceLabel`), enfants d'un EPIC cherchés dans tous les chantiers connus — CA couverts : CA-7, CA-8
2. `atelier list` sur l'arbre courant : arguments (refus compris), filtres, défaut « ouverts », tri, JSON, liste vide, dossier sans spec — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-13, CA-14, CA-15
3. Les autres branches : index enrichi en trois appels git (fichiers, tranches, ancien modèle, type et date des refs) et les cinq règles de la version affichée — CA couverts : CA-9, CA-10, CA-11, CA-12
4. `atelier path` et `atelier open` : chemin absolu, identifiant normalisé, erreurs (autre branche, inconnu, doublon, usage), explorateur selon la plateforme et repli sur le chemin — CA couverts : CA-16, CA-17, CA-18, CA-19
5. Skills `/atelier:list` et `/atelier:open`, site, bump mineur ; vérifications manuelles (skills, mesure de performance) notées pour le bilan — CA couverts : CA-20

## Risques et points d'attention
<!-- - risque : parade -->

- Enrichir l'index casse les relations, `check-spec` ou `close` : la vue qu'ils lisent ne change pas, leurs tests existants restent verts ; tranche 3 relue ligne à ligne.
- Mémoire ou temps sur un gros dépôt : textes de spec et de plan jetés après extraction des faits ; arbres de chantier dédoublonnés comme aujourd'hui ; mesure manuelle (1 000 chantiers, 50 branches) notée au bilan.
- Tests non déterministes sur « le commit le plus récent » (git date à la seconde, commits de test dans la même seconde) : dates fixées par `GIT_COMMITTER_DATE` dans les tests.
- Fichiers de test au-delà de 400 lignes, impossibles à scinder une fois figés : découpage dès la tranche 1 en `list-step`, `list-selection`, `list-versions`, `list-open`.
- Explorateurs : `explorer` renvoie 1 même en cas de succès, `xdg-open` sans affichage peut bloquer : choix isolé dans une fonction pure testée par plateforme ; lancement détaché, sans shell ; lancement réel vérifié à la main.
- Architecture : `lib/list.mjs` n'importe pas `lib/cli/`, aucun réexport dans `core.mjs` (vérifié par `architecture.test.mjs`).
