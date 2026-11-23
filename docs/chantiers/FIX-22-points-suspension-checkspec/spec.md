---
id: FIX-22
type: FIX
title: Faux positifs de checkSpec sur « … »
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
source: revue tranche 6 de TEC-15, point RD20
signed_by:
signed_at:
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

**Règle.** Un `U+2026` est un « trou » s'il est un mot à lui seul : précédé d'un début de ligne, d'une espace ou d'une barre de tableau `|`. Collé au caractère qui précède (après `CA-2`, après `(ex-`, après un `` `title` `` en code), c'est de la ponctuation : pas signalé. C'est la typographie française : les points de suspension se collent au mot, un trou est un mot isolé.

**Exclusions, avant la recherche :**
- A. code en ligne (`` `U+2026` ``, y compris avec plusieurs accents graves) ;
- A. blocs de code délimités par ` ``` ` ou `~~~` ;
- (déjà fait) commentaires HTML, via `meaningfulContent`.

**Message.** « Section « X » : texte à compléter (« U+2026 » isolé). S'il est voulu, mets-le en code en ligne (`` `U+2026` ``). » Le message dit comment lever un faux positif résiduel au lieu de laisser deviner.

**Template EPIC.** `spec-epic.md` écrit la ligne de format avec des `U+2026` collés aux mots, à l'inverse de FEAT et FIX. Recopiée hors commentaire, cette ligne échapperait à la règle. On l'aligne sur « Étant donné U+2026, quand U+2026, alors U+2026 ». Les specs EPIC existantes ne sont pas touchées (la ligne y est en commentaire).

**Pourquoi pas C** (texte exact des templates) : elle casse en silence dès qu'un template est reformulé, et elle rate les trous écrits à la main. La règle B ne dépend d'aucun texte de template ; elle s'appuie sur la seule convention que les templates partagent déjà (un trou = `U+2026` isolé).

**Pourquoi pas B seule, sans A** : `RB2. U+2026` est un trou au sens de la règle (isolé), mais légitime comme exemple. Lexicalement, rien ne le distingue de « Étant donné U+2026, quand ». A donne à l'auteur un moyen explicite et sans ambiguïté de dire « c'est voulu ».

**Fichiers touchés.** `plugins/atelier/lib/core.mjs` (`checkSpec`, plus une fonction pure qui retire le code), `plugins/atelier/templates/spec-epic.md`, `plugins/atelier/test/core.test.mjs`, `site/cycle/signature.md` (ce que « incomplète » veut dire). Pas de données à réparer : le contrôle ne modifie aucun fichier.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné une spec complète dont la section Vérification contient les critères CA-17 et CA-18 de TEC-15 tels qu'écrits (`` `| RB1. U+2026 |` `` et `` `RD3 U+2026 requalifié (RB4)` ``, en code en ligne), quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-2 : Étant donné une spec complète dont une section obligatoire contient un bloc de code délimité (` ``` ` ou `~~~`) avec une ligne `- AAAA-MM-JJ : U+2026`, quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-3 : Étant donné une spec complète dont une section obligatoire contient de la ponctuation collée (`U+2026` collé après « CA-1, CA-2 », après « (ex- », après « `title` »), quand on lance `checkSpec`, alors aucun problème « texte à compléter » n'est signalé (le test échoue avant la correction).
- [ ] CA-4 : Étant donné une spec FEAT, FIX ou EPIC dont la section des critères contient la ligne de format de son template recopiée hors commentaire et non remplie (« CA-1 : Étant donné U+2026, quand U+2026, alors U+2026 »), quand on lance `checkSpec`, alors la section est signalée « texte à compléter », et le message propose le code en ligne pour un `U+2026` voulu.
- [ ] CA-5 : Étant donné une spec complète dont une section obligatoire contient un `U+2026` isolé hors code (en début de ligne, après une espace, ou seul dans une cellule de tableau `| U+2026 |`), quand on lance `checkSpec`, alors la section est signalée « texte à compléter ».
- [ ] CA-6 : Étant donné le template `spec-epic.md`, quand on lit sa ligne de format des critères, alors elle s'écrit « Étant donné U+2026, quand U+2026, alors U+2026 » (`U+2026` isolés), comme FEAT et FIX.
- [ ] CA-7 : Les tests existants de `checkSpec` (sections absentes ou vides, en-tête, `tdd`, type inconnu, critères numérotés, EPIC) passent sans modification.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- **Limite assumée** : un `…` isolé voulu, écrit hors code (`RB2. …` en prose), reste signalé. Le message dit comment le lever. Si CA-18 de TEC-15 est écrit hors code dans la version locale de la spec, il restera signalé et devra passer en code (TEC-15 est signée : par amendement).
- **Hors périmètre** : les trois points ASCII `...` (jamais contrôlés, ne le seront pas davantage) ; l'affichage de `specProblems` sur une spec signée.
- **Contournement d'ici là** : mettre les `…` voulus en code en ligne ne suffit pas aujourd'hui (le contrôle ignore le code) ; seule une reformulation sans `…` lève le problème.
- La spec de TEC-15 sur `origin` s'arrête à la tranche 2 (pas de CA-18) : le test de CA-1 reprend les deux critères en extraits, pas le fichier.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
