# Bilan : FIX-18 next-id ne compte plus les CA-n des commits

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
<!-- 3 lignes : ce qui a été fait, pour qui, état final. -->

`atelier next-id` sautait des numéros dès qu'un sujet de commit citait `CA-13`, `UTF-8` ou `ISO-8601`, ou qu'une branche de bot s'appelait `renovate/node-20.x` (EPIC-14 attribué après FEAT-7, `FEAT-8602` possible). Le compteur applique désormais une règle d'extraction par source : identifiants entre crochets pour les commits, identifiant en tête de segment pour les branches, dossiers de chantier inchangés. Tous les projets qui utilisent atelier en profitent. Revue sans point, 272 tests verts.

**Cause réelle** : confirmée, celle de la spec (§3). `collectUsedIdentifiers` mélangeait dossiers, sujets de commit et noms de branche dans une seule liste, et `highestChantierNumber` leur appliquait à tous `/\b[A-Z]{2,6}-(\d+)\b/g`. La provenance était perdue avant l'extraction. Même schéma ailleurs : `RELATION_ID_PATTERN` accepte aussi tout `XX-n`, mais sur une valeur saisie volontairement dans un champ `rel_*` ; rien à changer.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : les sujets de commit ne comptent que les identifiants entre crochets (`EPIC-8` et non `EPIC-8602`) | livré | `commit subjects count only bracketed identifiers [FIX-18 CA-1]` |
| CA-2 : les identifiants entre crochets, préfixes historiques compris, continuent le compteur (`FIX-438`) | livré (garde, passait déjà) | `bracketed identifiers keep the counter going, legacy prefixes included [FIX-18 CA-2]` |
| CA-3 : branches et dossiers comptent sans commit entre crochets (`FEAT-422` et non `FEAT-901`) | livré | `branch names and chantier folders count without any bracketed commit [FIX-18 CA-3]` |
| CA-4 : les branches de bot ne comptent pas (`FEAT-8` et non `FEAT-21`) | livré | `branch names count only an identifier opening a segment [FIX-18 CA-4]` |
| Casse, `]` fermant non exigé, identifiant en fin de nom de branche (§4) | livré | `identifiers are read whatever their case, without a closing bracket, at the end of a branch name [FIX-18 CA-1, CA-2, CA-4]` |

Aucun écart avec la spec. Le dernier test a été ajouté après réouverture des tests (point OD2 du vérificateur de surapprentissage) : le code était déjà juste, mais rien ne le protégeait d'une régression, notamment pendant le refactoring de `lib/` d'EPIC-17.

## 3. Choix techniques
<!-- Les décisions structurantes, une ligne chacune. -->

- Extraction à la collecte, par source, dans deux fonctions pures exportées ; `highestChantierNumber` et `nextChantierId` ne voient plus que des identifiants déjà filtrés et ne changent pas.
- Identifiants extraits remis en majuscules un par un (au lieu de toute la ligne), pour rester compatibles avec la regex sensible à la casse de `highestChantierNumber`.
- Pas de liste d'exclusion (`CA`, `UTF`, `ISO`…) : elle ne serait jamais complète.

## 4. Éléments de code principaux
<!-- Points d'entrée, modules / composants / fonctions créés ou modifiés, avec leur rôle. Ce qu'un nouveau venu doit lire en premier. -->

- `plugins/atelier/lib/core.mjs` : `collectUsedIdentifiers` (point d'entrée, appelée par `atelier next-id`), `commitSubjectIdentifiers` (`/\[([A-Z]{2,6})-(\d+)\b/gi`), `branchNameIdentifiers` (`/(?:^|\/)([A-Z]{2,6})-(\d+)(?=-|$)/gi`), `gitLines` (lecture git tolérante à un dépôt sans historique).
- `plugins/atelier/test/core.test.mjs` : describe « Next identifier: where the counter reads identifiers » et son helper `makeCounterRepository`.
- `site/reference/commandes.md` : la ligne `atelier next-id` dit d'où vient le compteur.

## 5. Pistes écartées
<!-- Ce qui a été envisagé ou essayé puis abandonné, et pourquoi. -->

- Liste d'exclusion de préfixes : incomplète par nature.
- Liste blanche de préfixes (types + `legacyPrefixes`) : touche la configuration, `/atelier:init` et le site ; laissée à EPIC-14.

## 6. Dette et suites
<!-- Ce qui reste à faire, raccourcis assumés, chantiers à ouvrir. -->

- EPIC-14 : liste blanche de préfixes, pour qu'un `[JIRA-4521]`, une branche `feature/JIRA-123` ou `renovate/node-20` (sans suffixe) ne fassent plus sauter le compteur sur un dépôt client.
- Accepté (spec §6) : les sujets de merge `Merge pull request #4 from …/TEC-5-…` ne comptent plus ; un `[CA-3]` seul entre crochets compte. Les trous déjà présents dans la numérotation (EPIC-14 à FIX-18) restent.
- Les dossiers de chantier ne sont pas mis en majuscules avant extraction (comportement antérieur conservé) : un dossier `feat-7-x` ne compte pas.

## 7. Verdict de revue
<!-- Repris de revue.md : revues de tranche et du chantier, puis un point par identifiant (RB1, RD1…) avec son traitement final, exceptions acceptées comprises. -->

Revue du 2026-11-23 (chantier à tranche unique, commit f791c96, base 3dc5c3a) : aucun point bloquant ni à discuter. Points du vérificateur de surapprentissage traités avant la revue : OD1 (site non mis à jour) corrigé dans 027c66b ; OD2 (tests trop faibles sur la casse, le `]` non exigé et l'identifiant en fin de branche) test ajouté dans 2aee2d3 après réouverture.

| Point | Traitement |
|---|---|
| Aucun | |

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-23
