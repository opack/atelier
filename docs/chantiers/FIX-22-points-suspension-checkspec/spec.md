---
id: FIX-22
type: FIX
title: Faux positifs de checkSpec sur « … »
status: signed
tdd: yes
created_at: 2026-11-23
source: revue tranche 6 de TEC-15, point RD20
signed_by: Claude
signed_at: 2026-11-23
tests_commit: 2a3cb9b
slice: 1
---

# FIX-22 Faux positifs de checkSpec sur « … »

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
Dans cette spec, `U+2026` désigne le caractère des points de suspension : l'écrire tel quel dans une section obligatoire ferait refuser la signature à cause du bug lui-même.

- Observé : `checkSpec` signale « Section « X » : texte à compléter (« U+2026 ») » dès qu'une section obligatoire contient le caractère `U+2026`, où qu'il soit. Sur TEC-15, la section Vérification est signalée à cause de critères légitimes : CA-17 (`| RB1. U+2026 |`) et CA-18 (`RD3 U+2026 requalifié (RB4)`). Visible dans `atelier status --json` (`specProblems`).
- Attendu : seul un `U+2026` qui tient la place d'un texte à écrire est signalé. Un `U+2026` cité en code ou utilisé comme ponctuation (points de suspension collés à « CA-2 » dans « CA-1, CA-2 », ou à « ex- » dans « (ex-) ») ne l'est pas.
- Impact : sans effet aujourd'hui sur une spec signée (l'affichage masque le problème, aucune skill ne lit `specProblems`). En revanche, `atelier sign` contrôle les brouillons : avec la nomenclature des points de relecture (TEC-15), les écritures comme `RB2. U+2026` ou les exemples tronqués vont se multiplier, et la signature d'un brouillon sera refusée à tort. Gravité moyenne : blocage de la signature, contournable en reformulant.
- Source : point RD20 de la revue de la tranche 6 de TEC-15.

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit en local, sans environnement particulier :

1. Prendre une spec complète (tous les contrôles passent).
2. Ajouter à un critère de la section Vérification le texte `` `| RB1. U+2026 |` `` (code en ligne).
3. `atelier check-spec <spec>` signale « texte à compléter (« U+2026 ») ».

Même résultat avec une ponctuation ordinaire : « critères CA-1, CA-2 » suivi de `U+2026` collé dans une section obligatoire.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance forte. `plugins/atelier/lib/core.mjs`, `checkSpec` : `if (content.includes('U+2026'))`, sans regarder le contexte du caractère. `content` vient de `meaningfulContent`, qui retire déjà les commentaires HTML.

Constat qui change la lecture du problème : **dans les six templates de spec, tous les `U+2026` sont dans des commentaires HTML** (`spec-feat.md`, `spec-fix.md` : « Étant donné U+2026, quand U+2026, alors U+2026 » ; `spec-epic.md` : la même phrase, `U+2026` collé à « donné », « quand », « alors »). `meaningfulContent` les retire. Le contrôle actuel n'attrape donc jamais un template laissé tel quel (la section est signalée vide, à juste titre). Il n'attrape qu'un cas réel : la ligne de format **recopiée hors du commentaire** sans être remplie (« - [ ] CA-1 : Étant donné U+2026, quand U+2026, alors U+2026 »). C'est ce cas, et lui seul, que la correction doit garder.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
Pistes A + B, C écartée.

**Règle.** Un `U+2026` est un « trou » s'il est précédé d'un début de ligne, d'un caractère d'espacement (`\s` : espace, tabulation, espace insécable U+00A0, espace fine insécable U+202F) ou d'une barre de tableau `|`. Précédé de tout autre caractère (après `CA-2`, après `(ex-`, après un `` `title` `` en code, après `(` ou `[`), il n'est pas signalé. Seul le caractère qui précède compte, pas celui qui suit. C'est la typographie française : les points de suspension se collent au mot, un trou est écrit à part.

**Exclusions.** Avant la recherche des `U+2026`, et pour cette recherche seulement :
- (déjà fait) commentaires HTML, via `meaningfulContent` ;
- A. blocs de code délimités, à la manière de CommonMark, simplifiée : une ligne d'ouverture faite d'au moins trois `` ` `` ou trois `~`, éventuellement indentée et suivie d'un mot de langage (` ```js `) ; une clôture du même caractère, au moins aussi longue, éventuellement indentée. Un bloc jamais fermé court jusqu'à la fin de la section. Les lignes du bloc, ouverture et clôture comprises, sont retirées ;
- A. code en ligne : une suite de N accents graves refermée par une suite d'exactement N accents graves sur la même ligne. Un accent grave sans partenaire reste du texte (le `U+2026` qui le suit est contrôlé normalement). Le code en ligne réparti sur deux lignes n'est pas reconnu.

Le code en ligne est **remplacé par un caractère neutre qui n'est ni un espacement ni une barre `|`**, pas supprimé : un `U+2026` collé derrière un code en ligne reste collé, donc non signalé.

Les contrôles « section vide » et « aucun critère numéroté » ne changent pas : ils voient toujours le code. Une section dont le seul contenu est un bloc de code n'est pas vide, et un `CA-1` écrit en code compte.

**Message.** Texte exact : « Section « X » : texte à compléter (« U+2026 » isolé). S'il est voulu, mets-le en code en ligne. » (avec le vrai caractère à la place de `U+2026`). Il dit comment lever un faux positif résiduel au lieu de laisser deviner.

