# Revue : FEAT-35 Lister et retrouver les chantiers

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique. Les revues d'une même portée sont numérotées (`## Revue 1 : tranche 1 : …`, `## Revue 2 : tranche 1 : …`) ; une revue 2 ou suivante (relance) ajoute sous la base une ligne `- Corrections depuis la revue <n> : <commits>`.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue 1 : tranche 1 : 2026-11-26
- Commit revu : bdeb1b3
- Base : d78556a

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Le commentaire de `nextStep` décrit `needsPlan`, insérée entre eux | plugins/atelier/lib/next-step.mjs:11 | corrigé (ed9f0a5) |
| RD2. « Clos » recopié de `CLOSED_STATUSES` | plugins/atelier/lib/list.mjs:29 | corrigé (ed9f0a5) |
| RD3. Ternaire redondant et règle `reopeningPending` réécrite à la main | plugins/atelier/lib/list.mjs:72, plugins/atelier/lib/tdd.mjs:77 | corrigé (ed9f0a5) |

- Bilan de la revue : aucun bloquant, trois points de maintenance corrigés. Pour la tranche 2 (hors points) : une seule source pour la colonne type et l'étape (le type de l'en-tête) ; clauses de CA-8 passant par la commande et cas d'OD4 à tester.

## Revue 2 : tranche 1 : 2026-11-26
- Commit revu : ed9f0a5
- Base : d78556a
- Corrections depuis la revue 1 : ed9f0a5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD4. Ligne vide entre le commentaire de `nextStep` et sa fonction | plugins/atelier/lib/next-step.mjs:21 | corrigé (20d9306) |

- Bilan de la revue : RD1 à RD3 réglés, sans changement de comportement. Idées hors diff : `write-guard.mjs:122` recopie encore `['done', 'abandoned']` ; `tdd.mjs:193` réécrit encore `reopeningPending` à la main.

## Revue 1 : tranche 2 : 2026-11-27
- Commit revu : 759c9c3
- Base : 20d9306

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD5. Un texte libre entre guillemets est cherché comme une seule expression | plugins/atelier/lib/list.mjs:125 | corrigé (841f4c4) ; test prévu en tranche 3 (CA-4, voir decisions.md) |
| RD6. Version affichée (type, statut par défaut) écrite dans la couche cli, `specStatus` recopié | plugins/atelier/lib/cli/list.mjs:29 | corrigé (841f4c4) |
| RD7. Garde confuse et branche morte dans `currentTreeVersions` | plugins/atelier/lib/cli/list.mjs:24 | corrigé (841f4c4) |
| RD8. Second lecteur de l'arbre courant à côté de `chantiersHere` | plugins/atelier/lib/cli/list.mjs:16 | reporté (tranche 3) |

- Bilan de la revue : aucun bloquant ; RD8 sera traité en tranche 3, où la liste lira `chantierIndex` enrichi.
