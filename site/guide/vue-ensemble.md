# Vue d’ensemble du cycle

## Une fois par projet

[Installer atelier](../projet/installation) et écrire un [CLAUDE.md](../projet/claude-md) utile. C’est le socle sur lequel chaque chantier s’appuie.

## À chaque chantier

```text
 1. Intention      spec.md            ◀── questions sur les manques
 2. Signature      status: signed     ◀── relecture critique + décision humaine
 3. Conception     plan.md            ◀── FEAT, REF, gros chantiers
 4. Tests d’abord  tests commités     ◀── si tdd: yes
 5. Implémentation un commit/tranche  ◀── contrôles automatiques
 6. Clôture        bilan.md, PR       ◀── revue indépendante + verdict humain
```

| Étape | Vous | L’agent | Ce qui la garantit |
|---|---|---|---|
| [Intention](../cycle/intention) | Décidez du périmètre et du TDD | Rédige, questionne les manques | Contrôle de complétude |
| [Signature](../cycle/signature) | Signez | Prépare, relit de façon critique | Hook : pas de code avant |
| [Conception](../cycle/conception) | Challengez, validez | Propose approche et tranches | Votre validation |
| [Tests d’abord](../cycle/tests) | Relisez les tests | Écrit les tests, les fait échouer | Hook : seuls les tests sont modifiables |
| [Implémentation](../cycle/implementation) | Validez chaque tranche | Code jusqu’au vert | Hooks : tests figés, contrôles verts |
| [Clôture](../cycle/cloture) | Rendez le verdict | Revue, bilan | Checklist, votre verdict |

## Les portes

Chaque passage d’étape a une **porte** :

- une **porte automatique** quand une machine peut vérifier (spec complète, tests rouges, contrôles verts) ;
- une **porte humaine** quand le jugement ne se délègue pas (signature, plan, verdict).

C’est la règle centrale : **les hooks font les contrôles, les commandes portent les décisions humaines.** Jamais l’inverse.

## Les variantes

Tous les chantiers ne prennent pas toutes les étapes :

| Type | Étapes |
|---|---|
| `FEAT` | 1 → 2 → 3 → (4 si TDD) → 5 → 6 |
| `FIX` | 1 → 2 → (4 si TDD) → 5 → 6, en [voie rapide](../cycle/correction) |
| `REF` | 1 → 2 → 3 → (4 : tests de caractérisation si TDD) → 5 → 6 |
| `TEC` | 1 → 2 → 5 → 6, spec de trois lignes pour une petite tâche |
| `SPIKE` | 1 → 2 → exploration → 6, rien n’est fusionné |

Détail dans [Types de chantier](../fondations/types).
