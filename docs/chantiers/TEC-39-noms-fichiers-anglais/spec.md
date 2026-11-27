---
id: TEC-39
type: TEC
title: Noms de fichiers et de dossiers des chantiers en anglais
status: signed
tdd: yes
created_at: 2026-11-27
signed_by: Opack
signed_at: 2026-11-27
rel_depends_on: TEC-37, FEAT-35
---

# TEC-39 Noms de fichiers et de dossiers des chantiers en anglais

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

Les noms de fichiers, de dossiers, la clé de configuration et le scope de commit qu'atelier lit ou écrit passent une fois pour toutes en anglais, et les chantiers existants du dépôt sont migrés. Ces noms sont rassemblés dans une constante exportée de `lib/common.mjs` (le socle, qui porte déjà `DEFAULT_CONFIG`), distincte du vocabulaire traduisible de `lib/vocabulary.mjs` (SB2).

| Aujourd'hui | Demain |
|---|---|
| `docs/chantiers/` | `docs/work-items/` |
| `revue.md` (chantier et template) | `review.md` |
| `bilan.md` (chantier et template) | `report.md` |
| clé `chantiersDir` de `.claude/atelier.json` | `workItemsDir` |
| scope de commit `docs(chantiers)` | `docs(work-items)` |

Inchangés, déjà anglais : `spec.md`, `plan.md`, `decisions.md`, `docs/decisions/`, `decisionsDir`, les templates `spec-*.md`, `plan*.md`, `decisions.md`, `adr.md`, `process.md`, le dossier `.atelier/` et ses fichiers, `.claude/atelier.json`.

Liste fermée des noms de la constante (SB3, SB4) : `spec.md`, `plan.md`, `review.md`, `report.md`, `decisions.md`, `docs/work-items`, `docs/decisions` et le scope `docs(work-items)`. `DEFAULT_CONFIG` prend ses valeurs de dossiers dans cette constante. Les noms de templates n'y figurent pas : ils sont résolus dynamiquement (`${name}.md`) et CA-3 les couvre. Les fichiers internes de `.atelier/` (`gate.json`, `bypass.json`…) n'en font pas partie : ce ne sont pas des documents de chantier.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

EPIC-14 (SD8) fige ces noms dans toutes les langues : ce sont des identifiants que le code lit, pas du texte. Figés en français, un projet en anglais aurait des `revue.md` et des `bilan.md` dans un dossier `chantiers/` pour toujours. Les renommer après le lot 4 d'EPIC-14 (langues), une fois des projets tiers outillés, imposerait une migration à chacun ; aujourd'hui, seul ce dépôt est concerné.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- **Code** (`plugins/atelier/lib/`) : la constante des noms fixes dans `lib/common.mjs`, importée partout où ces noms sont lus ou écrits aujourd'hui en dur, messages destinés à l'utilisateur compris ; `DEFAULT_CONFIG` passe à `workItemsDir: 'docs/work-items'`. `bin/`, `hooks/`, `scripts/`, `.github/` et `site/.vitepress/config.mjs` ne citent aucun de ces noms aujourd'hui (SD9).
- **Templates** : `revue.md` → `review.md`, `bilan.md` → `report.md` ; `atelier template review` et `atelier template report`.
- **Skills, agents, CLAUDE.md, README.md** : chemins, noms de fichiers, commandes `atelier template …` et scope de commit cités (SD9).
- **Tests** (`plugins/atelier/test/`) : fixtures et assertions aux nouveaux noms.
- **Migration du dépôt** : `git mv` de tous les chantiers de `docs/chantiers/` vers `docs/work-items/`, et de leurs `revue.md` / `bilan.md` ; `.claude/atelier.json` passe à `workItemsDir`. Le texte des chantiers clos n'est pas réécrit (trace historique). Seule exception : la spec et le plan d'EPIC-14, qui citent ces noms comme règles en vigueur (SD8 et commentaires de template), mis à jour avec une entrée datée dans la section « Amendements » de sa spec (SD14). Le `decisions.md` d'EPIC-17 est un journal : il n'est pas touché.
- **Site** (`site/`) : pages qui citent ces noms (configuration, templates, commandes, glossaire, cycle, installation…) ; la page Référence > Templates inclut les templates renommés ; la rupture est documentée dans les pages Configuration et Installation (« mise à jour depuis 0.8 »), avec : le `git mv` de `docs/chantiers/` et des `revue.md` / `bilan.md`, la clé `workItemsDir` (une clé `chantiersDir` restante est ignorée sans message), la ligne « Process (atelier) » du `CLAUDE.md` du projet à remplacer à la main (`/atelier:init` ajoute sans retirer) et le nouveau scope de commit (SD20). Les noms des pages du site (`cycle/revue.md`, `agent/revue.md`, `cycle/cloture.md`…) restent en français, comme le site (SD16).
- **Version** du plugin : `0.9.0` (rupture pour tout projet existant), montée dans la dernière tranche (SD17).
- **Recensement** refait après la fusion de FEAT-35 et de TEC-37 dans la branche, avant l'écriture des tests (SD13).

**Déroulé** (SB1). Le plugin actif des sessions est celui de `main` : après la migration, il cherche encore les chantiers dans `docs/chantiers/` et ne trouve plus TEC-39 ; l'agent ne peut pas modifier `.claude/atelier.json` (garde d'écriture) ; une revue enregistrée avant le déplacement de la spec devient obsolète. D'où l'ordre :
1. code et tests (TDD), sur des dépôts de test jetables, le dépôt lui-même restant sous les anciens noms ;
2. skills, agents, templates, CLAUDE.md, README et site ;
3. en dernier, un seul commit de migration : `git mv` des chantiers (TEC-39 compris, dont les fichiers s'appellent alors `review.md` et `report.md`), `.claude/atelier.json` (modifié par l'utilisateur), l'amendement d'EPIC-14 et la ligne de la section « Process (atelier) » du `CLAUDE.md` du dépôt, pour que les sessions ne cherchent pas les chantiers dans `docs/work-items/` avant qu'ils y soient (SD19) ;
4. revue du chantier et clôture après ce commit, avec la CLI de la branche (`node plugins/atelier/bin/atelier` ou `claude --plugin-dir ./plugins/atelier`) ; jusqu'à la fusion, toute écriture de code passe par le débrayage (`/atelier:off`), le plugin de `main` ne voyant plus le chantier.

