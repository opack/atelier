# La trace : dossier de chantier

Chaque chantier laisse une trace dans le dépôt, à côté du code qu’il a produit.

```text
docs/chantiers/FEAT-27-total-enveloppes/
  spec.md        l’intention signée
  plan.md        la conception, les tranches
  decisions.md   le journal tenu pendant le chantier
  revue.md       les revues, par tranche puis du chantier : points et leur traitement
  bilan.md       la synthèse finale et le verdict de revue
```

| Fichier | Quand | Pour qui | Types |
|---|---|---|---|
| `spec.md` | Avant le code | L’agent et le relecteur | Tous |
| `plan.md` | Après signature | L’agent, pendant l’implémentation | FEAT, REF, gros TEC |
| `decisions.md` | Pendant | Vous, plus tard | Tous, si décisions |
| `revue.md` | À la revue | Vous, le relecteur suivant | Tous, sauf SPIKE sans revue |
| `bilan.md` | À la clôture | Le prochain qui touchera ce code | Tous |

## Journal ou bilan ?

Les deux ne font pas doublon :

- `decisions.md` s’écrit **pendant**, au moment où la décision est prise. Une entrée courte, brute, datée : la décision, l’option écartée, la raison.
- `bilan.md` s’écrit **à la fin**, se lit seul, et s’appuie sur le journal et le diff. C’est lui qui sert d’historique.

## Et les décisions qui dépassent le chantier ?

Un choix de bibliothèque, une convention, une décision d’architecture remontent en **ADR** (Architecture Decision Record) dans `docs/decisions/`. Le chantier d’origine y est cité.

## Pourquoi dans le dépôt ?

- La trace est **versionnée avec le code** : on retrouve la spec qui a justifié une ligne avec `git log`.
- Elle **survit aux outils** : ni Notion, ni Jira, ni le plugin ne sont nécessaires pour la lire.
- L’agent la **lit naturellement** quand il retravaille sur une zone.

Vous pouvez réfléchir ailleurs (Notion, papier) : le brouillon s’importe dans `spec.md` au moment d’ouvrir le chantier.
