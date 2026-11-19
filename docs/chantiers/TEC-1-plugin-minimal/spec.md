---
id: TEC-1
type: TEC
title: Plugin atelier minimal
status: signed
tdd: no
created_at: 2026-11-09
signed_by: Opack
signed_at: 2026-11-19
---

# TEC-1 Plugin atelier minimal

## 1. Quoi
Construire le premier lot du plugin atelier :
- la marketplace GitHub (un seul plugin) ;
- les commandes `/atelier:init`, `new`, `sign`, `plan`, `tests`, `build`, `status`, `close`, `off` ;
- la CLI `atelier`, sans dépendance, et ses tests : identifiant suivant, `check-spec`, `sign`, `set-status`, `set-tdd`, `freeze-tests`, `reopen-tests`, `tests-changed`, `bypass`, et les entrées des hooks ;
- les hooks : garde d'écriture, contrôle de fin de tour, rappel en début de session ;
- les sous-agents `spec-critic`, `reviewer` et `overfit-checker` ;
- les templates : une spec par type, le plan, le journal de décisions (`decisions.md`), le bilan et l'ADR ;
- les scripts `version:patch` et `version:minor`.

## 2. Pourquoi
Le process IA est documenté dans Notion, mais rien ne l'applique : sans outil, la signature et les tests d'abord reposent sur la seule discipline. Construire le plugin tout de suite permet de l'affiner par l'usage réel, sur envo-admin puis sur Envo, plutôt que sur papier.

## 3. Périmètre
- Inclus :
  - le lot ci-dessus ;
  - le cycle TDD, décidé chantier par chantier (`tdd: yes | no`) ;
  - l'installation et la mise à jour par la marketplace GitHub.
- Hors périmètre :
  - `/atelier:fix`, `/atelier:discover`, l'index Notion et un socle commun entre projets ;
  - le blocage a priori des écritures faites par le shell (voir §5).
- Abandonné : `/atelier:slice`, remplacée par `/atelier:build` (voir `decisions.md`).

## 4. Comportement

