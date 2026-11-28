# Bilan : FEAT-35 Lister et retrouver les chantiers

## 1. Résumé
Deux skills, `/atelier:list` et `/atelier:open`, pour qui n'utilise jamais la CLI : lister les chantiers du projet (arbre courant et toutes les branches, locales et distantes) avec statut, étape et emplacement, filtrés par une demande en langage naturel, et ouvrir le dossier d'un chantier. Ils s'appuient sur trois commandes, `atelier list`, `atelier path` et `atelier open`. Livré en 5 tranches (4 en TDD, la dernière sans), 593 tests verts, version 0.9.0.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 | livré | `list-selection.test.mjs` |
| CA-2 | livré | `list-selection.test.mjs` |
| CA-3 | livré | `list-selection.test.mjs`, `list-versions.test.mjs` |
| CA-4 | livré | `list-selection.test.mjs`, `list-versions.test.mjs` |
| CA-5 | livré | `list-selection.test.mjs` |
| CA-6 | livré | `list-output.test.mjs` |
| CA-7 | livré | `list-step.test.mjs`, `list-output.test.mjs` |
| CA-8 | livré | `list-step.test.mjs`, `list-selection.test.mjs` |
| CA-9 | livré | `list-versions.test.mjs`, `list-open.test.mjs` |
| CA-10 | livré | `list-versions.test.mjs` |
| CA-11 | livré | `list-versions.test.mjs` |
| CA-12 | livré | `list-versions.test.mjs` |
| CA-13 | livré | `list-output.test.mjs` |
| CA-14 | livré | `list-output.test.mjs` |
| CA-15 | livré | `list-output.test.mjs`, `list-versions.test.mjs`, `list-open.test.mjs` |
| CA-16 | livré | `list-open.test.mjs` |
| CA-17 | livré | `list-open.test.mjs` (tests permissifs, voir OD18 en §6) |
| CA-18 | livré | `list-open.test.mjs` |
| CA-19 | livré | `list-open.test.mjs`, `list-open-exit.test.mjs` (sous Linux seulement) |
| CA-20 | livré | vérification : `npm run build` réussi, page des commandes relue (revue 1 de la tranche 5) |

Non-fonctionnel :
- Performance (SD11), sur un dépôt généré de 1 000 chantiers (moitié avec plan) et 51 branches dont 49 modifient un chantier : `atelier list` 0,31 s, `list --all` 0,31 s, `atelier path` 0,29 s, `atelier status` hors chantier 0,05 s. Sur ce dépôt (≈40 chantiers) : `list` 0,07 s. Budget d'une seconde tenu.
- Skills vérifiés à la main (SD14), par `claude -p --plugin-dir` : « les FIX en cours » donne `--type FIX` ; « les enfants d'EPIC-17 » donne `--parent EPIC-17` ; « les chantiers de Didier » est refusé (pas de filtre par auteur) ; « les FIX de Didier » est signalé, la partie filtrable proposée sans être lancée ; `/atelier:open FIX-18` en session cloud donne le chemin et la raison (pas d'affichage). **Reste à constater par Didier : l'ouverture réelle de l'explorateur sous Windows.**

Écarts par rapport à la spec (RD30) :
- Le skill lance `git fetch --all --prune --quiet`, pas `git fetch --prune --quiet` : sans amont ni remote `origin`, le fetch sans argument échoue (RD21).
- L'index fait 4 ou 5 appels git (vérification du dépôt, branche courante si elle n'est pas fournie, refs, deux `cat-file --batch`) au lieu des « trois au plus » de la spec ; le nombre reste constant, quel que soit le nombre de branches ou de chantiers (RD13).
- Fichiers touchés différents du plan : `lib/cli/identifiers.mjs` n'est pas modifié ; s'ajoutent `lib/list-versions.mjs`, `lib/list-open.mjs`, `lib/chantier-facts.mjs`, `test/list-output.test.mjs` et `test/list-open-exit.test.mjs`.
- Enfants d'un EPIC (RD29, voulu par SB6) : la liste compte les enfants et leur statut dans leur version affichée, branches comprises ; `/atelier:close` exige des enfants fusionnés. Un enfant clos sur sa branche mais pas fusionné fait afficher « enfants clos : à clôturer » alors que la clôture refuse (message clair). Dit sur la page Référence.

