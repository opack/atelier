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
| RD8. Second lecteur de l'arbre courant à côté de `chantiersHere` | plugins/atelier/lib/cli/list.mjs:16 | corrigé (126c525), reporté de la tranche 2 |

- Bilan de la revue : aucun bloquant ; RD8 sera traité en tranche 3, où la liste lira `chantierIndex` enrichi.

## Revue 2 : tranche 2 : 2026-11-27
- Commit revu : 22523d4
- Base : 20d9306
- Corrections depuis la revue 1 : 841f4c4

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD9. La cellule de RD5 annonçait un test pas encore écrit | docs/chantiers/FEAT-35-lister-retrouver-chantiers/revue.md:55 | corrigé (b0d7bd3) |

- Bilan de la revue : RD5 à RD7 réglés sans régression ; RD8 reporté en tranche 3.

## Revue 1 : tranche 3 : 2026-11-27
- Commit revu : 126c525
- Base : 6bcfa74

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. `catch` muet sur la lecture des refs, au-delà du seul cas hors dépôt | plugins/atelier/lib/cli/relations.mjs:65 | corrigé (c3e7584) |
| RD11. Le lecteur partagé de l'index dépend du domaine `list` (`versionFacts`) | plugins/atelier/lib/cli/relations.mjs:8 | corrigé (c3e7584) |
| RD12. Le test des doublons appelle `cp`, absent sous Windows | plugins/atelier/test/list-versions.test.mjs:222 | test ajouté (2b04c5e, tests rouverts puis regelés) |

- Bilan de la revue : aucun bloquant ; les consommateurs actuels de l'index gardent leur comportement (seul écart : dossier retenu en cas de doublon, désormais déterministe).

## Revue 2 : tranche 3 : 2026-11-27
- Commit revu : b52871b
- Base : 6bcfa74
- Corrections depuis la revue 1 : c3e7584, 2b04c5e

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD13. Sur une branche sans commit, les autres branches ne sont plus lues | plugins/atelier/lib/cli/relations.mjs:64 | corrigé (e310977) ; test ajouté en tranche 4 (2b1c040) |

- Bilan de la revue : RD10, RD11 et RD12 réglés ; HEAD détaché vérifié, comportement inchangé.

## Revue 3 : tranche 3 : 2026-11-27
- Commit revu : 8576eec
- Base : 6bcfa74
- Corrections depuis la revue 2 : e310977

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD14. Branche courante `null` comparée à `refs/heads/null` dans le filtre des refs | plugins/atelier/lib/cli/relations.mjs:73 | corrigé (8fc79b3) ; test ajouté en tranche 4 (2b1c040) |

- Bilan de la revue : RD13 réglé (dépôt normal, HEAD détaché, branche orpheline, hors dépôt vérifiés). Écarté du traitement de RD14 : le repli de `currentBranch` sur `symbolic-ref`, qui changerait le contrat d'une fonction partagée pour un cas que la méthode ne produit pas.

## Revue 1 : tranche 4 : 2026-11-27
- Commit revu : e4713fd
- Base : 8fc79b3

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD15. Chemin absolu d'un dossier calculé à deux endroits | plugins/atelier/lib/cli/list-open.mjs:33 | corrigé (a46084e) |
| RD16. Sous Windows, `explorer` cherché par son nom, d'abord dans le dossier courant | plugins/atelier/lib/list-open.mjs:29 | reporté (« Dette et suites » du bilan : exécutables système par chemin absolu sous Windows, `git` et `explorer`) |
| RD17. `bin/atelier` n'affiche plus la pile d'appels des erreurs inattendues | plugins/atelier/bin/atelier:4 | exception acceptée (Didier, 2026-11-28 : message propre pour les erreurs voulues, erreur interne toujours bruyante, code 1 ; un type d'erreur dédié coûterait plus qu'il ne rapporte) |

- Bilan de la revue : aucun bloquant ; lancement de l'explorateur sûr (sans shell, chemin absolu en argument séparé), aucun processus ne retient node ; tests de RD13 et RD14 présents.

## Revue 2 : tranche 4 : 2026-11-28
- Commit revu : d1958e0
- Base : 8fc79b3
- Corrections depuis la revue 1 : a46084e

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RD15 réglé, sans effet sur les autres consommateurs de l'index ; `list --json` rend aussi un chemin absolu quand `CLAUDE_PROJECT_DIR` est relatif.

## Revue 1 : tranche 5 : 2026-11-28
- Commit revu : eb0fcaa
- Base : ee6b2ad

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD18. Doc de `atelier list` inexacte sur la version lue, muette sur les valeurs refusées et la limite de l'étape | site/reference/commandes.md:30 | corrigé (adbf32b) |
| RD19. `/atelier:list` : une demande traduisible en partie peut être approchée sans le dire | plugins/atelier/skills/list/SKILL.md:37 | corrigé (adbf32b) |
| RD20. Vérification manuelle des skills (SD14) incomplète | docs/chantiers/FEAT-35-lister-retrouver-chantiers/decisions.md:122 | corrigé (adbf32b) |
| RD21. `git fetch --prune` sans remote nommé échoue quand le seul remote n'est pas `origin` | plugins/atelier/skills/list/SKILL.md:14 | corrigé (adbf32b) |
| RD22. Le démarrage rapide laisse croire que `/atelier:open` ouvre le chantier d'un coéquipier sur une autre branche | site/guide/demarrage-rapide.md:38 | corrigé (adbf32b) |
| RD23. Le test du succès de l'explorateur porte l'étiquette CA-19 | plugins/atelier/test/list-open-exit.test.mjs:42 | corrigé (adbf32b) |
| RD24. Consigne ambiguë en fin de `/atelier:list` | plugins/atelier/skills/list/SKILL.md:41 | corrigé (adbf32b) |

- Bilan de la revue : aucun bloquant ; build du site réussi, version 0.9.0 lue dans `plugin.json` seulement, aucun test figé modifié.
