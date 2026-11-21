# Revue : FEAT-4 Relations entre chantiers et type EPIC

<!-- Écrit par /atelier:review : un tour de revue par section, le plus récent en dernier.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Tour 1 : 2026-11-21
- Commit revu : b4377e7
- Base : 8309779

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| B1. Le rappel de démarrage change de comportement (relations, étape d'un EPIC, `catch` sur erreur git) sans test, contre la règle du `CLAUDE.md` sur les hooks | `plugins/atelier/lib/cli.mjs` (`hookSessionStart`) | Test ajouté après réouverture des tests (99382a0, gel ce3832a) : rappel d'un EPIC, enfants et prochaine étape. Le `catch` est retiré (6f70699) : aucune erreur git n'a pu être provoquée (objet manquant ou corrompu → « missing », code 0), code de repli non testable ; voir decisions.md. |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Si le `catch` se déclenche, l'étape d'un EPIC dit « aucun enfant » | `cli.mjs` (`hookSessionStart`) | Sans objet : `catch` retiré (6f70699). |
| D2. Le plan disait que le rappel de démarrage ne paierait rien ; il construit l'index (~170 ms) pour un EPIC ou un chantier à `rel_*` | `cli.mjs` | Écart consigné dans decisions.md (6f70699). |
| D3. `check-process` signale à tort la ligne `docs/chantiers` d'un projet à autre `chantiersDir` | `templates/process.md`, `cli.mjs` | Corrigé (6f70699) : le template est comparé avec le `chantiersDir` du projet ; `init` écrit la ligne adaptée. Vérifié à la main (`work/chantiers`). |
| D4. CA-13 : build du site non démontré par les tests | `site/` | `npm run build` lancé sur 6f70699 : réussi ; pages vérifiées pendant le build (six types, spec-epic, plan-epic, process inclus). |
| D5. L'abandon d'un EPIC échoue si la liste des enfants échoue | `cli.mjs` (`commandSetStatus`) | Écarté : même cas d'erreur git non provoquable que B1 ; voir decisions.md. |
| D6. Un seul commit d'implémentation au lieu des tranches du plan | — | Consigné dans decisions.md ; défaut de méthode à traiter dans un chantier à part (tests figés tranche par tranche). |

- Bilan du tour : un bloquant traité (test ajouté, `catch` retiré), cinq points traités ou écartés avec raison.

## Tour 2 : 2026-11-21
- Commit revu : 6f70699
- Base : 8309779

### Bloquant
Aucun. Corrections du tour 1 vérifiées (test du hook de démarrage, retrait du `catch`, `check-process` avec `chantiersDir`, skill `init`).

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| 1. La règle `docs/chantiers` → `chantiersDir` de `check-process` est dans `cli.mjs`, sans test ; un `chantiersDir` à `/` final donne `//` | `plugins/atelier/lib/cli.mjs` (`commandCheckProcess`) | Spec amendée (CA-12, 6ab0d67), test ajouté (76ad521) ; règle à déplacer dans `core.mjs` (build à venir). |
| 2. `nextStep` propose `/atelier:close` quand tous les enfants d'un EPIC sont clos sans aucun `done`, clôture qui serait refusée | `plugins/atelier/lib/core.mjs` (`nextStep`) | Spec amendée (CA-10, 6ab0d67), test ajouté (76ad521) ; proposer l'abandon (build à venir). |
| 3. Le refus d'écriture sur un EPIC cite « chemins libres (docs/…) » en dur alors que `freePaths` est configurable | `plugins/atelier/lib/core.mjs` (`decideWrite`) | À corriger au build (message sans exemple en dur) ; cosmétique, couvert par le test CA-8 existant. |
| Hors périmètre : dates de la CLI en UTC (`today()`), comportement antérieur à FEAT-4 | `plugins/atelier/lib/cli.mjs` | Chantier à part. |

- Bilan du tour : zéro bloquant ; les trois points sont réglés dans ce chantier (amendement, tests regelés 76ad521, build).

## Tour 3 : 2026-11-21
- Commit revu : f1f22db
- Base : 8309779

### Bloquant
Aucun. Corrections du tour 2 vérifiées : abandon proposé par `nextStep` quand aucun enfant n'est `done` (`core.mjs:873`, CA-10), règle `chantiersDir` de `check-process` dans `checkProcessProblems` avec `/` final retiré (`core.mjs:604`, CA-12), message de refus d'écriture sans chemin en dur (`core.mjs:1130`).

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| 1. La skill `init` demande de remplacer `docs/chantiers` par `chantiersDir` sans préciser « sans `/` final » : `work/chantiers/` donnerait `work/chantiers//…`, signalé par `check-process` | `plugins/atelier/skills/init/SKILL.md:52` | Corrigé (17604cc). |
| 2. `revue.md` non commité | `docs/chantiers/FEAT-4-relations-chantiers-epic/revue.md` | Écarté : commité avec la spec à l'enregistrement de la revue (étape 5). |

- Bilan du tour : zéro bloquant ; un point corrigé, un écarté.

## Tour 4 : 2026-11-21
- Commit revu : 17604cc
- Base : 8309779

### Bloquant
Aucun. Correction du tour 3 vérifiée (`SKILL.md:52` aligné sur `checkProcessProblems`).

### À discuter
Aucun.

- Bilan du tour : zéro point ; revue enregistrée.
