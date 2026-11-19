---
description: Clôture le chantier actif — contrôles, revue indépendante, bilan, verdict humain, PR.
disable-model-invocation: true
---

# Clôturer le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

## 1. Contrôles

- `atelier status --json` : il faut une spec signée (ou un débrayage actif).
- `atelier checks` : tous les contrôles doivent être verts. Sinon, corrige ou arrête-toi avec l'utilisateur.
- `atelier tests-changed` (si `tdd: yes`) : aucun test ne doit avoir été modifié depuis leur commit. Sinon, arrête-toi : c'est un point bloquant à expliquer à l'utilisateur.
- Vérifie que le travail est commité, et que chaque commit du chantier porte `[<ID>]`.

## 2. Revue indépendante

Lance le sous-agent `atelier:reviewer` en lui donnant : le chemin de la spec, du plan et du journal s'ils existent, et la base de comparaison (`git merge-base HEAD <branche par défaut>`). Présente ses points classés **bloquant** / **à discuter**, avec fichier:ligne.

Pour chaque point bloquant : corriger (avec l'accord de l'utilisateur, un commit `[<ID>]`) ou l'accepter explicitement comme exception. Relance `atelier checks` après correction.

## 3. Bilan

À partir de la spec, du plan, de `decisions.md`, du diff et de la revue, écris `bilan.md` depuis `atelier template bilan` :
- **Livré vs spécifié** : chaque `CA` avec son statut et le test qui le couvre.
- **Choix techniques**, **éléments de code principaux** (ce qu'un nouveau venu doit lire en premier), **pistes écartées**, **dette et suites**.
- Pour un `FIX` : la cause réelle, confirmée ou non par rapport à la cause probable, et les autres endroits où le même schéma existe.
- Pour un `SPIKE` : la réponse à la question, et la suite (ADR, nouveau chantier, abandon).
- Une décision qui dépasse le chantier : propose un ADR dans `docs/decisions/` (`atelier template adr`).

Fais relire le bilan à l'utilisateur.

## 4. Verdict

Demande le verdict à l'utilisateur : **accepté**, **accepté avec exceptions** (lesquelles), ou **refusé** (que faut-il reprendre). Seule sa réponse explicite vaut verdict. Reporte-le dans la section « Verdict de revue » avec son nom et la date.

Si accepté :
1. `atelier set-status done` ; `atelier bypass off`.
2. Commite : `docs(chantiers): [<ID>] close`.
3. Propose la PR : titre `[<ID>] <titre>`, description avec le résumé du bilan et les liens vers `spec.md` et `bilan.md`. Ne la crée que si l'utilisateur le demande.
