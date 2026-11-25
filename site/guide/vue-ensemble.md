# Vue d’ensemble du cycle

## Une fois par projet

[Installer atelier](../projet/installation) et écrire un [CLAUDE.md](../projet/claude-md) utile. C’est le socle sur lequel chaque chantier s’appuie.

## À chaque chantier

<figure class="cycle-diagram">
<svg viewBox="0 0 460 660" role="img" aria-labelledby="cycle-title cycle-desc">
  <title id="cycle-title">Le cycle d’un chantier atelier</title>
  <desc id="cycle-desc">new, puis sign, puis plan (FEAT, REF, gros chantiers). Puis, pour chaque tranche du plan : write-tests (si TDD), build, et review de la tranche, en boucle avec build jusqu’à ce que chaque point ait un traitement ; la validation de la revue fait passer à la tranche suivante. Après la dernière tranche : review du chantier, puis close. amend modifie la spec signée et ramène à write-tests ou à build.</desc>
  <defs>
    <marker id="cycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="cycle-arrow-head" />
    </marker>
    <marker id="cycle-arrow-amend" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="cycle-amend-head" />
    </marker>
  </defs>
  <!-- main column -->
  <g class="cycle-step"><rect x="60" y="16" width="180" height="44" rx="8" /><text x="150" y="43">/atelier:new</text></g>
  <g class="cycle-step"><rect x="60" y="88" width="180" height="44" rx="8" /><text x="150" y="115">/atelier:sign</text></g>
  <g class="cycle-step cycle-optional"><rect x="60" y="160" width="180" height="50" rx="8" /><text x="150" y="182">/atelier:plan</text><text x="150" y="200" class="cycle-note">FEAT, REF, gros chantiers</text></g>
  <g class="cycle-step cycle-optional"><rect x="60" y="238" width="180" height="50" rx="8" /><text x="150" y="260">/atelier:write-tests</text><text x="150" y="278" class="cycle-note">si la tranche est en TDD</text></g>
  <g class="cycle-step"><rect x="60" y="316" width="180" height="44" rx="8" /><text x="150" y="343">/atelier:build</text></g>
  <g class="cycle-step"><rect x="60" y="410" width="180" height="50" rx="8" /><text x="150" y="432">/atelier:review</text><text x="150" y="450" class="cycle-note">revue de la tranche</text></g>
  <g class="cycle-step cycle-optional"><rect x="60" y="510" width="180" height="50" rx="8" /><text x="150" y="532">/atelier:review</text><text x="150" y="550" class="cycle-note">revue du chantier</text></g>
  <g class="cycle-step cycle-final"><rect x="60" y="600" width="180" height="44" rx="8" /><text x="150" y="627">/atelier:close</text></g>
  <path d="M150 60 V88" class="cycle-link" />
  <path d="M150 132 V160" class="cycle-link" />
  <path d="M150 210 V238" class="cycle-link" />
  <path d="M150 288 V316" class="cycle-link" />
  <path d="M120 360 V410" class="cycle-link" />
  <path d="M180 410 V360" class="cycle-link" />
  <text x="114" y="390" class="cycle-label" text-anchor="end">relire</text>
  <text x="186" y="390" class="cycle-label" text-anchor="start">corriger</text>
  <!-- loop per slice -->
  <path d="M60 435 H34 V263 H60" class="cycle-link" />
  <text x="24" y="349" class="cycle-label" text-anchor="middle" transform="rotate(-90 24 349)">tranche suivante (validée)</text>
  <path d="M150 460 V510" class="cycle-link" />
  <text x="158" y="490" class="cycle-label" text-anchor="start">dernière tranche validée</text>
  <path d="M150 560 V600" class="cycle-link" />
  <text x="158" y="584" class="cycle-label" text-anchor="start">chaque point traité</text>
  <!-- amend -->
  <g class="cycle-step cycle-amend"><rect x="300" y="268" width="148" height="50" rx="8" /><text x="374" y="290">/atelier:amend</text><text x="374" y="308" class="cycle-note">spec signée à corriger</text></g>
  <path d="M374 268 V263 H240" class="cycle-link cycle-amend-link" />
  <path d="M374 318 V338 H240" class="cycle-link cycle-amend-link" />
  <path d="M240 435 H330 V318" class="cycle-link cycle-amend-link" />
  <text x="338" y="400" class="cycle-label" text-anchor="start">spec fausse</text>
