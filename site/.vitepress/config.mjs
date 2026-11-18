import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'fr-FR',
  title: 'atelier',
  description: 'Une méthode artisanale pour développer avec l’IA : chantiers, spec signée, tests d’abord, revue indépendante, bilan.',
  base: '/atelier/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Démarrage rapide', link: '/guide/demarrage-rapide' },
      { text: 'La méthode', link: '/fondations/principes' },
      { text: 'Référence', link: '/reference/commandes' },
    ],
    sidebar: [
      {
        text: 'Commencer',
        items: [
          { text: 'Pourquoi atelier ?', link: '/guide/pourquoi' },
          { text: 'Démarrage rapide', link: '/guide/demarrage-rapide' },
          { text: 'Vue d’ensemble du cycle', link: '/guide/vue-ensemble' },
        ],
      },
      {
        text: 'Les fondations',
        items: [
          { text: 'Principes', link: '/fondations/principes' },
          { text: 'Le chantier', link: '/fondations/chantier' },
          { text: 'Types de chantier', link: '/fondations/types' },
          { text: 'La trace : dossier de chantier', link: '/fondations/trace' },
        ],
      },
      {
        text: 'Le cycle d’un chantier',
        items: [
          { text: '1. Intention : écrire la spec', link: '/cycle/intention' },
          { text: '2. Signature', link: '/cycle/signature' },
          { text: '3. Conception', link: '/cycle/conception' },
          { text: '4. Tests d’abord (TDD)', link: '/cycle/tests' },
          { text: '5. Implémentation', link: '/cycle/implementation' },
          { text: '6. Clôture : revue et bilan', link: '/cycle/cloture' },
          { text: 'Corriger un bug : la voie rapide', link: '/cycle/correction' },
          { text: 'Urgence : le débrayage', link: '/cycle/debrayage' },
        ],
      },
      {
        text: 'Préparer le projet',
        items: [
          { text: 'Installer atelier', link: '/projet/installation' },
          { text: 'Écrire le CLAUDE.md', link: '/projet/claude-md' },
          { text: 'Règles, mémoire et décisions', link: '/projet/contexte' },
          { text: 'Deux niveaux de gouvernance', link: '/projet/gouvernance' },
        ],
      },
      {
        text: 'Travailler avec l’agent',
        items: [
          { text: 'Modes, modèles et effort', link: '/agent/modes' },
          { text: 'Sessions et worktrees', link: '/agent/sessions' },
          { text: 'Relire du code généré', link: '/agent/revue' },
          { text: 'Ce qui reste humain', link: '/agent/responsabilites' },
        ],
      },
      {
        text: 'Au-delà du solo',
        items: [
          { text: 'En équipe', link: '/equipe/equipe' },
          { text: 'Chez un client ou en entreprise', link: '/equipe/entreprise' },
          { text: 'Mesurer', link: '/equipe/mesure' },
        ],
      },
      {
        text: 'Référence',
        items: [
          { text: 'Commandes', link: '/reference/commandes' },
          { text: 'Hooks et configuration', link: '/reference/configuration' },
          { text: 'Templates', link: '/reference/templates' },
          { text: 'Glossaire', link: '/reference/glossaire' },
        ],
      },
    ],
    outline: { level: [2, 3], label: 'Sur cette page' },
    docFooter: { prev: 'Précédent', next: 'Suivant' },
    lastUpdated: { text: 'Mis à jour le' },
    returnToTopLabel: 'Haut de page',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Thème',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Rechercher' },
          modal: { noResultsText: 'Aucun résultat pour', footer: { selectText: 'choisir', navigateText: 'naviguer', closeText: 'fermer' } },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/opack/atelier' }],
    editLink: { pattern: 'https://github.com/opack/atelier/edit/main/site/:path', text: 'Proposer une modification' },
    footer: { message: 'Inspiré des principes de gouvernance de Solario et des bonnes pratiques Anthropic pour le développement agentique.' },
  },
})
