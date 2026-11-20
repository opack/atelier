# Règles, mémoire et décisions

Le `CLAUDE.md` ne peut pas tout porter. Le reste du contexte se range selon sa portée et sa durée de vie.

## Où ranger quoi

| Contenu | Où | Partagé | Exemple |
|---|---|---|---|
| Règles du projet | `CLAUDE.md`, `.claude/rules/` | Oui (git) | Conventions, interdits, commandes |
| Piège durable | `.claude/memory/` (versionné) | Oui | « Le warning AudioContext est connu, ne pas refactorer » |
| Historique d’un chantier | `docs/chantiers/<ID>/` | Oui | Spec, décisions, bilan |
| Décision d’architecture | `docs/decisions/NNN-titre.md` | Oui | Choix d’une bibliothèque |
| Préférences personnelles | `CLAUDE.local.md`, mémoire utilisateur | Non | Shell préféré |

**Règle** : tout ce qui profite à un coéquipier va dans le dépôt, jamais dans une mémoire personnelle.

## Les règles par dossier : `.claude/rules/`

Un fichier court par sujet, chargé **seulement** quand Claude travaille sur les chemins concernés :

```markdown
---
paths:
  - "src/**/*.test.ts"
  - "tests/**"
---
# Tests
- Un test par critère d’acceptation, qui cite son identifiant.
- Pas de mock de la couche testée.
```

Exemples utiles : `testing.md`, `security.md`, `database.md`, `a11y-ui.md`. Cinq à quinze lignes, impératives et vérifiables. Une règle qu’un linter peut appliquer va dans la configuration du linter, pas ici.

N’en créez que si vous en avez besoin.

## La mémoire

Une note de mémoire = **un fait + le pourquoi + comment l’appliquer**. Pas de note qui décrit l’état du code : elle se périme dès le prochain commit.

Faites le ménage à la clôture d’un chantier : ce qui relevait du chantier va dans son bilan, pas dans la mémoire.

## Les ADR

Un ADR (Architecture Decision Record) consigne une décision qui dépasse un chantier, en dix lignes : contexte, décision, alternatives rejetées, conséquences. Il cite le chantier d’origine. On ne le modifie pas : une nouvelle décision le remplace par un nouvel ADR.
