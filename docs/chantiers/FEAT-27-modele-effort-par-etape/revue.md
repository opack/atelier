# Revue : FEAT-27 Modèle et effort réglés par étape

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : tranche 1 : 2026-11-24
- Commit revu : 4cb46a5
- Base : aaa4488 (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Mise à jour de `CLAUDE.md` promise par la spec, prévue dans aucune tranche | `CLAUDE.md:8`, `CLAUDE.md:19` | reporté (tranche 5) : ajoutée au plan ; à la tranche 5, après REF-29, `CLAUDE.md` décrit les modules de domaine de `lib/`, sauf si REF-29 l'a déjà fait |

- Bilan de la revue : tranche saine (324 tests verts, tests figés intacts, aucun test anticipé). Un seul point, reporté à la tranche 5.

## Revue : tranche 2 : 2026-11-24
- Commit revu : 4399f9c
- Base : e633a09 (fin de la tranche 1)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD2. Apostrophes droites dans la nouvelle section de `modes.md` | `site/agent/modes.md:19-38` | reporté (tranche 5) : la tranche de documentation repasse sur le site ; apostrophes typographiques à ce moment-là |

- Bilan de la revue : tranche saine (328 tests verts, tests figés intacts, amendement OD9 appliqué partout). RD1 reste reporté à la tranche 5.

## Revue : tranche 3 : 2026-11-24
- Commit revu : 29b04b8
- Base : a3eae7d (fin de la tranche 2) ; la fusion de `main` 82ac375 (REF-29, FIX-28, FIX-25) est hors chantier

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD3. Refus d'une option répétée (OD11) sans test | `plugins/atelier/lib/cli/agent-settings.mjs:20` | reporté (tranche 4) : test ajouté avec ceux de la tranche 4, sans rouvrir le gel |
| RD4. Commit de fusion de `main` sans `[FEAT-27]` | commit 82ac375 | écarté : réécrire une fusion déjà poussée coûte plus que le gain ; les prochaines fusions seront nommées `chore(merge): [FEAT-27] …` |

- Bilan de la revue : tranche saine (366 tests verts, gel respecté, réouverture limitée à l'import exigé par REF-29). RD1 et RD2 restent reportés à la tranche 5.

## Revue : tranche 4 : 2026-11-25
- Commit revu : 3dd4188, corrections f1edfac
- Base : 8edcea1 (fin de la tranche 3)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD3 (repris). Refus d'une option répétée sans test | `plugins/atelier/test/agent-settings.test.mjs` | corrigé (1431167) : test ajouté avec ceux de la tranche 4 |
| RD5. `build` appelé avec un identifiant de point (`RB2`) pris pour un mot inconnu | `plugins/atelier/skills/build/SKILL.md` | écarté : la revue ne transmet pas d'identifiant en argument ; cas improbable, et l'échec serait bruyant et sans dommage |
| RD6. Apostrophe dans une valeur d'option substituée non refusée | `plugins/atelier/skills/{build,review,sign}/SKILL.md` | corrigé (f1edfac) : la consigne couvre aussi les valeurs d'options substituées |
| RD7. Test modifié par Bash pendant l'implémentation | `plugins/atelier/skills/build/SKILL.md` | écarté : déjà rattrapé par le hook de fin et `atelier tests-changed` |
| RD8. `overfit-checker` résolu même sans TDD | `plugins/atelier/skills/build/SKILL.md` | corrigé (f1edfac) : résolu en TDD seulement |

- Bilan de la revue : tranche saine (370 tests verts, gel respecté, tout le code de `build` passe par `implementer`). RD1 et RD2 restent reportés à la tranche 5.

## Revue : tranche 5 : 2026-11-25
- Commit revu : baa3a52, correction c8543c3
- Base : 53c0149 (fin de la tranche 4)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1 (repris). Mise à jour de `CLAUDE.md` promise par la spec | `CLAUDE.md` | sans objet : REF-29 a déjà décrit les modules de domaine de `lib/` |
| RD2 (repris). Apostrophes droites dans la nouvelle section de `modes.md` | `site/agent/modes.md` | corrigé (baa3a52) |
| RD9. Ligne `/atelier:build` de `commandes.md` inexacte sur l'argument de tranche | `site/reference/commandes.md:15` | corrigé (c8543c3) : `[tranche]` dans l'intitulé ; hors `SPIKE`, un numéro de tranche est ignoré, tout autre mot fait arrêter |

- Bilan de la revue : tranche saine (375 tests verts, gel respecté, texte du site vérifié contre le code). Plus aucun point reporté.

## Revue 1 : chantier : 2026-11-25
- Commit revu : 6908794
- Base : 90c92ab (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. Vérification locale de `/plugin configure` (OD8) jamais consignée | `docs/chantiers/FEAT-27-modele-effort-par-etape/decisions.md:61` | spec amendée (54fe0e9, 0122333) : vérifié par Didier, « save » enregistre les valeurs affichées ; chaque option propose `recommandé (…)`, traité comme non réglé ; corrigé (e02591e) |
| RD11. Correction de revue « en suivant `/atelier:build` » sans dire de lancer la commande | `plugins/atelier/skills/review/SKILL.md:49` | corrigé (e02591e) |
| RD12. Sujet ambigu après la fusion dans `implementation.md` | `site/cycle/implementation.md:19` | corrigé (e02591e) |

- Bilan de la revue : chantier cohérent, fusion de `main` sans contradiction. RD10 a mené à l'amendement « recommandé (…) » (tests rouverts et regelés), à vérifier par la relance.
