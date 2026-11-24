---
id: FIX-25
type: FIX
title: Lancer atelier depuis PowerShell et cmd sous Windows
status: signed
tdd: yes
created_at: 2026-11-23
source: constaté par Didier sous Windows (PowerShell), plugin 0.4.0
signed_by: Opack
signed_at: 2026-11-23
tests_commit: 391f2cb
slice: 1
reviewed_commit: a04c332c99bd7e4eaea0afa1a432ea652b47388d
---

# FIX-25 Lancer atelier depuis PowerShell et cmd sous Windows

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : sous Windows, quand une skill fait lancer `atelier …` depuis PowerShell (ou cmd), Windows ouvre la fenêtre « Ouvrir avec… » sur `<plugin>/bin/atelier` au lieu d'exécuter la commande. PowerShell ne renvoie rien : ni erreur, ni sortie.
- Attendu : `atelier <commande>` s'exécute et affiche sa sortie dans PowerShell et dans cmd, comme sous Linux, macOS et Git Bash.
- Impact : toutes les skills `/atelier:*` sous Windows hors Git Bash. L'agent reçoit une sortie vide, ne déclenche pas le repli prévu et peut conclure à tort (statut vide, spec sans problème, etc.). Gravité forte : le process est inutilisable ou, pire, trompeur.
- Source : constat manuel sous Windows, plugin 0.4.0.

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
1. Windows, plugin atelier installé, Claude Code utilisant PowerShell comme shell.
2. Lancer une skill qui appelle `atelier status --json` (par exemple `/atelier:status`).
3. Constater la fenêtre « Ouvrir avec… » et une sortie vide.

`Get-Command atelier` renvoie une `Application` pointant sur `bin/atelier`.

