# FIX-31 — décisions

## 2026-11-24 : repli de codeFilesSince en `first-parent`
- Retenu : les fichiers de test candidats viennent de `codeFilesSince(projectRoot, slice_base, 'first-parent')`, comme la revue (`lib/cli/review.mjs`).
- Écarté : repli sans `--diff-merges` (`null`), parce qu'une résolution de conflit sur un test échapperait au contrôle sur un git ancien. Mieux vaut un faux refus, contournable par un regel, qu'un oubli.
- OD1 (overfit-checker), accepté : sur git < 2.36 ou sans ref de la branche par défaut, le repli remet dans les candidats les tests apportés par une fusion de `main` : le faux refus de CA-2 revient dans ce cas, le plantage reste corrigé. Même limite que FIX-28.
