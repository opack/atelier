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
