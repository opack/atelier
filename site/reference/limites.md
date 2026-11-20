# Garanties et limites

atelier est un **garde-fou contre l’oubli, pas une barrière**. Il empêche de sauter une étape par inadvertance ; il n’empêche pas un agent (ou un humain) décidé à la contourner.

## Ce qu’atelier garantit

- Les **outils d’édition** de l’agent ne peuvent pas écrire de code sans chantier signé, modifier des tests figés, écrire dans l’état d’atelier ou modifier les champs réservés de la spec. Voir [Garde d’écriture](./configuration#garde-d-ecriture).
- Le **contrôle de fin de tour** repère, après coup, ce qui a échappé à la garde : du code modifié sans chantier signé, un test figé modifié, des contrôles rouges.
- La **trace** (spec, décisions, bilan, commits identifiés) reste dans git, quoi qu’il arrive au plugin.

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
