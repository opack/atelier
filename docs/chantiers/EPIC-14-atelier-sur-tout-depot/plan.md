# Plan : EPIC-14 Travailler avec atelier sur n'importe quel dépôt

<!-- Découpage prévu de l'EPIC, écrit une fois puis laissé tel quel : les écarts vont dans decisions.md,
la confrontation prévu / réalisé dans bilan.md. -->

## Approche
<!-- 2 à 5 lignes : comment la vision se découpe et dans quel ordre on la réalise, et pourquoi. -->

D'abord le pointeur de chantier actif : il a de la valeur seul, dans tout projet atelier, et retire les heuristiques de TEC-6 et FEAT-21 dont le compagnon ne peut pas dépendre. Puis le compagnon, en deux lots : les conventions de branche et de commit déclarées (utiles aussi dans un projet atelier), puis le dépôt compagnon lui-même. Les langues forment une piste indépendante, qui part de REF-34 (EPIC-17). Aucun lot ne démarre avant la fin d'EPIC-17, qui touche les mêmes modules de `lib/`. Le site (CA-10) est mis à jour par chaque lot, dans sa PR.

## Lots
<!-- Un lot = un chantier enfant à ouvrir (/atelier:new, avec rel_parent: EPIC-14), livrable seul. -->

| Ordre | Lot | Type envisagé | Dépendances pressenties | CA globaux couverts |
|---|---|---|---|---|
| 1 | Chantier actif par pointeur : table `branche → chantier` dans `.atelier/`, `atelier use`, en-tête `branch:`, repli sur un candidat unique, retrait des détections par nom de branche et par commits (TEC-6, `--first-parent` de FEAT-21), reprise des règles de version de FEAT-35, migration des chantiers ouverts | FEAT | fin d'EPIC-17 | CA-1, CA-2, CA-3, CA-10 |
| 2 | Conventions de branche et de commit déclarées dans la configuration : `/atelier:new` (rester sur la branche courante ou format déclaré), reviewer, messages de commit et de fusion des skills | FEAT | lot 1 | CA-4 (conventions), CA-10 |
| 3 | Dépôt compagnon : `codeRoot` / `atelierRoot`, registre utilisateur par URL de remote normalisée, garde des specs hors du projet, variante compagnon de `/atelier:init`, exclusions par `.git/info/exclude`, lectures des chantiers dans le compagnon, commits par chemins, sens de `done` | FEAT | lots 1 et 2 | CA-4, CA-5, CA-6, CA-10 |
| 4 | Langue du projet : réglage dans la configuration (`fr` par défaut), dictionnaire injectable, templates anglais, preuve par pseudo-langue | FEAT | REF-34 (EPIC-17) | CA-7 (documents), CA-9, CA-10 |
| 5 | Langue de l'utilisateur : réglage personnel non commité, catalogue des messages des hooks et de la CLI citant le dictionnaire du projet | FEAT | lot 4 | CA-7 (messages), CA-8, CA-10 |
| 6 | Skills et agents réécrits en anglais pivot : documents dans la langue du projet, échanges dans celle de l'utilisateur | FEAT | lot 5 | CA-7 (échanges), CA-10 |

## Risques et points d'attention
<!-- - risque : parade -->

- EPIC-17 touche les mêmes modules de `lib/` (REF-34, lots 3 et 4) : aucun lot avant sa clôture ; ensuite, enchaîner les lots qui touchent les mêmes modules plutôt que les mener de front.
- FEAT-35 fusionné avant le lot 1 : ses règles de version fondées sur le nom de branche sont reprises dans le lot 1 (prévu au cadre).
- Le lot 1 coupe net la détection par branche et par commits : les chantiers ouverts à sa fusion se rattachent par `atelier use <ID>`, que le hook de démarrage de session indique ; le lot le vérifie sur les chantiers ouverts du dépôt.
- Le lot 3 est le plus gros (cœur, CLI, garde, `init`, plusieurs skills) : le découper en tranches (racines séparées, registre, garde, init et exclusions, skills).
- Le compagnon en session cloud est hors périmètre (le scope utilisateur ne survit pas à un conteneur neuf) : à documenter dans le lot 3.
- Le lot 6 réécrit beaucoup de texte avec peu de tests : tranches skill par skill, et revue attentive des consignes déplacées ou perdues.
- Ordre des pistes : si une mission en anglais arrive avant le besoin du compagnon, les lots 4 et 5 passent avant les lots 2 et 3.