## 3. Choix techniques
- Un seul lecteur des chantiers : `chantierIndex` enrichi, pas de second lecteur pour la liste (le futur rangement par centaine n'aura qu'un endroit à reprendre).
- L'index garde des faits extraits par version (`versionFacts` : en-tête, nombre de tranches, tests rouverts, fichiers), jamais les textes.
- Les règles existantes (`sliceState`, `testDrivenPhase`, `needsPlan`, `parseRelations`, `CLOSED_STATUSES`) reçoivent ces faits par un champ `facts` optionnel : aucune règle recopiée.
- La version affichée suit cinq règles (`chooseVersion`) : arbre courant si la branche courante porte l'identifiant ou si le chantier y est clos ; sinon la plus récente des branches qui portent l'identifiant ; sinon l'arbre courant ; sinon la branche la plus récente. Une seule source pour `list`, `path` et `open` (`shownVersions`).
- Le type se lit dans l'en-tête, le préfixe de l'identifiant en repli : colonne, filtre et étape ne peuvent pas se contredire.
- `open` lance l'explorateur sans shell, chemin en argument séparé, détaché ; attend au plus 1,5 s ; un code non nul (sauf `explorer`) ou une commande absente donne le repli : chemin et raison, succès.
- `bin/atelier` attend la promesse des commandes et affiche le message des erreurs, code 1, sans pile (RD17).

