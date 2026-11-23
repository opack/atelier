# Décisions : FIX-26

## 2026-11-23 : implémentation
- `codeCommittedMatters` (core.mjs, pure) décide si le signal peut changer la prochaine étape ; `codeCommittedFact` (cli.mjs) ne lance git que dans ce cas et rend `null` sur toute erreur git ou base hors de l'historique (SB1, SD4).
- `nextStep` n'utilise le signal que si la revue vaut `none`, y compris sur une tranche en cours : même règle que le calcul côté commande.
- OD1 (reporté) : `sliceCodeFiles` compte aussi le code apporté par une fusion de la branche par défaut après le début de la tranche (`git log <début>..HEAD` sans `--first-parent`). Faux positif partagé avec la règle « tranche vide » de `set-reviewed`, que la spec impose de réutiliser : à traiter dans un chantier séparé, qui corrigera les deux.
- OD2 (accepté) : un chantier passé de `single` à `sliced` avec un `reviewed_commit` résiduel ne calcule pas le signal (revue non `none`, SD4) et garde « Implémenter ». Cas rare.
- OD3 (signalé à l'utilisateur) : aucun test de bout en bout ne couvre le chemin « base de fusion » (sans TDD, sans `slice_base`), ni le SPIKE, ni la revue `stale` côté commande. Tests non modifiés pendant l'implémentation.
