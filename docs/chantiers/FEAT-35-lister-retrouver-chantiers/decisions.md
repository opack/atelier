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

## 2026-11-26 : tests de la tranche 1 (validés par Didier)
- Contexte : relecture des tests de CA-7 et CA-8.
- Décidé : les libellés utilisent l'apostrophe typographique (« tests d’abord »), comme le reste du code ; un `rel_parent` en minuscules désigne le même parent.
- Reporté : les clauses de CA-8 qui passent par la commande (« y compris avec `--type EPIC` », « y compris sans `--all` ») se testent en tranche 2, avec `atelier list` ; ces tests porteront l'étiquette CA-8.

## 2026-11-26 : tranche 1, les faits extraits passent aux règles existantes par un champ `facts`
- Contexte : l'étape doit réutiliser `sliceState` et `testDrivenPhase`, qui lisent les textes du plan et de la spec, que l'index ne garde pas.
- Écarté : recopier ces règles dans `list.mjs` (deux copies divergeraient) ; reconstruire un faux texte de plan ou de spec (fragile).
- Conséquence : `sliceState` lit `facts.sliceCount` et `facts.reopened`, `testDrivenPhase` lit `facts.refreezing`, s'ils sont présents ; sans `facts`, comportement inchangé. La règle « à planifier » est partagée avec `nextStep` (`needsPlan`, OD3), l'enfant d'un EPIC se lit par `parseRelations` (OD1).

## 2026-11-26 : tranche 1, libellés d'étape
- Le préfixe de tranche s'applique aux étapes tests, implémentation et revue enregistrée d'une tranche numérotée d'un chantier découpé, pas à la revue du chantier.
- Un EPIC en branche d'intégration n'a pas d'étape « revue d'ensemble » : la table de la spec ne la prévoit pas, `atelier status` la donne.
- Les libellés sont en dur dans `list.mjs`, comme les textes de `next-step.mjs` : ce ne sont pas des termes des documents.

## 2026-11-26 : OD4 reporté à la tranche 2
- Contexte : le vérificateur de surapprentissage relève trois cas non couverts par les tests figés de la tranche 1 : ancien modèle avec plan découpé et tests rouverts, tranche numérotée avec revue enregistrée, type en minuscules dans l'en-tête.
- Écarté : rouvrir les tests de la tranche 1, pour trois cas que le code traite déjà bien (vérifié à la main par le vérificateur).
- Conséquence : ces cas s'ajoutent aux tests de la tranche 2, étiquetés CA-7.

