# Décisions : FIX-20 TDD décidé tranche par tranche

## 2026-11-23 : le TDD se décide par tranche, dans le plan
- Contexte : TEC-15, tranche 6 (site, README, version) impossible à figer ; contournement par un CA de complaisance (CA-19).
- Écarté : A, `/atelier:plan` refuse une tranche TDD sans CA, parce que la tranche documentaire est légitime et récurrente et qu'une fusion dans une tranche de code mélange logique et prose ; B, gel « vide », parce que c'est un faux événement ; C, déduire le TDD de l'absence de CA, trop implicite.
- Conséquence : chaque tranche déclare `TDD : oui|non` ; le `tdd` du chantier devient la valeur par défaut.

## 2026-11-23 : la valeur de la tranche courante vit dans l'en-tête protégé de la spec (`slice_tdd`)
- Contexte : relecture de la spec (B2) : `plan.md` est un chemin libre, un agent pourrait sortir de « tests d'abord » en l'éditant.
- Écarté : lire le plan à chaque décision du hook, parce que contournable ; garder `plan.md` par le hook, parce que trop large.
- Conséquence : `slice_tdd` n'est écrit que par `check-plan` (s'il est vide), `set-reviewed` et `set-tdd` (tracé).

## 2026-11-23 : pas de contrôle « on ne fait qu'ajouter des tests » en tranche sans TDD
- Contexte : relecture de la spec (B3).
- Écarté : le contrôle des lignes de test retirées au `set-reviewed`, parce qu'il casserait les chantiers `tdd: no` (un REF modifie ses tests) et laisserait un test faux sans voie de sortie.
- Conséquence : une tranche sans TDD se comporte comme un chantier `tdd: no` ; la revue juge.

## 2026-11-23 : `check-plan` reste dans FIX-20, FIX-20 passe avant REF-16
- Contexte : relecture (D8) et conflit prévisible sur `core.test.mjs`.
- Écarté : sortir `check-plan` dans un chantier séparé, parce que le comportement de `plan` faisait partie de la demande ; passer REF-16 d'abord, parce que FIX-20 débloque TEC-15.
- Conséquence : REF-16 se recale sur FIX-20.

## 2026-11-24 : lecture tolérante des tranches du plan (tranche 1, OD1, OD2)
- Contexte : vérification de surapprentissage de la tranche 1.
- Retenu : séparateur « — » ou « – » entouré d'espaces ; texte libre après « oui » / « non » (`TDD : oui (logique pure)`) ; identifiants CA lus sans casse et normalisés (`ca-1` → `CA-1`).
- Écarté : le tiret simple comme séparateur, parce qu'il apparaît dans les titres de tranche.

## 2026-11-24 : numéros de tranche en double (OD3) reportés à la tranche 4
- Contexte : `planSlices` renvoie deux tranches de même numéro si le plan les écrit ; `planSliceCount` garde le plus grand numéro, comme avant.
- Conséquence : `planProblems` (tranche 4) signalera le doublon ; d'ici là, les lectures par numéro prennent la première entrée.

