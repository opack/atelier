---
id: FIX-25
type: FIX
title: Lancer atelier depuis PowerShell et cmd sous Windows
status: draft
tdd: yes
created_at: 2026-11-23
source: constaté par Didier sous Windows (PowerShell), plugin 0.4.0
signed_by:
signed_at:
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

Reproduit en local : non (la CI et les sessions cloud tournent sous Linux). La correction est prouvée par un test sur le contenu du lanceur et ses attributs git (§5), et par l'essai manuel de Didier : avec `bin/atelier.cmd` ajouté à la main, `atelier status` s'affiche normalement dans PowerShell.

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
  `%~dp0` est le dossier du `.cmd` (avec la barre finale), `%*` transmet tous les arguments. Le code de sortie de `node` est celui du `.cmd`.
- **`.gitattributes`** (nouveau, à la racine) :
  - `*.cmd text eol=crlf` : cmd tolère mal les fins de ligne LF ; un dépôt cloné sous Linux ou macOS garde ainsi un `.cmd` valide une fois copié sur Windows.
  - `plugins/atelier/bin/atelier text eol=lf` : un poste Windows avec `core.autocrlf=true` convertirait sinon le shebang en `#!/usr/bin/env node\r`, ce qui casse le lancement sous Git Bash, Linux et macOS.
- **Pas de `atelier.ps1`** : le `.cmd` suffit pour PowerShell et cmd, et un `.ps1` se heurterait à la stratégie d'exécution de PowerShell (`Restricted` par défaut sur les postes clients).
- **Phrase de repli des skills inchangée** : le `.cmd` supprime la cause. Élargir le repli à « ne renvoie rien » ferait relancer en double des commandes à effet de bord, et masquerait un futur défaut au lieu de le révéler.
- **Site** : `site/projet/installation.md` gagne une courte section « Sous Windows » (Node ≥ 20 dans le PATH ; PowerShell, cmd et Git Bash pris en charge). `site/guide/demarrage-rapide.md` ajoute Node ≥ 20 aux prérequis, absent aujourd'hui alors que la CLI en dépend partout.

Aucune donnée à réparer.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné le plugin, quand on lit `plugins/atelier/bin/atelier.cmd`, alors le fichier existe et sa seule commande, sans écho (`@`), lance `node` sur `"%~dp0atelier"` (chemin entre guillemets, relatif au dossier du lanceur) suivi de `%*`.
- [ ] CA-2 : Étant donné le dépôt, quand on interroge les attributs git de `plugins/atelier/bin/atelier.cmd` (`git check-attr eol`), alors `eol` vaut `crlf`.
- [ ] CA-3 : Étant donné le dépôt, quand on interroge les attributs git de `plugins/atelier/bin/atelier` (`git check-attr eol`), alors `eol` vaut `lf`.
- [ ] CA-4 : Étant donné le plugin, quand on lance `claude plugin validate ./plugins/atelier`, alors la validation passe avec le nouveau fichier dans `bin/`.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Contournement en attendant la correction : sous Windows, lancer les skills depuis Git Bash, ou créer `bin/atelier.cmd` à la main dans le cache du plugin.
- Hors périmètre : tester la résolution de commande de PowerShell (impossible sous Linux) ; un `.ps1`.
- Le test vit dans `plugins/atelier/test/` (convention du dépôt pour tout ce qui touche à l'exécution).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