Reproduit en local : non (les sessions cloud tournent sous Linux ; le dépôt n'a pas de CI de tests, SD9). La correction est prouvée par des tests automatiques sur le contenu du lanceur et ses attributs git (CA-1 à CA-3), et par un essai manuel sous Windows avec le plugin de la branche (CA-5, SB2). Didier a déjà constaté qu'avec un `bin/atelier.cmd` ajouté à la main, `atelier status` s'affiche normalement dans PowerShell.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
`plugins/atelier/bin/atelier` est un script Node sans extension, lancé par son shebang `#!/usr/bin/env node`. Windows ignore les shebangs : PowerShell trouve le fichier dans le PATH mais, faute d'extension associée, le confie à l'Explorateur, d'où « Ouvrir avec… ». Le repli des skills (« si `atelier` est introuvable, utilise `node …/bin/atelier` ») ne se déclenche pas, puisque la commande est trouvée.

Les hooks ne sont pas concernés : `plugins/atelier/hooks/hooks.json` appelle déjà `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier" …`.

Preuve : `Get-Command atelier` → `Application` sur `bin/atelier` ; l'ajout de `bin/atelier.cmd` corrige le symptôme (`Get-Command atelier -All` le place en premier, `.CMD` faisant partie de `PATHEXT`). Confiance : forte.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Corrige la cause : donner à Windows un lanceur qu'il sait exécuter, comme npm le fait avec ses paires `foo` / `foo.cmd`.

- **`plugins/atelier/bin/atelier.cmd`** (nouveau), une seule ligne :
  `@node "%~dp0atelier" %*`
  `%~dp0` est le dossier du `.cmd` (avec la barre finale). `%*` transmet les arguments, mais après une nouvelle analyse par cmd (SB1) : voir « Limite connue » plus bas. `node` étant la dernière commande, son code de sortie est celui du `.cmd`.
- **`.gitattributes`** (nouveau, à la racine) :
  - `*.cmd text eol=crlf` : précaution (SD3). Un `.cmd` d'une ligne marche aussi en LF, mais cmd gère mal les fins LF dès qu'il y a des étiquettes ; CRLF est la forme attendue sous Windows. Ne vaut que pour une installation extraite par git (marketplace) : avec `--plugin-dir` ou une marketplace en dossier local, le fichier reste tel quel sur disque.
  - `plugins/atelier/bin/atelier text eol=lf` : un poste Windows avec `core.autocrlf=true` convertirait sinon le shebang en `#!/usr/bin/env node\r`, ce qui casse le lancement sous Git Bash, Linux et macOS.
- **Pas de `atelier.ps1`** : le `.cmd` suffit pour PowerShell et cmd, et un `.ps1` se heurterait à la stratégie d'exécution de PowerShell (`Restricted` par défaut sur les postes clients).
- **Phrase de repli des skills inchangée** : le `.cmd` supprime la cause. Élargir le repli à « ne renvoie rien » ferait relancer en double des commandes à effet de bord, et masquerait un futur défaut au lieu de le révéler.
- **Version** : passage en version corrective (`npm run version:patch`) dans ce chantier (SD4). Claude Code met son cache à jour d'après la `version` de `plugin.json` : sans passage de version, les installations en 0.4.0 ne recevraient jamais `atelier.cmd`.
- **Site** : `site/projet/installation.md` gagne une courte section « Sous Windows » (Node ≥ 20 dans le PATH ; PowerShell, cmd et Git Bash pris en charge). `site/guide/demarrage-rapide.md` ajoute Node ≥ 20 aux prérequis, absent aujourd'hui alors que la CLI en dépend partout. `site/reference/limites.md` documente la limite connue ci-dessous (SD10).

**Limite connue (SB1, SD8).** Les arguments passés par `%*` sont réanalysés par cmd : `&`, `|`, `<`, `>`, `^` hors guillemets et `%VAR%` y sont interprétés (défaut commun à tous les lanceurs `.cmd`, dont ceux de npm). Les raisons libres (`bypass on`, `set-tdd no`, `reopen-tests`) contenant ces caractères peuvent être tronquées sous PowerShell et cmd. Parade retenue : la documenter, sans nouveau mécanisme de passage d'arguments, faute de cas réel. De même, `"atelier" status` (nom de commande entre guillemets) dans cmd peut fausser `%~dp0` ; un agent n'écrit pas la commande ainsi.

Aucune donnée à réparer.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné le plugin, quand on lit `plugins/atelier/bin/atelier.cmd`, alors le fichier existe et contient une seule ligne non vide qui, sans écho (`@`), lance `node` sur `"%~dp0atelier"` (chemin entre guillemets, relatif au dossier du lanceur) suivi de `%*`. Le test ignore les `\r` et le saut de ligne final : le fichier est en LF chez son auteur sous Linux jusqu'à la prochaine extraction (SD2).
- [ ] CA-2 : Étant donné le dépôt, quand on interroge les attributs git de `plugins/atelier/bin/atelier.cmd` (`git check-attr eol`, dans un dépôt temporaire qui reçoit le `.gitattributes` du projet, pour que le test tourne aussi hors d'un clone, SD1), alors `eol` vaut `crlf`.
- [ ] CA-3 : Étant donné le dépôt, quand on interroge les attributs git de `plugins/atelier/bin/atelier` (même méthode que CA-2), alors `eol` vaut `lf`.
- [ ] CA-4 : Étant donné le plugin, quand on lance `claude plugin validate ./plugins/atelier`, alors la validation passe avec le nouveau fichier dans `bin/`. Vérification manuelle (la CLI Claude ne tourne pas dans `npm test`), non probante avant la correction (SD11).
- [ ] CA-5 (manuel, Windows, SB2, SD7) : Étant donné le plugin installé depuis cette branche (`.cmd` extrait par git), quand on lance dans Windows PowerShell 5.1, PowerShell 7 et cmd `atelier status --json`, puis une commande en échec, puis `atelier set-tdd no "raison avec espaces et l'apostrophe"` sur un chantier jetable, alors la sortie s'affiche, le code de sortie de l'échec est non nul (`$LASTEXITCODE` / `%ERRORLEVEL%`), et la raison est enregistrée intacte. Échoue avant la correction (fenêtre « Ouvrir avec… », sortie vide).
- [ ] CA-6 (relecture) : Étant donné le site, quand on lit `site/projet/installation.md`, `site/guide/demarrage-rapide.md` et `site/reference/limites.md`, alors on y trouve la section « Sous Windows », Node ≥ 20 dans les prérequis et la limite connue sur les arguments réanalysés par cmd.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Contournement en attendant la correction : sous Windows, lancer les skills depuis Git Bash, ou créer `bin/atelier.cmd` à la main dans le cache du plugin.
- Hors périmètre : tester automatiquement la résolution de commande de PowerShell (impossible sous Linux) ; un `.ps1` ; une CI qui lance `npm test` (idée de chantier TEC, SD9).
- Repli des skills sous PowerShell (SD5) : Claude Code remplace `${CLAUDE_PLUGIN_ROOT}` par le chemin réel dans le texte chargé de la skill (constaté : la skill affiche le chemin du cache en clair), donc PowerShell ne voit jamais la syntaxe `${…}`.
- Le test vit dans `plugins/atelier/test/` (convention du dépôt pour tout ce qui touche à l'exécution).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