</svg>
<figcaption>Pointillés : étape selon le type de chantier ou la décision TDD. La boucle <code>write-tests</code> → <code>build</code> → <code>review</code> tourne une fois par tranche du plan ; la revue du chantier n’existe que s’il y a plusieurs tranches. Un <code>SPIKE</code> sans TDD va de <code>build</code> à <code>close</code>, sans revue obligatoire.</figcaption>
</figure>

<style>
.cycle-diagram { margin: 24px auto; max-width: 460px; }
.cycle-diagram svg { display: block; width: 100%; height: auto; }
.cycle-diagram figcaption { margin-top: 8px; font-size: 14px; color: var(--vp-c-text-2); text-align: center; }
.cycle-step rect { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 1.5; }
.cycle-step text { fill: var(--vp-c-text-1); font-family: var(--vp-font-family-mono); font-size: 14px; text-anchor: middle; }
.cycle-step .cycle-note { fill: var(--vp-c-text-2); font-family: var(--vp-font-family-base); font-size: 12px; }
.cycle-optional rect { stroke-dasharray: 6 4; }
.cycle-final rect { fill: var(--vp-c-brand-soft); }
.cycle-amend rect { stroke: var(--vp-c-warning-1); }
.cycle-link { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.5; marker-end: url(#cycle-arrow); }
.cycle-amend-link { stroke: var(--vp-c-warning-1); stroke-dasharray: 4 3; marker-end: url(#cycle-arrow-amend); }
.cycle-amend-head { fill: var(--vp-c-warning-1); }
.cycle-arrow-head { fill: var(--vp-c-text-2); }
.cycle-label { fill: var(--vp-c-text-2); font-family: var(--vp-font-family-base); font-size: 12px; }
</style>

| Étape | Vous | L’agent | Ce qui la garantit |
|---|---|---|---|
| [1. Intention](../cycle/intention) | Décidez du périmètre et du TDD | Rédige, questionne les manques | Contrôle de complétude |
| [2. Signature](../cycle/signature) | Signez | Prépare, relit de façon critique | Hook : pas de code avant |
| [3. Conception](../cycle/conception) | Challengez, validez | Propose approche et tranches | Votre validation |
| [4. Tests d’abord](../cycle/tests) | Relisez les tests | Écrit les tests, les fait échouer | Hook : seuls les tests sont modifiables |
| [5. Implémentation](../cycle/implementation) | Validez chaque tranche | Code jusqu’au vert | Hooks : tests figés, contrôles verts |
| [6. Revue](../cycle/revue) | Tranchez chaque point, validez chaque revue | Fait relire chaque tranche, puis le chantier ; corrige | Sous-agent indépendant, passage de tranche à votre validation, commit revu enregistré |
| [7. Clôture](../cycle/cloture) | Rendez le verdict | Vérifie, écrit le bilan | Aucun code depuis la revue, votre verdict |
| [Amendement](../cycle/amendement) | Validez à nouveau | Modifie la spec, montre l’impact | Hook : aucune modification sans entrée datée |

## Les portes

Chaque passage d’étape a une **porte** :

- une **porte automatique** quand une machine peut vérifier (spec complète, tests rouges, contrôles verts, code inchangé depuis la revue) ;
- une **porte humaine** quand le jugement ne se délègue pas (signature, plan, amendement, verdict).

C’est la règle centrale : **les hooks font les contrôles, les commandes portent les décisions humaines.** Jamais l’inverse.

Ces contrôles sont des garde-fous contre l’oubli, pas une barrière : voir [Garanties et limites](../reference/limites).

## Les variantes

Tous les chantiers ne prennent pas toutes les étapes :

| Type | Étapes |
|---|---|
| `FEAT` | 1 → 2 → 3 → (4 si TDD) → 5 ⇄ 6 → 7 |
| `FIX` | 1 → 2 → (4 si TDD) → 5 ⇄ 6 → 7, en [voie rapide](../cycle/correction) |
| `REF` | 1 → 2 → 3 → (4 : tests de caractérisation si TDD) → 5 ⇄ 6 → 7 |
| `TEC` | 1 → 2 → 5 ⇄ 6 → 7, spec de trois lignes pour une petite tâche |
| `SPIKE` | 1 → 2 → exploration → 7, revue facultative, rien n’est fusionné |

Pour un chantier découpé en tranches, « (4) → 5 ⇄ 6 » se répète pour chaque tranche du plan, puis une revue du chantier (6) précède la clôture. Un `SPIKE` en TDD suit ce cycle complet, revues comprises.

Détail dans [Types de chantier](../fondations/types).
