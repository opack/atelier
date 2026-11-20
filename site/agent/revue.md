# Relire du code généré

Le code généré se relit **comme n’importe quel code**, avec quelques pièges en plus. « L’IA l’a écrit » n’est jamais une explication : l’auteur de la PR répond de chaque ligne.

## La checklist

À copier dans la PR. Cochez, ou écrivez « N/A ».

### Conformité à la spec
- [ ] Chaque CA est couvert par au moins un test qui le cite, et ce test passe
- [ ] Les écarts par rapport à la spec sont justifiés dans le bilan
- [ ] Rien n’a été livré hors périmètre

### Honnêteté du code
- [ ] Toute API, méthode ou option appelée existe (vérifiée dans la doc ou le code, pas dans la mémoire de l’agent)
- [ ] Aucune dépendance ajoutée sans raison ; sinon : maintenue, licence et taille acceptables
- [ ] Les tests testent un comportement ; aucun test supprimé, assoupli ou désactivé
- [ ] Les contrôles ont été relancés par moi ou la CI

### Maintenabilité
- [ ] Rien de sur-conçu (abstraction à un seul usage, option jamais utilisée)
- [ ] Pas de logique dupliquée alors qu’un utilitaire existe
- [ ] Cas limites traités : vide, null, doublon, grand volume, erreur réseau, double clic, concurrence
- [ ] Pas de `catch` muet ; messages d’erreur exploitables
- [ ] Conventions du projet respectées ; pas de code mort
- [ ] Je peux expliquer chaque ligne à voix haute

### Évolutivité
- [ ] Frontières entre couches respectées
- [ ] Pas de couplage nouveau qui bloquerait une évolution prévisible
- [ ] Choix difficiles à défaire consignés (journal ou ADR)

### Sécurité
- [ ] **Autorisation** vérifiée côté serveur à chaque accès (pas seulement l’authentification)
- [ ] Entrées validées ; pas d’injection
- [ ] Aucun secret ni donnée personnelle dans le code ou les logs
- [ ] Règles de sécurité modifiées : tests de règles ajoutés

### Performance
- [ ] Pas de requête dans une boucle, pas de lecture de collection entière
- [ ] Abonnements et écouteurs nettoyés
- [ ] Listes longues paginées ; pas de calcul coûteux au rendu

### Accessibilité
- [ ] Utilisable au clavier, focus visible
- [ ] Rôles et libellés ARIA corrects
- [ ] Contraste suffisant ; information jamais portée par la seule couleur
- [ ] Textes localisés

## Les pièges spécifiques au code généré

- **API inventées** : une méthode qui « devrait » exister mais n’existe pas.
- **Sur-ingénierie** : abstraction, configuration ou couche dont personne n’a besoin.
- **Tests complaisants** : assertions vagues, mocks de ce qu’on teste, tests affaiblis pour passer.
- **Surapprentissage** : code qui satisfait les tests sans résoudre le problème.
- **Duplication** : l’agent réécrit ce qui existe déjà ailleurs dans le code.
