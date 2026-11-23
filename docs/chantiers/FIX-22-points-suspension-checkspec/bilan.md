# Bilan : FIX-22 Faux positifs de checkSpec sur « … »

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
`checkSpec` ne signale plus un « … » que s'il est écrit à part (après un début de ligne, un espacement ou une barre `|`) et hors code. Les « … » collés au mot, cités en code en ligne ou dans un bloc de code ne bloquent plus la signature d'un brouillon. Le message dit comment citer un « … » voulu. Le template EPIC écrit désormais sa ligne de format comme FEAT et FIX, et le site explique la règle.

**Cause réelle** : confirmée. `checkSpec` testait `content.includes('…')` sans regarder le contexte du caractère. Découverte en route : tous les « … » des templates sont dans des commentaires HTML, donc le seul oubli réel que ce contrôle attrapait était la ligne de format recopiée hors commentaire sans être remplie. La nouvelle règle le garde.

**Autres endroits où le schéma existe** : aucun. C'est le seul test sur « … » du plugin.

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/check-spec-ellipsis.test.mjs`.

| Critère | Statut | Test |
|---|---|---|
| CA-1 : CA-17 et CA-18 de TEC-15 en code en ligne | Livré | `CA-1 : les critères CA-17 et CA-18 de TEC-15…` |
| CA-2 : blocs fermés (` ``` `, ` ```js ` indenté, `~~~`, clôture plus longue) | Livré | `CA-2 : un bloc de code délimité fermé…` (5 cas) |
| CA-3 : « … » collé au caractère qui précède | Livré | `CA-3 : un « … » collé…` (3 cas) |
| CA-4 : ligne de format FEAT, FIX, EPIC recopiée, message exact | Livré | `CA-4 : la ligne de format…` (3 cas), `CA-4 : le message est exactement celui de la spec` |
| CA-5 : « … » écrit à part, tous espacements, cellule `\| … \|` | Livré | `CA-5 : un « … » écrit à part…` (6 cas) |
| CA-6 : template EPIC aligné | Livré | `CA-6 : la ligne de format du template EPIC…` |
| CA-7 : accent grave orphelin, bloc jamais fermé | Livré | `CA-7 : code mal formé` (3 cas) |
| CA-8 : « vide » et « critère numéroté » voient le code | Livré | `CA-8 : les contrôles…` (2 cas) |
| CA-9 : tests existants inchangés | Livré | `core.test.mjs` intact, 222 tests verts |
| CA-10 : puce, numéro, italique, commentaire collés | Livré | `CA-10 : la recherche porte sur le texte écrit…` (6 cas) |
| CA-11 : clôtures qui ne ferment pas, ouvertures après puce, case ou `>` | Livré | `CA-11 : clôture et ouverture des blocs` (6 cas), `CA-11 : une ligne « - ``` »…` |
| CA-12 : code en ligne à deux accents graves, `\|…\|` | Livré | `CA-12 : code en ligne à plusieurs accents graves…` (3 cas) |

Écarts : deux amendements, tous deux tracés dans la spec. Le premier (après la vérification de surapprentissage) fait chercher les « … » sur le texte de la section plutôt que sur `meaningfulContent`, ajoute CA-10 à CA-12 et referme le commentaire de format de la §5, laissé ouvert à la signature. Le second (revue 1, D1 et D2) réserve la puce à l'ouverture d'un bloc et note une limite en §6.

## 3. Choix techniques
- Règle lexicale « précédé d'un début de ligne, d'un espacement ou d'un `|` », indépendante du texte des templates (piste C écartée).
- Le code est caché pour la seule recherche des « … » : les contrôles « vide » et « critère numéroté » ne changent pas.
- Code en ligne et commentaires remplacés par un caractère neutre, pas supprimés, pour qu'un « … » collé reste collé.
- Recherche sur les lignes brutes de la section (décision du 2026-11-23 dans `decisions.md`).

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` :
  - `UNFINISHED_TEXT` : la règle, en une regex ;
  - `hideCode(text)` : fonction pure qui retire les blocs délimités (CommonMark simplifié) et neutralise le code en ligne ;
  - `checkSpec` : appelle `hideCode` sur la section, commentaires neutralisés.
- `plugins/atelier/templates/spec-epic.md` : ligne de format alignée.
- `site/cycle/signature.md` : étape « Complétude ».

## 5. Pistes écartées
- C (texte exact des templates) : casse en silence à chaque reformulation, et rate les trous écrits à la main.
- B sans A : `RB2. …` cité en exemple serait indiscernable d'un trou, sans moyen de dire « c'est voulu ».
- Exiger une espace après la puce dans `meaningfulContent` : aurait changé les contrôles « vide » et « critère numéroté ».
- Un utilitaire commun pour la regex des commentaires (D4) et le retrait de l'export de `hideCode` (D5) : écartés en revue.

## 6. Dette et suites
- Un commentaire HTML non refermé dans une spec n'est pas signalé. Il a masqué tous les critères de cette spec au rendu sans que `checkSpec` le voie. C'est un petit chantier à ouvrir.
- Les limites assumées sont en §6 de la spec : « … » voulu écrit en prose, `(…)` et `[…]`, `<!--` cité en code, code en ligne sur plusieurs lignes, blocs indentés sans délimiteur.
- Si CA-18 de TEC-15 est écrit hors code dans sa version locale, il restera signalé : TEC-15 devra l'amender.

## 7. Verdict de revue
Deux revues sur le chantier, tranche unique (base `f662c5b`) :
- **Revue 1** (`2e09ead`) : aucun bloquant. Cinq points à discuter : D1 corrigé (spec amendée, test ajouté, `7290fe9`), D2 noté en limite, D3 corrigé, D4 et D5 écartés par Didier.
- **Revue 2** (`7290fe9`) : aucun point. Corrections vérifiées.
- Exceptions acceptées : aucune.

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-23
