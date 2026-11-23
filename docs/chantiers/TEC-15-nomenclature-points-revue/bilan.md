# Bilan : TEC-15 Identifiants stables des points de relecture

## 1. Résumé
Chaque point soulevé par un sous-agent de relecture porte désormais un identifiant stable et continu sur tout le chantier : `RB`/`RD` (revue de code), `SB`/`SD` (relecture de spec), `OB`/`OD` (surapprentissage). `atelier review-ids` donne les prochains numéros, et `set-reviewed`, `close-check` et `set-status done` refusent un `revue.md` dont un point n'a pas de traitement reconnu ou est mal formé. Livré en 6 tranches et 2 revues du chantier, en version 0.4.0 du plugin ; ce chantier a été son propre premier utilisateur (21 points `RD`, 2 `RB`).

## 2. Livré vs spécifié
Tests dans `plugins/atelier/test/core.test.mjs`, blocs `describe('TEC-15 …')`.

| Critère | Statut | Test |
|---|---|---|
| CA-1 | Livré | `numbering the review points` : « CA-1 : le prochain numéro suit le plus grand de chaque série… », « …référence ex- compte aussi » |
| CA-2 | Livré | `numbering` : « CA-2 : sans aucun fichier… », « CA-2 : un revue.md sans point… » |
| CA-3 | Livré | `checking the review points` : « CA-3 : c'est la dernière occurrence… » |
| CA-4 | Livré | `checking` : « CA-4 : un traitement commence par un mot-clé… », « CA-4 : un point sans traitement reconnu… » |
| CA-5 | Livré | `checking` : 4 tests CA-5 (deux sections, même titre (RB1), même section, repris deux fois (OB2)) |
| CA-6 | Livré | `checking` : 6 tests CA-6 (forme, `Aucun`, nombre de cellules, en-tête jamais pris à tort : RD6, RD7, RD10, RD11) |
| CA-7 | Livré | `checking` : 3 tests CA-7 (`## Tour`, section `## Tour` isolée (RD5), points `B1.` contrôlés) |
| CA-8 | Livré | `refusing open review points in the CLI` : « CA-8 : set-reviewed refuse… » (revue de tranche et du chantier), « …enregistre la revue quand tous les points sont traités » |
| CA-9 | Livré | `refusing` : CA-9 sur `close-check` et `set-status done` (point ouvert, `revue.md` non commité), acceptation |
| CA-10 | Livré | `numbering` : 3 tests CA-10, dont `atelier review-ids --json` de bout en bout |
| CA-11 | Livré | `prefixes in agents, skills and templates` : tests de contenu par fichier |
| CA-12 | Livré | `reading revue.md` : 7 tests CA-12 (marqueurs, CRLF, tableaux de points, ligne vide, sans en-tête, cellules, commentaire HTML) |
| CA-13 | Livré | `checking` : « CA-13 : un RD requalifié en RB… » ; `numbering` : « CA-13 : le prochain RD tient compte… » |
| CA-14 | Livré | `checking` : « CA-14 : un RB dans le tableau « À discuter »… » |
| CA-15 | Livré | `reading` : « CA-15 : un \| dans une cellule… » |
| CA-16 | Livré | `checking` : 4 tests CA-16 (dont formes libres (OD12) et féminin (RD12)) ; `refusing` : 2 tests CLI |
| CA-17 | Livré | `checking` : 2 tests CA-17 (titre proche, ligne hors tableau) |
| CA-18 | Livré | `checking` : 7 tests CA-18 (requalifié sans renvoi, repris / ex- orphelins, ordre par section (OD19, OD22), OD20) |
| CA-19 | Livré | `site reference pages` : 2 tests de contenu (commandes, glossaire) |

Vérifications d'ensemble : `npm test` 256/256 vert ; plugin validé ; site construit ; essai manuel : toute la revue de ce chantier menée avec la nomenclature, `revue.md` contrôlé par la CLI à chaque `set-reviewed`.

