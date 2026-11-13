---
id: TEC-1
type: TEC
title: Plugin atelier minimal
status: draft
tdd: no
created_at: 2026-11-09
signed_by:
signed_at:
---

# TEC-1 Plugin atelier minimal

## 1. Quoi
Construire le premier lot du plugin atelier : marketplace, commandes `init`, `new`, `sign`, `plan`, `tests`, `status`, `close`, `off`, hooks (blocage du code avant signature, contrôles avant de terminer, rappel en début de session), sous-agents `spec-critic` et `reviewer`, templates de spec par type, plan, journal, bilan, ADR.

## 2. Pourquoi
Le process IA est documenté dans Notion mais rien ne l'applique : sans outil, la signature et les tests d'abord reposent sur la seule discipline. Construire le plugin tout de suite permet de l'affiner par l'usage réel sur envo-admin puis Envo, plutôt que sur papier.

## 3. Périmètre
- Inclus : le premier lot ci-dessus, la CLI `atelier` (sans dépendance) et ses tests, l'installation et la mise à jour par la marketplace GitHub.
- Hors périmètre : `/atelier:fix`, `/atelier:slice`, `/atelier:discover`, index Notion, socle commun entre projets.

## 4. Impacts indirects
Les projets qui installent le plugin et lancent `/atelier:init` ne peuvent plus modifier de code sans chantier signé. Aucun effet sans `.claude/atelier.json`.

## 5. Vérification
- `npm test` vert (logique de blocage, identifiants, complétude de spec, prochaine étape).
- `claude plugin validate .` et `claude plugin validate ./plugins/atelier` sans erreur.
- Essai de bout en bout de la CLI sur un dépôt jetable : blocage avant signature, signature refusée si spec incomplète, refus de réécrire une spec signée, contrôles avant de terminer, débrayage.
- Essai réel : `/atelier:init` puis un premier chantier sur envo-admin.

## 6. Retour arrière
Désinstaller le plugin ou supprimer `.claude/atelier.json` du projet concerné.

## Amendements
- 2026-11-13 : ajout du cycle TDD « write tests, commit; code, iterate, commit » (Anthropic) appliqué par les hooks : phase tests d'abord (implémentation refusée), gel des tests à leur commit, phase implémentation (tests en lecture seule, contrôle de fin anti-modification), commande `/atelier:build`, sous-agent `overfit-checker`.
- 2026-11-13 : TDD décidé chantier par chantier (`tdd: yes | no` obligatoire avant signature), au lieu d'être imposé par type. Ce chantier : `tdd: no`, les tests ont été écrits en même temps que le code.