### Garde d'écriture
Elle s'applique aux outils `Edit`, `Write`, `MultiEdit` et `NotebookEdit`. Les règles sont évaluées dans cet ordre, et la première qui s'applique décide :
1. **Fichier hors du projet** : autorisé, car atelier ne régit que le projet. Sous Windows, cela vaut aussi pour un fichier situé sur un autre lecteur.
2. **Fichier sensible** (`sensitivePaths`) : toujours refusé, même en débrayage.
3. **État d'atelier** : il ne change que par l'humain ou par la CLI.
   - Tout fichier de `.atelier/**` est refusé.
   - `.claude/atelier.json` peut être créé (c'est ce que fait `/atelier:init`), mais ni modifié ni supprimé.
4. **En-tête de spec** :
   - `status`, `signed_by`, `signed_at`, `done_at` et `tests_commit` ne changent que par la CLI.
   - `tdd` est libre tant que la spec est en `draft`. Ensuite, il ne change que par `atelier set-tdd`, qui ajoute une entrée en amendement.
   - Réécrire entièrement une spec signée est refusé. Les éditions ciblées restent autorisées, avec une entrée datée dans « Amendements ».
5. **Chemins libres** (`freePaths` : `docs/**`, `.claude/**` sauf les fichiers de la règle 3, `CLAUDE.md`, `README.md`, `.gitignore`) : autorisés.
6. **Débrayage actif sur la branche** : autorisé.
7. **Sans chantier signé** : refusé. C'est le cas :
   - d'une branche sans identifiant de chantier (`main`, HEAD détachée) ;
   - d'une spec en `draft`, `done` ou `abandoned`. Un chantier clos rebloque donc le code : il faut en ouvrir un nouveau.
8. **TDD** (seulement si `tdd: yes`) :
   - en phase tests, seuls les fichiers de `testPaths` sont modifiables ;
   - en phase implémentation, ils sont refusés.

Sous Windows, les chemins sont comparés sans tenir compte de la casse.

### Contrôle de fin de tour
1. **Phase tests** : aucun contrôle, puisque des tests rouges sont attendus à ce stade.
2. **Phase implémentation** : si un test figé a été modifié depuis `tests_commit`, y compris par le shell ou par un commit, le tour est bloqué.
3. **Code modifié sans chantier signé** : si du code a été modifié hors des chemins libres, sans débrayage, le tour est bloqué une fois. Ce cas couvre les écritures faites par le shell. Le message demande à l'agent de le signaler à l'utilisateur. Un même état n'est signalé qu'une fois.
4. **Contrôles du projet** (`checks`) : ils ne sont lancés que si deux conditions sont réunies :
   - des fichiers hors des chemins libres, de `chantiersDir` et de `.atelier/` ont des changements non commités ;
   - l'état obtenu diffère du dernier état passé au vert.
5. **Anti-boucle** : si un blocage se répète alors que l'arbre de travail n'a pas changé depuis le blocage précédent, l'agent est bloqué. Le hook le laisse alors s'arrêter et montre l'échec à l'utilisateur. Tant que l'agent fait progresser l'arbre de travail, il continue d'itérer.

L'état du hook (dernier état vert, dernier blocage) est conservé dans `.atelier/`, qui n'est pas versionné.

Toute la logique de décision des hooks se trouve dans `lib/core.mjs`, sous forme de fonctions pures testées. `lib/cli.mjs` se contente de lire, d'exécuter et d'afficher.

### Signature
`atelier sign` renseigne `signed_by` avec `git config user.name`. La CLI ne distingue pas l'humain de l'agent qui la lance. La signature atteste donc un engagement, et non une preuve d'identité. Deux choses la garantissent :
- la consigne du skill, qui exige un « oui » explicite de l'utilisateur ;
- le commit dédié `sign spec`, visible dans l'historique.

## 5. Limites connues
Atelier est un garde-fou contre l'oubli, pas une barrière contre un agent qui chercherait à le contourner. Voici ce qu'un agent peut encore faire :
- écrire par le shell : rien ne l'empêche a priori. Le contrôle de fin de tour le détecte (§4, règles 2 et 3), mais n'annule rien ;
- par le shell également, supprimer `.claude/atelier.json`, écrire `.atelier/bypass.json`, lancer `atelier sign` sans accord, ou désactiver le plugin dans `.claude/settings.json` ;
- écrire une implémentation codée en dur qui passe les tests : seuls `overfit-checker` et la revue peuvent la repérer.

## 6. Impacts indirects
Ce qui change dans un projet qui a lancé `/atelier:init` :
- les outils d'édition ne peuvent plus modifier le code sans chantier signé ;
- les contrôles du projet peuvent être relancés en fin de tour, avec un temps limité par `checkTimeoutSeconds`.

Sans `.claude/atelier.json`, le plugin n'a aucun effet.

## 7. Vérification
- `npm test` est vert et couvre :
  - la garde d'écriture, règle par règle : fichiers protégés de la règle 3, champs d'en-tête de spec, chemin sur un autre lecteur et casse sous Windows, chantier `done`, branche sans identifiant, phases TDD ;
  - l'identifiant suivant, la complétude de la spec et la prochaine étape ;
  - la décision de fin de tour : phase tests sans contrôle, tests figés modifiés, code modifié sans chantier signé et signalé une seule fois, exclusion des chemins libres, saut quand l'état a déjà été vert, anti-boucle.
- `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent sans erreur.
- Un essai de bout en bout de la CLI et des hooks sur un dépôt jetable vérifie :
  - le blocage avant signature ;
  - le refus de signer une spec incomplète ;
  - le refus de réécrire une spec signée ;
  - le refus de modifier l'état d'atelier et les champs d'en-tête ;
  - les contrôles de fin de tour et l'anti-boucle ;
  - le débrayage ;
  - en TDD : implémentation refusée en phase tests, gel refusé tant que les tests ne sont pas commités, fin de tour bloquée si un test figé est modifié par le shell, `set-tdd` tracé en amendement après signature.

  Le résultat de cet essai est consigné dans le bilan.
- Un essai réel sur envo-admin : `/atelier:init`, puis un premier chantier mené jusqu'à `/atelier:close`. La clôture et la fusion de TEC-1 attendent cet essai.

## 8. Retour arrière
- **Désactiver atelier dans un projet** : supprimer `.claude/atelier.json`.
- **Le retirer complètement** :
  - retirer les entrées atelier de `extraKnownMarketplaces` et `enabledPlugins` dans `.claude/settings.json` (sinon le plugin est reproposé à chaque ouverture du projet) ;
  - retirer la section Process du `CLAUDE.md`, la ligne `.atelier/` du `.gitignore` et le dossier `.atelier/` ;
  - désinstaller le plugin.

Dans les deux cas, `docs/chantiers/` et `docs/decisions/` restent comme historique.

## Amendements
- 2026-11-13 : ajout du cycle TDD « write tests, commit; code, iterate, commit » (Anthropic), appliqué par les hooks :
  - phase tests d'abord, où l'implémentation est refusée ;
  - gel des tests à leur commit ;
  - phase implémentation : tests en lecture seule, contrôle de fin de tour qui détecte toute modification des tests ;
  - commande `/atelier:build` et sous-agent `overfit-checker`.
- 2026-11-13 : le TDD est décidé chantier par chantier (`tdd: yes | no`, obligatoire avant signature) au lieu d'être imposé par type. Ce chantier est en `tdd: no`, car les tests ont été écrits en même temps que le code.