Écarts par rapport à la spec, tous consignés dans `decisions.md` :
- `RB`/`RD` comptés sur toute ligne de tableau de `revue.md`, pas seulement la colonne « Point » (OD27, OD28, OD30) : plus large, dans le sens prudent (un numéro n'est jamais réutilisé).
- La reprise des points `reporté (tranche N)` est confiée à la skill `review`, pas à `review-ids` (OD29, décision de l'utilisateur).
- `guide/vue-ensemble.md` et `cycle/amendement.md` modifiés hors de la liste du §3 (OB4, OD44), parce qu'ils contredisaient la nouvelle règle.
- Spec amendée en cours de route : CA-17, CA-18 (deux fois) et CA-19 ajoutés ou précisés.

## 3. Choix techniques
- Toute la logique dans des fonctions pures de `core.mjs` ; une seule implémentation du contrôle, appelée par `set-reviewed` (sans `atClose`) et la clôture (avec `atClose`).
- `readChantier` expose `chantier.revue` (texte ou `null`), comme FEAT-7 pour `chantier.plan` : signatures de `setReviewedRefusal` et `closeProblems` inchangées.
- Analyse des tableaux à la CommonMark : un en-tête ouvre un tableau, est suivi d'un séparateur et n'a que des noms de colonnes ; toute autre ligne `|` est un point, bien formé ou non. Une ligne lue en trop est signalée ; une ligne sautée serait perdue.
- Sections comptées par position, jamais par titre (RB1) ; « plus haut » / « plus loin » jugés par indice de section, l'ordre étant indifférent dans une section (OD19).
- Mots-clés de traitement reconnus par préfixe (`reporté\p{L}*`, `requalifié\p{L}*`), casse ignorée.
- `revue.md` au format `## Tour` (antérieur à FEAT-7) : pas de contrôle dès qu'une section `## Tour` existe. Limite assumée.
- SPIKE sans TDD et EPIC exemptés du contrôle, `revueUncommitted` compris.
- Le reviewer ne calcule jamais les numéros : la skill les lui passe ; une revue est consignée dans `revue.md` avant d'être relancée (RB3).

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` :
  - `parseReviewPoints(text)` : sections, tableaux de points, cellules (`\|`), commentaires HTML, blocs de code, CRLF, `legacy`.
  - `isTreatment(cell)` : la cellule commence par un mot-clé de traitement.
  - `reviewPointProblems(parsed, { atClose })` : tous les contrôles du §3 de la spec.
  - `nextReviewIds({ revue, spec, decisions })` : `{ next, open }`.
  - `setReviewedRefusal`, `closeProblems` (paramètre `revueUncommitted`) : branchement du contrôle.
- `plugins/atelier/lib/cli.mjs` : commande `review-ids [--json]`, calcul de `revueUncommitted` pour `close-check` et `set-status done`.
- `plugins/atelier/skills/review/SKILL.md` et `agents/reviewer.md` : la marche à suivre (numéros, `(repris)`, `(ex-…)`, traitements, consignation avant relance).
- `plugins/atelier/templates/revue.md` et `bilan.md` (§7 par identifiant).
- Site : `cycle/revue.md` (règles complètes), `reference/commandes.md`, `reference/glossaire.md`.

## 5. Pistes écartées
- Préfixes `B`/`D` communs à toutes les relectures : collisions entre revue, relecture de spec et surapprentissage d'un même chantier.
- Fichier dédié aux points `SB`/`SD`/`OB`/`OD` (`relecture-spec.md`) : hors périmètre, à rouvrir si l'usage montre qu'on les cite après la session.
- Contrôle des messages de commit (citation du point) : convention seulement, la colonne Traitement porte le hash.
- Reconnaître l'en-tête de tableau par des filtres sur son contenu (RD6, RD7, RD10) : chaque filtre laissait un cas ouvert ; remplacé par la règle de position et de noms de colonnes (RD11).
- Imposer « À discuter » avant « Bloquant » pour garder l'ordre des lignes (OD19) : contraire au template et à toutes les revues existantes.
- Numéros à zéros en tête (`RB02`, RD4) : écarté, les numéros sont fournis par `review-ids`.
- Champ `problems` dans `review-ids --json` (RD21) : hors spec ; `set-reviewed` attrape tout.

## 6. Dette et suites
- RD20 : `checkSpec` prend tout `…` d'une section obligatoire pour un texte à compléter (faux positif sur CA-17, CA-18 et l'exemple JSON du §3). Chantier FIX à ouvrir.
- Une tranche TDD sans critère d'acceptation ne peut pas être figée (`freeze-tests` exige un commit de test) : contourné ici par CA-19. Chantier FIX à ouvrir.
- Tests non renforcés, signalés à l'utilisateur pendant les vérifications de surapprentissage : OD6, OD10, OD18, OD25, OD31, OD32, OD35, OD40, OD45 (sortie texte de `review-ids`, `closeProblems` sans test core de `revueUncommitted`, CA-11 et CA-19 limités à la présence de mots…).
- Limite assumée : un `revue.md` qui garde une section `## Tour` échappe au contrôle.

## 7. Verdict de revue
Revues de tranche : tranche 1 (6 revues), tranche 2 (2), tranches 3 et 4 (1 chacune), tranches 5 et 6 (2 chacune) ; revue du chantier : 2 revues, la dernière sans point, sur 474ed91 ; commit revu enregistré : 4a22813.

| Point | Traitement |
|---|---|
| RB1 | corrigé (aea10c1) : sections comptées par position ; test ajouté (c98dee6) |
| RB3 | corrigé (76d577f) : la revue est consignée avant d'être relancée |
| RD1 | corrigé (ab308d8) |
| RD2 | corrigé (ab308d8) : `cellCountMismatch`, signalé avec CA-6 |
| RD3 | corrigé (ab308d8) : commentaire masqué s'il ouvre une ligne |
| RD4 | écarté : les numéros sont donnés par `review-ids` |
| RD5 | test ajouté (9a00da6) : une section `## Tour` suffit, limite assumée au §4 de la spec |
| RD6 | corrigé (37616d4) ; test avec CA-6 (9a00da6) |
| RD7 | corrigé (24e212a) ; test avec CA-6 (9a00da6) |
| RD8 | test ajouté (9a00da6) : RD6, RD7, RD10, RD11 couverts avec CA-6 |
| RD9 | corrigé (24e212a) |
| RD10 | corrigé (6941c37) ; test avec CA-6 (9a00da6) |
| RD11 | corrigé (765f871) ; test avec CA-6 (9a00da6) |
| RD12 | corrigé (aea10c1) ; test ajouté (c98dee6) |
| RD13 | corrigé : CA-13 (numérotation) ajouté à la tranche 3 du plan |
| RD14 | corrigé : RD5 et RD8 repris dans la revue suivante |
| RD15 | corrigé (aea10c1) |
| RD16 | corrigé (76d577f) |
| RD17 | corrigé (76d577f) |
| RD18 | corrigé (76d577f) |
| RD19 | corrigé (3d7f912) |
| RD20 | reporté (chantier FIX à ouvrir), voir « Dette et suites » |
| RD21 | corrigé (2ac8abe) |

Aucune exception acceptée. `RB2` n'existe pas : le numéro est consommé par l'exemple `RB2` cité dans RD4 (OD30, accepté).

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-23