## 2026-11-26 : le type d'un chantier se lit dans son en-tête, pour la colonne comme pour l'étape
- Contexte : remarque de la revue 1 de la tranche 1 : l'étape se calcule sur le `type` de l'en-tête (comme `nextStep`) ; une colonne type déduite de l'identifiant afficherait « EPIC » avec une étape qui n'en est pas une.
- Écarté : deux sources (en-tête pour l'étape, identifiant pour la colonne), parce qu'elles peuvent se contredire.
- Conséquence : en tranche 2, la colonne type, le filtre `--type` et l'étape lisent le type de l'en-tête, et le préfixe de l'identifiant seulement s'il manque.

## 2026-11-27 : tests de la tranche 2 (validés par Didier)
- Le statut s'affiche par son code (`signed`, `done`…) dans la sortie texte.
- Le type affiché est en majuscules, lu dans l'en-tête, sinon dans le préfixe de l'identifiant ; colonne, `--type` et étape lisent cette même source.
- `--parent` ne tient pas compte de la casse.
- La liste vide ne mentionne `--all` que si le défaut « ouverts » a écarté des chantiers clos (aucun chantier du tout : pas de mention).
- Reporté en tranche 3 : la clause de CA-3 « rattaché à EPIC-17 sur une autre version seulement » (elle a besoin des branches), étiquetée CA-3.
- Les deux cas d'OD4 sur l'étape (ancien modèle à tranches, tranche numérotée revue) sont ajoutés à la fin de `list-step.test.mjs` ; ils passaient déjà.

## 2026-11-27 : tranche 2, implémentation et surapprentissage
- Les étapes se calculent sur toutes les versions connues, avant tout filtre ; le choix de version entre branches (tranche 3) se branchera dans `currentTreeVersions` (`lib/cli/list.mjs`), seule source de versions.
- Le type est calculé une fois (`chantierType`) et injecté dans l'en-tête passé à `versionFacts` : colonne, filtre, tri et étape lisent la même valeur. Un type d'en-tête inconnu se replie sur le préfixe de l'identifiant (OD7).
- Une option à valeur refuse une valeur absente, vide, qui commence par `--` ou qui ne donne rien une fois découpée (`--status ,`, OD6).
- Colonne parent : le texte affiche `parent EPIC-17` ; en JSON, `parent` vaut `rel_parent` en majuscules (« , » entre plusieurs valeurs), sinon `null`.
- OD5 (deux dossiers du même identifiant : lignes incohérentes) reporté à la tranche 3, qui refait le choix de version : une seule version par identifiant, doublon signalé.
- OD8 (combinaisons non couvertes : défaut « ouverts » avec `--type`, mention `--all` quand les filtres écartent aussi les clos, détail de la ligne de FEAT-30) : tests non rouverts, le code les traite ; à surveiller à la revue de la tranche 3.

## 2026-11-27 : RD8 reporté en tranche 3 : un seul lecteur des chantiers
- Contexte : la tranche 2 lit l'arbre courant par `currentTreeVersions`, à côté de `chantiersHere` ; la décision du 2026-11-26 veut un seul lecteur (`chantierIndex` enrichi).
- Conséquence : en tranche 3, `chantiersHere` et `chantierIndex` sont enrichis des faits de chaque version, `commandList` lit l'index, `currentTreeVersions` disparaît. Le test de RD5 (texte entre guillemets découpé en mots) s'ajoute aux tests de la tranche 3, étiqueté CA-4.

## 2026-11-27 : tests de la tranche 3 (validés par Didier)
- Un seul fichier, `list-versions.test.mjs` ; dates de commit fixées (`GIT_COMMITTER_DATE`).
- Chantier ici et sur une branche qui l'emporte : `path` reste le chemin de l'arbre courant, `location` la branche.
- Doublon d'identifiant dans l'arbre courant (OD5) : une seule entrée, JSON propre, avertissement qui nomme les deux dossiers sur la sortie d'erreur ; la version gardée n'est pas fixée.
- Quatre tests passent dès l'écriture (CA-10, CA-11, clause de CA-3, RD5) : ils protègent les règles que la lecture des branches ne doit pas casser.

## 2026-11-27 : tranche 3, implémentation et surapprentissage
- `shortRefName` distinguait déjà `feat/x` (locale) et `origin/feat/x` (distante) : inchangé. Le type de ref est un champ `local` à part, qui départage à égalité de date ; ensuite l'ordre des noms, pour un choix indépendant de l'ordre des refs.
- Le choix de version est une fonction pure (`lib/list-versions.mjs`, `chooseVersion`, `shownVersions`) ; `chantierIndex` garde pour chaque version ses faits (`versionFacts`), sa date et son type de ref ; les consommateurs actuels lisent toujours `{ branch, data }` et `here`.
- `chantiersHere` trie les noms de dossier : en cas de doublon, le dossier retenu est déterministe (le dernier dans l'ordre lexical). L'avertissement de doublon n'est émis que par `atelier list`, sur la sortie d'erreur.
- OD9 corrigé : hors d'un dépôt git, l'échec de la lecture des refs vaut « aucune branche » (SD10) ; le test s'ajoute aux tests de la tranche 4.
- OD13 corrigé : `chantierIndex` accepte la branche courante en paramètre optionnel ; `atelier list` ne la lit qu'une fois.
- OD10 (pendant un rebase, HEAD détaché, la copie de travail perd face à la branche du chantier) : non corrigé, limite à noter au bilan.
- OD11 (les autres consommateurs de l'index lisent aussi plans et fichiers) : non corrigé ; la mesure de performance du bilan inclura `atelier status`.
- OD12 (test : une branche du chantier plus ancienne bat une branche sans son identifiant plus récente) : à ajouter aux tests de la tranche 4, étiqueté CA-9.
- OD14 : le skill `/atelier:list` (tranche 5) ne mélange pas sortie d'erreur et sortie standard ; doublons sur les branches non signalés, suite au bilan.

## 2026-11-27 : RD13, les branches se lisent dès qu'on est dans un dépôt
- Contexte : la correction de RD10 sautait la lecture des refs quand la branche courante est illisible, ce qui arrive aussi sur une branche sans commit.
- Conséquence : `chantierIndex` teste la présence du dépôt (`rev-parse --git-dir`), un appel git de plus. Tests à ajouter en tranche 4 : branche orpheline (RD13), hors dépôt git (OD9), branche du chantier plus ancienne contre branche sans son identifiant plus récente (OD12, CA-9).

## 2026-11-27 : tests de la tranche 4 (validés par Didier)
- Choix de l'explorateur : fonction pure `explorerFor(plateforme, environnement)` dans `lib/list-open.mjs`, qui rend `{ command, ignoreExitCode }` ou `{ command: null, reason }` ; un `DISPLAY` vide compte comme absent ; hors macOS, Windows et Linux : `xdg-open`.
- Les tests de CA-19 (repli sur le chemin) ne tournent que sous Linux : ailleurs, un `open` réussi ouvrirait une fenêtre pendant `npm test` ; CA-18 teste le choix pour toutes les plateformes.
- `commitOnDay` ajouté à `helpers.mjs` ; `list-versions.test.mjs`, figé, garde sa copie locale.
- Tests reportés des revues de la tranche 3, ajoutés ici et déjà verts : hors dépôt git (OD9), branche qui porte l'identifiant contre branche plus récente (OD12), branche sans commit et branche nommée `null` (RD13, RD14).

## 2026-11-27 : tranche 4, implémentation et surapprentissage
- `path` et `open` cherchent le dossier par l'index (`chantierIndex`, identifiants par `chantierIdFromDirectoryName`, égalité exacte : FIX-18 ne trouve pas FIX-180) ; `findChantierDirectory` n'est pas modifié. Le message « autre branche » nomme la branche de la version affichée (`shownVersions`).
- OD15 corrigé : `open` attend la fin de l'explorateur au plus 1,5 s ; un code ≠ 0 donne le repli (chemin et code), sauf pour `explorer` (code ignoré) ; au-delà du délai, le dossier est considéré ouvert. Une fin par signal compte comme ouvert. Test (faux `xdg-open` en échec) en tranche 5.
- OD17 corrigé : l'argument doit être un identifiant entier d'un type connu, sinon l'usage. `FIX-018` n'est pas ramené à `FIX-18` : l'argument est lu comme les noms de dossier (numéro tel quel), sinon un dossier `FIX-018-x` deviendrait introuvable.
- OD19 corrigé : `main` rend la promesse de la commande ; `bin/atelier` affiche le message d'une promesse rejetée et sort en 1.
- OD16 (path et open lisent toutes les branches même quand le chantier est ici) : non corrigé ; `atelier path` entre dans la mesure de performance du bilan.
- OD18 (tests de CA-17 permissifs sur le libellé et sur le choix de la branche nommée) : non rouverts, à reprendre à une prochaine réouverture.

## 2026-11-28 : RD17, les erreurs non rattrapées affichent leur message sans pile d'appels
- Contexte : `bin/atelier` attend maintenant la promesse des commandes (OD19) et affiche le message d'une erreur, code 1, pour toutes les commandes.
- Écarté : un type d'erreur « destinée à l'utilisateur » pour garder la pile des erreurs internes, concept de plus pour un gain faible.
- Conséquence : exception acceptée par Didier ; une erreur interne reste bruyante, sans `fichier:ligne`.

## 2026-11-28 : tranche 5, skills, site et vérifications à la main
- `/atelier:list` : une demande non traduisible est refusée en disant ce qui ne se filtre pas, sans filtre approché (SD7) ; la proposition d'un « filtre voisin » écrite d'abord par implementer est retirée.
- Pages du site qui évoquent `docs/chantiers/` sans conseiller de le parcourir (installation, trace, limites…) : laissées telles quelles.
- Test d'OD15 (faux `xdg-open` en échec ou en succès) : `test/list-open-exit.test.mjs`, sous Linux seulement.
- Mesure de performance (SD11, OD11, OD16), dépôt généré de 1 000 chantiers (moitié avec plan) et 51 branches dont 49 modifient un chantier : `atelier list` 0,31 s, `list --all` 0,31 s, `atelier path` 0,29 s, `atelier status` hors chantier 0,05 s ; sur ce dépôt (≈40 chantiers), `list` 0,07 s et `status` 0,08 s. Budget d'une seconde tenu : OD11 et OD16 restent sans correction.
- Vérification des skills (SD14), par `claude -p --plugin-dir` sur le dépôt généré : « les chantiers de Didier » est refusé explicitement (filtre par auteur impossible), « les FIX en cours » donne la liste des FIX ouverts. `/atelier:open` en session cloud : vérifié au niveau de la commande (chemin et raison) ; l'ouverture réelle en local reste à constater par Didier.

## 2026-11-28 : tranche 5, suites de la revue 1
- RD20 (SD14 complété), par `claude -p --plugin-dir` sur ce dépôt : « les enfants d'EPIC-17 » lance `--parent EPIC-17` (aucun enfant ouvert, renvoi vers `--all`) ; « les FIX de Didier » (RD19, demande traduisible en partie) : le skill dit ne pas savoir filtrer par auteur et propose la liste des FIX ouverts sans la lancer ; `/atelier:open FIX-18` par le skill en session cloud : chemin affiché, raison (pas d'affichage) donnée. L'ouverture réelle en local reste à constater par Didier.
- RD21 : le skill lance `git fetch --all --prune --quiet` et non `git fetch --prune --quiet` comme l'écrit la spec : sans amont ni remote `origin`, le fetch sans argument échoue ; l'intention de SD12 (récupérer le remote) est mieux tenue.
- Constat en passant : en cloud, la commande `atelier` du PATH est celle du plugin en cache (antérieure à `list`) ; l'agent a basculé sur celle du plugin chargé ; l'en-tête du skill ne prévoit que le cas d'une commande introuvable (suite possible : un `atelier` trop ancien dans le PATH, pour l'en-tête de tous les skills).