## 2026-11-24 : rebase sur REF-29 (lib/ rangé par domaine)
- Contexte : REF-29 fusionné (PR #21) ; procédure RD18 de `docs/chantiers/REF-29-lib-par-domaine/decisions.md`.
- Fait : fusion de `main` ; `planSlices`, `sliceAttributes` et `planSliceCount` rejoués dans `lib/slices.mjs`, façade `core.mjs` reprise telle quelle de `main` (aucun réexport ajouté) ; `test/plan.test.mjs` importe depuis `lib/slices.mjs`, `describe` renommé sans identifiant de chantier (règle REF-16). Les assertions des tests de la tranche 1 sont inchangées.
- Écarté : déplacer ces tests dans `slices.test.mjs`, parce que le plan (RD2) nomme `plan.test.mjs` et que la règle d'architecture l'accepte.
- Conséquence : les tranches 2 à 6 visent les modules de domaine (`tdd.mjs`, `review.mjs`, `slices.mjs`, `next-step.mjs`…), pas `core.mjs` ; la liste des fichiers de `plan.md` est à recaler à la tranche 2.

## 2026-11-24 : gel de la tranche 2 avec une copie du plugin au tampon agrandi
- Contexte : `atelier freeze-tests` plante (`ENOBUFS`) : `testFilesWithRemovedLines` (`lib/cli/tdd.mjs`) lance un `git diff` complet depuis `slice_base`, non limité aux `testPaths` ; après la fusion de `main` (REF-29), il dépasse le tampon par défaut d'`execFileSync` (1 Mo).
- Retenu (choix de Didier) : `freeze-tests` lancé depuis une copie du plugin hors du dépôt, identique sauf `maxBuffer` dans `gitRaw` ; spec écrite par la commande (`tests_commit: a48e750`, entrée de regel). Bug porté par un FIX séparé.
- Écarté : intégrer le bug à FIX-28, parce qu'il a sa propre cause (taille du diff) ; corriger d'abord, parce que FIX-20 resterait bloqué pour un résultat identique.

## 2026-11-24 : tranche 2, points de surapprentissage
- OB1 (corrigé) : `tests_commit` ne vaut `implementing` que si le chantier ou la tranche est en TDD ; un chantier passé en `tdd: no` après le gel (modèles `single`, `legacy`) revient à `none`, comme avant. Le cas n'est pas couvert par les tests figés de CA-4 : signalé à Didier.
- OD4 (reporté à la tranche 3, où se trouve CA-10, et non 4) : en revue d’ensemble, une réouverture en attente donne `writing-tests` même pour un chantier `tdd: no`. Tant que `reopen-tests` reste accepté dans une tranche « TDD : non », une réouverture peut y rester en attente ; CA-10 (tranche 3) la refuse.
- OD5 (corrigé) : `slice_tdd` lu sans casse.
- Hors tranche : `codeCommittedFact` et `sliceCodeFiles` (`lib/cli/`) lisent encore `tdd` du chantier ; prévu en tranche 5 (CA-13).

## 2026-11-25 : tranche 3, points de surapprentissage
- OB2 (corrigé, message) : la spec refuse `set-tdd` sur une tranche aux tests figés et `set-tdd no` pendant une réouverture ; une tranche qui a figé des tests reste donc en TDD. Le message ne promet plus de passer par `reopen-tests` pour changer son TDD : il dit que la tranche reste en TDD et renvoie vers la réouverture pour corriger ses tests (CA-9). Écarté : `set-tdd no` qui viderait `tests_commit`, parce qu'il permettrait de quitter le TDD en abandonnant des tests figés.
- OD6 (corrigé) : hors tranche numérotée (plan à une tranche), `set-tdd` écrit aussi `slice_tdd` s'il est renseigné, sinon la commande serait sans effet. Test à ajouter avec CA-12 (tranche 4).
- OD7 (corrigé) : « sans TDD pour cette tranche » dépend de `slice_tdd: no`, pas du `tdd` du chantier.
- OD8 (corrigé pour le chemin, test reporté) : `testsFrozenBefore` lit l'historique de la spec par son chemin relatif au projet. Le cas `tdd: no` dont une tranche a figé des tests, en revue d'ensemble, est à couvrir en tranche 4.
- OD9 (corrigé) : le refus « tests figés » de `set-tdd` ne joue qu'en phase `implementing` ; un `tests_commit` hérité d'un chantier repassé en `tdd: no` ne bloque plus.

## 2026-11-25 : tranche 4, points de surapprentissage
- OB3 (corrigé) : `checkPlanValues` n'écrit rien après une réouverture ou un regel (entrées « tests rouverts » / « tests regelés ») ni en modèle `legacy` : `reopen-tests` vide `tests_commit`, et sans ce garde-fou un agent sortait des « tests d'abord » en éditant le plan puis en lançant `check-plan`. Test à ajouter en tranche 5.
- OD10 (exception acceptée par Didier le 2026-11-25 : fenêtre étroite, la skill `plan` lance `check-plan` avant le commit du plan, seuls les plans antérieurs à FIX-20 sont exposés, et l'édition du plan reste visible au diff et à la revue) : avant le premier gel de la tranche 1, avec `slice_tdd` vide, éditer le plan puis lancer `check-plan` fait sauter le TDD. La spec l'autorise (écriture tant que `slice_tdd` est vide) ; le garde-fou « plan pas encore commité » contredirait le test CA-12 figé.
- OD11 (corrigé) : `planProblems` signale un plan sans tranche et une numérotation trouée. Test à ajouter en tranche 5.
- OD12 (corrigé) : les CA de la spec se lisent sans casse, avec les puces `-`, `*` ou `+`. Test à ajouter en tranche 5.
- OD13 (corrigé en partie) : un chemin de plan qui désigne un dossier sort en 1 au lieu de lever EISDIR. Tests de `check-plan` sans argument et du dossier à ajouter en tranche 5.

## 2026-11-25 : tranche 5, points de surapprentissage
- OD14 (reporté en tranche 6, accord de Didier) : `status` n'affiche pas « TDD : non » pour un chantier à une seule tranche (modèle `single`) dont `slice_tdd` est renseigné, alors que le JSON porte `sliceTdd`. Correction en tranche 6 (sans TDD : test écrit avec le code) : afficher la ligne dès que `sliceTdd` est renseigné hors modèle `none`.
- OD15 (écarté, accord de Didier) : `check-plan` compare strictement le chemin du plan à celui du chantier ; sur un disque insensible à la casse, une casse différente n'écrit pas `slice_tdd`. Défaut prudent (rien n'est écrit à tort, le message l'explique), cas très improbable.
- OD16 (reporté en tranche 6, avec OD14) : test de l'absence de la ligne « TDD : … » quand `slice_tdd` est vide, et du rattachement de la ligne à la tranche.

## 2026-11-25 : tranche 6 (sans TDD)
- Fusion de main (FEAT-27, version 0.6.0) au début de la tranche ; version du plugin portée à 0.7.0 (nouvelle commande `check-plan`).
- OD14 (corrigé) : `formatStatus` reçoit le modèle de tranche (`sliceState`) en argument, pour ne pas changer le JSON de `status`. Tranche numérotée : « Tranche N/M : TDD : oui|non » ; modèle `single` : « TDD : oui|non » seul ; rien en modèle `none`, `legacy` ni en revue d'ensemble.
- OD16 (corrigé) : tests de l'absence de la ligne quand `slice_tdd` est vide et du rattachement de la ligne à la tranche (`test/tdd-slice-status.test.mjs`).
- Skill `plan` : `atelier check-plan` est lancé avant le commit du plan ; quand il écrit `slice_tdd`, la spec est commitée avec le plan dans `docs(chantiers): [<ID>] plan`.
