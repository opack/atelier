# Deux niveaux de gouvernance

Certaines règles valent pour **tous** vos projets, d’autres pour **un** projet. Les mélanger fait dériver les deux.

## Le socle commun

Ce qui est vrai partout :

- les stacks techniques approuvées ;
- les décisions d’architecture transverses (par langage, par type de projet) ;
- les standards de qualité et la politique de test ;
- les exigences de sécurité.

**Seul**, `~/.claude/CLAUDE.md` suffit au début.

**En équipe**, un dépôt « standards » versionné, référencé par chaque projet.

## Le projet

Ce qui est propre au projet :

- ses frontières et son architecture ;
- les pratiques du client ;
- ses exceptions au socle commun, **datées et justifiées** dans `docs/decisions/`.

Chaque projet **hérite** du socle et le **complète**. Une exception non tracée est une dérive.

## Pourquoi c’est important

Une décision prise une fois dans le socle n’a pas à être redécouverte projet après projet. À l’inverse, une particularité d’un client ne doit pas contaminer les autres projets.
