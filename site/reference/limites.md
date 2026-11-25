# Garanties et limites

atelier est un **garde-fou contre l’oubli, pas une barrière**. Il empêche de sauter une étape par inadvertance ; il n’empêche pas un agent (ou un humain) décidé à la contourner.

## Ce qu’atelier garantit

- Les **outils d’édition** de l’agent ne peuvent pas écrire de code sans chantier signé, modifier des tests figés, écrire dans l’état d’atelier, modifier les champs réservés de la spec, ni modifier une spec signée sans trace datée dans « Amendements ». Voir [Garde d’écriture](./configuration#garde-d-ecriture).
- Le **contrôle de fin de tour** repère, après coup, ce qui a échappé à la garde : du code modifié sans chantier signé, un test figé modifié, des contrôles rouges.
- La **clôture** refuse un chantier dont du code a changé depuis la revue (commit, fusion, rebase), ou dont la spec a été amendée depuis.
- Les **contrôles** ne sont pas relancés sur un état du code déjà vert : `atelier checks`, `close-check`, `set-status done` et le contrôle de fin de tour partagent ce résultat. L’état est une empreinte git de l’arbre de travail : un changement limité à un fichier ignoré, à la version de Node ou à l’environnement n’est pas vu, y compris à la clôture. `atelier checks --force` relance.
- La **trace** (spec, décisions, revue, bilan, commits identifiés) reste dans git, quoi qu’il arrive au plugin.

## Ce qu’atelier ne garantit pas

### Les écritures par le shell

Une commande shell (`sed`, `echo >`, un script) n’est pas interceptée au moment où elle s’exécute. Elle n’est détectée **qu’en fin de tour**, et **rien n’est annulé** : l’agent doit vous le signaler, et c’est à vous de décider.

Par le shell, un agent peut aussi :

- supprimer `.claude/atelier.json`, ce qui désactive les hooks ;
- écrire le débrayage dans `.atelier/bypass.json` ;
- lancer `atelier sign` sans votre accord.

### La configuration de Claude Code

`.claude/settings.json` et `.claude/settings.local.json` restent modifiables : `/atelier:init` y déclare le plugin, et ils portent aussi les réglages propres au projet. On peut donc y désactiver le plugin ou ses hooks.

### L’identité du signataire

`atelier sign` renseigne `signed_by` avec `git config user.name`. La commande ne distingue pas l’humain de l’agent qui la lance. **La signature atteste un engagement, pas une identité.** Ce qui la garantit :

- la consigne de `/atelier:sign`, qui exige votre « oui » explicite ;
- le commit dédié `sign spec`, visible dans l’historique et dans la PR.

### Le contenu d’un amendement

Le hook vérifie qu’une modification de spec signée laisse une entrée datée, pas que l’entrée décrit bien la modification. C’est votre nouvel accord, et le commit `amend spec`, qui en jugent. Comme pour `atelier sign`, la commande ne distingue pas l’humain de l’agent qui valide.

### Une signature faite par erreur

Une spec signée ne repasse jamais en brouillon : sinon, il suffirait de la repasser en brouillon pour la modifier librement, puis de la re-signer. Une signature faite par erreur se traite en abandonnant le chantier (`atelier set-status abandoned`), puis en ouvrant un nouveau chantier.

### La version de git

La détection du code du chantier (revue obsolète, tranche vide, prochaine étape) ignore le code que la branche par défaut apporte par une fusion : seule compte la résolution de la fusion. Ce calcul utilise `git log --diff-merges=remerge`, qui demande git 2.36 ou plus récent. Avec un git plus ancien, sans référence connue de la branche par défaut, ou quand la branche par défaut contient déjà des commits du chantier depuis le début (branche courante = branche par défaut, branche déjà fusionnée dans `main`, fusion de `main` en avance rapide), atelier revient au calcul précédent (git 2.31 ou plus récent) : une fusion de la branche par défaut compte alors comme du code du chantier, et rend la revue obsolète.

Ce calcul suppose que la PR du chantier n’est pas fusionnée avant la clôture (voir [Clôture](../cycle/cloture)). Si elle l’est, puis que la branche reçoit par un `git pull` du code commité après la revue depuis un autre poste, ce code peut échapper au contrôle de la revue obsolète.

Seule la branche par défaut (`origin/main` et `main`, par exemple) est ignorée : le code apporté par une autre branche d’intégration (`develop`, `upstream/main` d’un fork) compte comme du code du chantier.

### Le chantier déduit des commits

Sur une branche dont le nom ne porte pas d’identifiant, le chantier actif vient du commit `[<ID>]` le plus récent propre à la branche (voir [Le chantier actif](../fondations/chantier#le-chantier-actif)). Ce choix a des limites :

- **Fusion par squash ou rebase** : les commits d’origine restent propres à la branche. Si la session continue sur la même branche imposée, l’ancien chantier (clos) reste actif jusqu’au prochain commit `[<ID>]`.
- **Branches longues** (`develop`, `release/*`) : elles contiennent les commits des chantiers déjà fusionnés ; le chantier déduit est le dernier fusionné, souvent clos. L’écriture reste bloquée, mais le motif affiché est « clos » plutôt que « aucun chantier ».
- **Référence distante périmée** : si `origin/main` n’a pas été rafraîchi (`git fetch`) alors que la branche part d’un `main` plus récent, les commits de chantiers déjà fusionnés comptent comme propres à la branche. Même effet que pour les branches longues.
- **Plusieurs chantiers sur une même branche imposée** : le plus récent gagne, et une seule PR mêle deux chantiers. Ouvrez plutôt une session (donc une branche) par chantier.
- **Identifiant présent par hasard dans un nom de branche imposé** (`users/bob/fix-12-crash`, `claude/spike-2-…`) : le nom est lu comme portant `FIX-12` ou `SPIKE-2`, et il l’emporte sur les commits. `/atelier:new` crée alors une branche `<type>/<ID>-<slug>` au lieu de proposer de rester sur la branche imposée.
- **Branche créée depuis une branche de chantier non fusionnée** : sans commit propre, elle hérite du chantier de sa branche parente.

### Les arguments sous PowerShell et cmd

Sous Windows, PowerShell et cmd lancent `atelier` par son lanceur `bin/atelier.cmd`, qui transmet les arguments à Node par l’intermédiaire de cmd. Comme pour tout lanceur `.cmd` (ceux de npm compris), cmd réinterprète au passage :

- `&`, `|`, `<`, `>` et `^` hors guillemets ;
- les variables `%NOM%`.

Une raison libre (`atelier bypass on`, `atelier set-tdd no`, `atelier reopen-tests`) qui contient ces caractères peut donc être tronquée. Écrivez-la sans eux, ou lancez la commande depuis Git Bash. Dans cmd, écrire le nom de la commande entre guillemets (`"atelier" status`) peut aussi faire chercher le script au mauvais endroit : écrivez `atelier status`.

### Le modèle et l’effort annoncés

Quand les variables d’environnement `CLAUDE_CODE_EFFORT_LEVEL` ou `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` sont définies, elles l’emportent sur la résolution d’atelier : le modèle ou l’effort annoncé par la commande n’est alors pas celui utilisé.

Un modèle non disponible pour votre organisation fait échouer l’appel : la commande s’arrête et indique quoi changer (l’argument ou l’option).

### La qualité de l’implémentation

En TDD, une implémentation codée en dur passe les tests :

```js
// Test : assert.equal(sum(2, 3), 5)
export const sum = () => 5
```

Aucun hook ne peut le repérer. C’est le rôle du sous-agent `overfit-checker` et de la revue.

## En pratique

- Relisez l’historique des commits de chaque PR : un commit `sign spec` que vous n’avez pas fait, un `Atelier-Bypass` inattendu ou une configuration supprimée se voient.
- Gardez la **CI** comme dernière barrière : elle relance les contrôles hors de portée de l’agent.
- En environnement sensible, limitez aussi les **permissions** de l’agent (commandes shell autorisées, accès réseau, secrets) : c’est le rôle de Claude Code, pas d’atelier.