Hors périmètre :
- Les identifiants du code (`chantier`, `chantiersRoot`…) : renommage interne sans effet visible, objet d'un REF séparé sous EPIC-17, après TEC-39.
- Le mot « chantier » dans les textes français (skills, messages, site) : il relève de la langue de l'utilisateur (EPIC-14, lots 5 et 6).
- Le rangement par centaine des chantiers (TEC à ouvrir après FEAT-35) : il partira directement de `docs/work-items/`.
- Une lecture des anciens noms en repli, une commande de migration pour d'autres projets, ou la détection d'une configuration qui porte encore `chantiersDir` (ignorée sans message) : aucun autre projet n'utilise atelier aujourd'hui (SD11 écarté).

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

- **Rupture** : un projet dont la configuration porte `chantiersDir`, ou dont les chantiers sont dans `docs/chantiers/`, n'est plus lu tel quel après la mise à jour du plugin. Code et migration du dépôt arrivent dans la même PR.
- **Branches ouvertes** : toute branche de chantier ouverte au moment de la fusion aura des conflits de renommage, et ses chantiers disparaissent de l'index des autres branches (relations, `atelier list`) tant qu'elle n'a pas migré. D'où `rel_depends_on: TEC-37, FEAT-35` : le chantier ne passe aux tests qu'une fois les deux fusionnés. Toute autre branche encore ouverte à la fusion (aujourd'hui `spike/SPIKE-38-essai-bandeau`) fusionne `main` et déplace son dossier par `git mv`, ou est close avant : fusionnée telle quelle, elle recréerait `docs/chantiers/` (SD15).
- **Critères** : après la fusion de TEC-37 dans la branche, les critères de cette spec passent de `CA-n` à `AC-n` par un amendement mécanique (SD13).
- Liens d'historique : `git log --follow` reste nécessaire pour suivre un fichier de chantier d'avant la migration.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- CA-1 : Étant donné un projet dont la configuration déclare `workItemsDir`, quand atelier cherche le chantier actif (`atelier status`), calcule le prochain identifiant (`atelier next-id`), liste ou retrouve les chantiers (`atelier list`, `path`, `open`), lit les chantiers des autres branches pour les relations, ou garde une écriture de spec, alors il lit le dossier déclaré ; avec une configuration sans `workItemsDir`, il lit `docs/work-items/` (SD10).
- CA-2 : Étant donné un chantier dont la revue est dans `review.md`, quand on lance `atelier close-check`, `atelier review-ids` ou `atelier status`, alors la revue est lue depuis `review.md` ; un `revue.md` présent à côté est ignoré.
- CA-3 : Étant donné le plugin installé, quand on lance `atelier template review` et `atelier template report`, alors les templates sont renvoyés ; `atelier template revue` et `atelier template bilan` échouent comme un template inconnu.
- CA-4 : Étant donné le code de `lib/`, quand le test d'architecture s'exécute, alors aucun nom de la liste fermée (§1) n'apparaît dans une chaîne, un gabarit ou une expression régulière hors de sa constante dans `lib/common.mjs`. Une occurrence est le nom, ni précédé ni suivi d'une lettre, d'un chiffre, de `_`, de `-` ou de `.`, n'importe où dans le littéral (messages compris) : `spec.md` ne capture ni `spec.mjs` ni `spec-feat.md`. Les commentaires ne comptent pas (SB3, SB4).
- CA-5 : Étant donné le dépôt, quand on cherche les anciens noms (`revue.md`, `bilan.md`, `docs/chantiers`, `chantiersDir`, `docs(chantiers)`, `template revue`, `template bilan`) dans `plugins/atelier/` (`lib/`, `bin/`, `hooks/`, `skills/`, `agents/`, `templates/`), `README.md`, `CLAUDE.md` et `.claude/atelier.json`, alors on n'en trouve aucun (SD9).
- CA-6 : Étant donné le commit de migration, quand on compare avant (CLI de `main` sur le commit parent) et après (CLI de la branche, `node plugins/atelier/bin/atelier`, sur le commit de migration) (SD18), alors la liste des identifiants de chantiers est la même, la sortie de `atelier check-spec` est la même pour chaque spec, aucun dossier `docs/chantiers/` ne subsiste, et `git diff -M --summary` ne montre que des renommages à 100 %, hormis la spec et le plan d'EPIC-14, `.claude/atelier.json` et `CLAUDE.md` (SD12, SD19).
- CA-7 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit, et une recherche des anciens noms dans `site/` (hors `node_modules` et `.vitepress/dist`) ne trouve que la description de la migration dans les pages Configuration et Installation (SD16).
- CA-8 : `plugins/atelier/.claude-plugin/plugin.json` porte la version `0.9.0` ; `npm test`, `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent (SD17).

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

Revert de la PR : code, templates et migration du dépôt sont dans le même commit de fusion, le revert les rend ensemble. Un chantier ouvert dans `docs/work-items/` après la fusion devrait être déplacé à la main dans `docs/chantiers/`, ses `review.md` et `report.md` renommés en `revue.md` et `bilan.md` (SD17).

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