**Template EPIC.** `spec-epic.md` écrit la ligne de format avec des `U+2026` collés aux mots, à l'inverse de FEAT et FIX. Recopiée hors commentaire, cette ligne échapperait à la règle. On l'aligne sur « Étant donné U+2026, quand U+2026, alors U+2026 ». Les specs EPIC existantes ne sont pas touchées (la ligne y est en commentaire).

**Pourquoi pas C** (texte exact des templates) : elle casse en silence dès qu'un template est reformulé, et elle rate les trous écrits à la main. La règle B ne dépend d'aucun texte de template ; elle s'appuie sur la seule convention que les templates partagent déjà (un trou = `U+2026` écrit à part).

**Pourquoi pas B seule, sans A** : `RB2. U+2026` est un trou au sens de la règle, mais légitime comme exemple. Lexicalement, rien ne le distingue de « Étant donné U+2026, quand ». A donne à l'auteur un moyen explicite et sans ambiguïté de dire « c'est voulu ».

**Fichiers touchés.**
- `plugins/atelier/lib/core.mjs` : `checkSpec`, plus une fonction pure qui neutralise le code.
- `plugins/atelier/templates/spec-epic.md` : ligne de format.
- `plugins/atelier/test/core.test.mjs`.
- `site/cycle/signature.md` : à l'étape « Complétude », ce qu'est un texte à compléter (un `U+2026` écrit à part, hors code) et comment écrire un `U+2026` voulu (en code en ligne).

Pas de données à réparer : le contrôle ne modifie aucun fichier.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné une spec complète dont la section Vérification contient les critères CA-17 et CA-18 de TEC-15 tels qu'écrits (`` `| RB1. U+2026 |` `` et `` `RD3 U+2026 requalifié (RB4)` ``, en code en ligne), quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-2 : Étant donné une spec complète dont une section obligatoire contient un bloc de code délimité fermé (` ``` `, ` ```js ` indenté dans une liste, ou `~~~`) avec une ligne `- AAAA-MM-JJ : U+2026`, quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-3 : Étant donné une spec complète dont une section obligatoire contient un `U+2026` collé au caractère qui précède (après « CA-1, CA-2 », après « (ex- », juste après un code en ligne `` `title` ``), quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-4 : Étant donné une spec FEAT, FIX ou EPIC dont la section des critères contient la ligne de format de son template recopiée hors commentaire et non remplie (« CA-1 : Étant donné U+2026, quand U+2026, alors U+2026 »), quand on lance `checkSpec`, alors la section est signalée par un message qui contient « texte à compléter » et « code en ligne ».
- [ ] CA-5 : Étant donné une spec complète dont une section obligatoire contient un `U+2026` hors code précédé d'un début de ligne, d'une espace, d'une tabulation, d'une espace insécable ou fine insécable, ou d'une barre `|` (cellule `| U+2026 |`), quand on lance `checkSpec`, alors la section est signalée « texte à compléter ».
- [ ] CA-6 : Étant donné le template `spec-epic.md`, quand on lit sa ligne de format des critères, alors elle s'écrit « Étant donné U+2026, quand U+2026, alors U+2026 » (`U+2026` précédés d'une espace), comme FEAT et FIX.
- [ ] CA-7 : Étant donné un code mal formé dans une section obligatoire, quand on lance `checkSpec`, alors : un accent grave sans partenaire suivi de « U+2026 » précédé d'une espace est signalé ; un `U+2026` placé après l'ouverture d'un bloc ` ``` ` jamais fermé n'est pas signalé (le bloc court jusqu'à la fin de la section).
- [ ] CA-8 : Étant donné une section obligatoire dont le seul contenu est un bloc de code, quand on lance `checkSpec`, alors elle n'est pas signalée vide ; étant donné une section de critères dont le seul `CA-1` est écrit en code en ligne, alors elle n'est pas signalée « aucun critère numéroté ».
- [ ] CA-9 : Les tests existants de `checkSpec` (sections absentes ou vides, en-tête, `tdd`, type inconnu, critères numérotés, texte à compléter, EPIC) passent sans modification.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- **Limites assumées** :
  - un `…` voulu, écrit à part hors code, reste signalé : `RB2. …` en prose, ou « … » cité entre guillemets avec espaces (fréquent dans une spec qui parle de cet outil ; celle-ci a dû l'éviter). Le message dit comment le lever ;
  - « (…) » et « […] » ne sont jamais signalés, qu'ils servent de trou ou d'ellipse ;
  - « …suite » en début de ligne est signalé même s'il ne forme pas un mot à lui seul (seul le caractère qui précède compte) ;
  - une ancienne ligne de format EPIC (`…` collés) recopiée hors commentaire dans un brouillon était signalée et ne le sera plus. Aucune spec du dépôt n'est dans ce cas ;
  - si CA-18 de TEC-15 est écrit hors code dans la version locale de la spec, il restera signalé et devra passer en code (TEC-15 est signée : par amendement).
- **Hors périmètre** : les trois points ASCII `...` (jamais contrôlés, ne le seront pas davantage) ; l'affichage de `specProblems` sur une spec signée ; le code en ligne réparti sur plusieurs lignes ; les blocs de code indentés de quatre espaces sans délimiteur.
- **Contournement d'ici là** : mettre les `…` voulus en code en ligne ne suffit pas aujourd'hui (le contrôle ne distingue pas le code du texte) ; seule une reformulation sans `…` lève le problème.
- La spec de TEC-15 sur `origin` s'arrête à la tranche 2 (pas de CA-18) : le test de CA-1 reprend les deux critères en extraits, pas le fichier.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
