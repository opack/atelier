---
id: TEC-39
type: TEC
title: Noms de fichiers et de dossiers des chantiers en anglais
status: draft
tdd: yes
created_at: 2026-11-27
signed_by:
signed_at:
rel_depends_on: TEC-37, FEAT-35
---

# TEC-39 Noms de fichiers et de dossiers des chantiers en anglais

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

Les noms de fichiers, de dossiers, la clé de configuration et le scope de commit qu'atelier lit ou écrit passent une fois pour toutes en anglais, et les chantiers existants du dépôt sont migrés. Ces noms sont rassemblés en un seul endroit du code, distinct du vocabulaire traduisible.

| Aujourd'hui | Demain |
|---|---|
| `docs/chantiers/` | `docs/work-items/` |
| `revue.md` (chantier et template) | `review.md` |
| `bilan.md` (chantier et template) | `report.md` |
| clé `chantiersDir` de `.claude/atelier.json` | `workItemsDir` |
| scope de commit `docs(chantiers)` | `docs(work-items)` |

Inchangés, déjà anglais : `spec.md`, `plan.md`, `decisions.md`, `docs/decisions/`, `decisionsDir`, les templates `spec-*.md`, `plan*.md`, `adr.md`, `process.md`, le dossier `.atelier/` et ses fichiers, `.claude/atelier.json`.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

EPIC-14 (SD8) fige ces noms dans toutes les langues : ce sont des identifiants que le code lit, pas du texte. Figés en français, un projet en anglais aurait des `revue.md` et des `bilan.md` dans un dossier `chantiers/` pour toujours. Les renommer après le lot 4 d'EPIC-14 (langues), une fois des projets tiers outillés, imposerait une migration à chacun ; aujourd'hui, seul ce dépôt est concerné.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- **Code** (`plugins/atelier/lib/`, `bin/`, `hooks/`) : un module de noms fixes (fichiers, dossiers, clé de configuration, scope de commit), importé partout où ces noms sont lus ou écrits aujourd'hui en dur ; `DEFAULT_CONFIG` passe à `workItemsDir: 'docs/work-items'`.
- **Templates** : `revue.md` → `review.md`, `bilan.md` → `report.md` ; `atelier template review` et `atelier template report`.
- **Skills, agents, CLAUDE.md, README.md** : chemins, noms de fichiers et scope de commit cités.
- **Tests** (`plugins/atelier/test/`) : fixtures et assertions aux nouveaux noms.
- **Migration du dépôt** : `git mv` de tous les chantiers de `docs/chantiers/` vers `docs/work-items/`, et de leurs `revue.md` / `bilan.md` ; `.claude/atelier.json` passe à `workItemsDir`. Le texte des chantiers clos n'est pas réécrit (trace historique), sauf les specs et plans des EPIC ouverts (EPIC-14, EPIC-17), qui citent ces noms comme règles en vigueur, notamment SD8.
- **Site** (`site/`) : pages qui citent ces noms (configuration, templates, commandes, glossaire, cycle, installation…) ; la page Référence > Templates inclut les templates renommés.
- **Version** du plugin montée (rupture pour tout projet existant).

Hors périmètre :
- Les identifiants du code (`chantier`, `chantiersRoot`…) : renommage interne sans effet visible, à faire dans un REF à part s'il est voulu.
- Le mot « chantier » dans les textes français (skills, messages, site) : il relève de la langue de l'utilisateur (EPIC-14, lots 5 et 6).
- Le rangement par centaine des chantiers (TEC à ouvrir après FEAT-35) : il partira directement de `docs/work-items/`.
- Une lecture des anciens noms en repli, ou une commande de migration pour d'autres projets : aucun autre projet n'utilise atelier aujourd'hui.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

- **Rupture** : un projet dont la configuration porte `chantiersDir`, ou dont les chantiers sont dans `docs/chantiers/`, n'est plus lu tel quel après la mise à jour du plugin. Le plugin actif des sessions de ce dépôt étant celui de `main`, la migration du dépôt et le code doivent arriver dans la même PR.
- **Branches ouvertes** : toute branche de chantier ouverte au moment de la fusion aura des conflits de renommage. D'où `rel_depends_on: TEC-37, FEAT-35` : le chantier ne passe aux tests qu'une fois les deux fusionnés.
- Liens d'historique : `git log --follow` reste nécessaire pour suivre un fichier de chantier d'avant la migration.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- CA-1 : Étant donné un projet dont la configuration déclare `workItemsDir`, quand atelier cherche le chantier actif, liste les chantiers ou garde une écriture de spec, alors il lit le dossier déclaré ; sans configuration, il lit `docs/work-items/`.
- CA-2 : Étant donné un chantier dont la revue est dans `review.md`, quand on lance `atelier close-check`, `atelier review-ids` ou `atelier status`, alors la revue est lue depuis `review.md` ; un `revue.md` présent à côté est ignoré.
- CA-3 : Étant donné le plugin installé, quand on lance `atelier template review` et `atelier template report`, alors les templates sont renvoyés ; `atelier template revue` et `atelier template bilan` échouent comme un template inconnu.
- CA-4 : Étant donné le code de `lib/`, `bin/` et `hooks/`, quand le test d'architecture s'exécute, alors aucun des noms fixes (`review.md`, `report.md`, `decisions.md`, `spec.md`, `plan.md`, `docs/work-items`, `docs/decisions`, `docs(work-items)`) n'apparaît en dur hors du module des noms fixes, et aucun des anciens noms (`revue.md`, `bilan.md`, `docs/chantiers`, `chantiersDir`, `docs(chantiers)`) n'apparaît nulle part dans `lib/`, `bin/`, `hooks/`, `skills/`, `agents/` et `templates/`.
- CA-5 : Étant donné le dépôt migré, quand on lance `atelier status` et `atelier check-spec` sur chaque spec de `docs/work-items/`, alors tous les chantiers sont trouvés et aucun dossier `docs/chantiers/` ne subsiste.
- CA-6 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit et aucune page ne cite les anciens noms, sauf pour décrire la migration (notes de version).
- CA-7 : `npm test`, `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

Revert de la PR : code, templates et migration du dépôt sont dans le même commit de fusion, le revert les rend ensemble.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
