# FIX-25 Décisions

## 2026-11-23 Version 0.4.2
La spec cite 0.4.0 (version installée chez Didier), mais main est déjà en 0.4.1 : le passage de version corrective (SD4) donne 0.4.2.

## 2026-11-23 Pas de numéro de version dans le site
`site/projet/installation.md` parle d'« une version d'atelier qui ne fournit pas encore `atelier.cmd` » plutôt que d'« avant 0.4.2 » (OD3 écarté) : CLAUDE.md interdit de recopier une version à la main dans le site.

## 2026-11-23 Points du contrôle de surapprentissage
- OD1 (tests sur la forme, pas l'exécution sous Windows) : reporté à la clôture. Le bilan consigne CA-4 (constaté le 2026-11-23 : `claude plugin validate ./plugins/atelier` passe) et CA-5 (essai manuel de Didier sous Windows PowerShell 5.1, PowerShell 7 et cmd).
- OD2 (CRLF garanti seulement pour une installation extraite par git) : accepté, déjà documenté par SD3 dans la spec.
