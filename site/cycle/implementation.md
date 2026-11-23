# 5. Implémentation

**Objectif** : écrire le code qui satisfait la spec, tranche par tranche, avec des contrôles que l’agent ne peut pas ignorer.

## Avec atelier

```text
/atelier:build
```

atelier travaille sur la **tranche en cours** (`/atelier:status` l’indique : « Tranche 2/3 »). Pour un `SPIKE` sans TDD, hors du découpage en tranches, on peut nommer la tranche : `/atelier:build <tranche>`.

## En TDD : les tests sont figés

1. **Ne pas modifier les tests.** Le hook refuse toute écriture dans un fichier de test. Le contrôle de fin détecte aussi un test modifié par une commande shell ou un commit.
2. **Itérer jusqu’au vert.** L’agent code, lance les tests, corrige, recommence, sans vous solliciter à chaque tour. Tant qu’un contrôle échoue, le hook de fin le renvoie au travail.
3. **Vérifier le surapprentissage.** Une fois tout au vert, le sous-agent `overfit-checker` vérifie que le code résout **le problème de la spec**, pas seulement **les cas des tests** : valeurs codées en dur, cas particuliers, entrées hors des tests. Ses points sont numérotés `OB1`… (bloquants), `OD1`… (à discuter), en continu sur tout le chantier (`atelier review-ids`) ; un point reporté, accepté ou écarté pour une raison qui compte est cité dans `decisions.md`.
4. **Valider, puis commiter** : l’agent résume la tranche et attend votre accord avant de commiter.

::: warning La limite du TDD
`sum = () => 5` fait passer `assert.equal(sum(2, 3), 5)`. Aucun hook ne peut le détecter : c’est le rôle d’`overfit-checker` et de la revue.
:::

Si un test semble faux, l’agent **s’arrête et vous l’explique**. À vous de décider de le rouvrir (`/atelier:write-tests <raison>`), ou d’[amender la spec](./amendement) si c’est elle qui est fausse.

Quand on corrige un point de revue, le commit le cite après l’identifiant du chantier (`fix(plugin): [TEC-15] RB2 …`).

Quand la tranche est commitée, place à sa [revue](./revue). C’est la validation de cette revue qui fait passer à la tranche suivante.

## Sans TDD

1. L’agent implémente la tranche selon la spec et le plan.
2. Il ajoute des tests **là où ils ont de la valeur** : logique non triviale, cas limite fragile.
3. Il itère jusqu’à ce que les contrôles soient verts.
4. Il résume, vous validez, il commite.

## Les contrôles automatiques

Avant que l’agent ne rende la main, le hook de fin lance les contrôles de `.claude/atelier.json` (types, lint, tests) si du code a changé hors des chemins libres. Rouge : l’agent continue.

- Un état déjà passé au vert n’est pas recontrôlé.
- **Anti-boucle** : si l’agent bute sans rien changer, il est autorisé à s’arrêter, et l’échec vous est montré une fois. Un état connu comme rouge n’est pas recontrôlé.
- Du code modifié par le shell sans chantier signé est signalé, une fois par état de l’arbre de travail.

C’est ce qui remplace « je relance les tests moi-même plutôt que de croire le compte rendu de l’agent ». Gardez tout de même la CI comme dernière barrière : atelier est un garde-fou, pas une barrière ([Garanties et limites](../reference/limites)).

## Le journal en cours de route

Une décision prise pendant l’implémentation (un choix de structure, une option écartée) va dans `decisions.md`, au moment où elle est prise. C’est ce qui alimentera le bilan.

## Les zones à relire ligne à ligne

Paiement et abonnements, concurrence et transactions, règles de sécurité, authentification **et autorisation**, migrations de données, secrets. Sur ces zones, gardez l’agent en validation manuelle et relisez tout.