## 4. Éléments de code principaux
- `plugins/atelier/lib/cli/relations.mjs` : `chantierIndex`, le lecteur partagé (arbre courant et branches, nombre constant d'appels git).
- `plugins/atelier/lib/chantier-facts.mjs` : `versionFacts`, les faits gardés pour chaque version.
- `plugins/atelier/lib/list-versions.mjs` : `shownVersions`, le choix de la version affichée.
- `plugins/atelier/lib/list.mjs` : arguments, sélection, tri, étape (`chantierSteps`, `stepOf`, `epicStep`) et sortie de la liste.
- `plugins/atelier/lib/list-open.mjs` : `explorerFor` et les messages de `path` / `open`.
- `plugins/atelier/lib/cli/list.mjs`, `plugins/atelier/lib/cli/list-open.mjs` : les commandes.
- `plugins/atelier/skills/list/SKILL.md`, `plugins/atelier/skills/open/SKILL.md` : les skills.

## 5. Pistes écartées
- Un lecteur séparé pour la liste : il dupliquerait la lecture git.
- Garder les textes de spec et de plan dans l'index : inutiles une fois les faits extraits.
- Écrire le nombre de tranches dans l'en-tête : il dupliquerait le plan et dériverait sans bruit.
- Recopier les règles d'étape dans `list.mjs`, ou reconstruire un faux texte de plan : deux copies divergeraient.
- Deux sources pour le type (en-tête pour l'étape, identifiant pour la colonne) : elles peuvent se contredire.
- Ramener `FIX-018` à `FIX-18` : un dossier `FIX-018-x` deviendrait introuvable.
- Un type d'erreur « destinée à l'utilisateur » pour garder la pile des erreurs internes : concept de plus pour un gain faible (RD17).
- Un « filtre voisin » proposé quand une demande ne se traduit pas : c'est le filtre approché que la spec exclut.

## 6. Dette et suites
- RD16 : sous Windows, `git` et `explorer` sont cherchés par leur nom, d'abord dans le dossier courant ; les lancer par leur chemin absolu.
- OD10 : pendant un rebase (HEAD détaché), la copie de travail perd face à la branche du chantier ; limite assumée.
- OD14 : un chantier en double sur une autre branche n'est pas signalé (seuls les doublons de l'arbre courant le sont).
- OD18 : les tests de CA-17 sont permissifs sur le libellé et sur la branche nommée ; à resserrer à une prochaine réouverture.
- RD33 : `lib/chantier-facts.mjs` n'a pas de fichier de tests à son nom (testé à travers `list-step.test.mjs`) ; exception acceptée.
- RD35 : TEC-39 prévoit aussi la version 0.9.0 ; il doit passer en 0.10.0 et parler de mise à jour « depuis 0.9 ».
- Idées de revue : `write-guard.mjs:122` recopie `['done', 'abandoned']` au lieu de `CLOSED_STATUSES` ; `tdd.mjs:193` réécrit `reopeningPending`.
- En cloud, la commande `atelier` du PATH est celle du plugin en cache, parfois plus ancienne : l'en-tête des skills ne prévoit que le cas d'une commande introuvable, pas d'une commande trop ancienne.
- Méthode (décision de Didier, 2026-11-28) : les specs ne citent plus les points de relecture (SBx, SDx), dont le propos n'est consigné nulle part ; la relecture de spec n'est pas archivée ; un point écarté à la relecture va en une ligne dans `decisions.md`. À faire dans `/atelier:new` et le spec-critic ; les specs des chantiers clos restent telles quelles.
- TEC à ouvrir : ranger `docs/chantiers/` en sous-dossiers par centaine ; `chantierIndex` est le seul lecteur à reprendre.
- Suites des bilans (F1) : `atelier suites` pourra s'appuyer sur l'index de ce chantier.

## 7. Verdict de revue
Revues : tranche 1 (2 revues), tranche 2 (2), tranche 3 (3), tranche 4 (2), tranche 5 (2), chantier (2). Aucun point bloquant sur l'ensemble du chantier.

| Point | Traitement |
|---|---|
| RD1 | corrigé (ed9f0a5) |
| RD2 | corrigé (ed9f0a5) |
| RD3 | corrigé (ed9f0a5) |
| RD4 | corrigé (20d9306) |
| RD5 | corrigé (841f4c4) ; test ajouté en tranche 3 (`list-versions.test.mjs`, CA-4) |
| RD6 | corrigé (841f4c4) |
| RD7 | corrigé (841f4c4) |
| RD8 | corrigé (126c525), reporté de la tranche 2 |
| RD9 | corrigé (b0d7bd3) |
| RD10 | corrigé (c3e7584) |
| RD11 | corrigé (c3e7584) |
| RD12 | test ajouté (2b04c5e, tests rouverts puis regelés) |
| RD13 | corrigé (e310977) ; test ajouté en tranche 4 (2b1c040) |
| RD14 | corrigé (8fc79b3) ; test ajouté en tranche 4 (2b1c040) |
| RD15 | corrigé (a46084e) |
| RD16 | reporté (« Dette et suites » du bilan : exécutables système par chemin absolu sous Windows, `git` et `explorer`) |
| RD17 | exception acceptée (Didier, 2026-11-28 : message propre pour les erreurs voulues, erreur interne toujours bruyante, code 1 ; un type d'erreur dédié coûterait plus qu'il ne rapporte) |
| RD18 | corrigé (adbf32b) |
| RD19 | corrigé (adbf32b) |
| RD20 | corrigé (adbf32b) |
| RD21 | corrigé (adbf32b) |
| RD22 | corrigé (adbf32b) |
| RD23 | corrigé (adbf32b) |
| RD24 | corrigé (adbf32b) |
| RD25 | corrigé (4a3a3ae) |
| RD26 | corrigé (4a3a3ae) |
| RD27 | corrigé (4a3a3ae) |
| RD28 | corrigé (4a3a3ae) |
| RD29 | corrigé (c00272f : phrase de la page Référence ; code inchangé, écart repris au bilan) |
| RD30 | reporté (« Écarts » du bilan) |
| RD31 | corrigé (c00272f) |
| RD32 | corrigé (c00272f) |
| RD33 | exception acceptée (Didier, 2026-11-28 : module petit, testé à travers `list-step.test.mjs`, place justifiée par RD11 ; noté au bilan) |
| RD34 | corrigé (c00272f) |
| RD35 | reporté (« Dette et suites » du bilan : TEC-39 passe en 0.10.0, rubrique « depuis 0.9 ») |

- Verdict :
- Validé par :
- Date :
