// @ts-check
// Note: type checking disabled for JavaScript config
// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const {themes} = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Gen Image Factory',
  tagline: 'AI-powered image generation and processing',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://genimage.shiftlinetools.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For subdomain deployment, baseUrl is '/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ShiftlineTools', // GitHub organization handle (no space, used in URLs)
  // Note: Organization display name is "Shiftline Tools" (with space), but handle is "ShiftlineTools"
  // GitHub Pages URL will be: shiftlinetools.github.io (lowercase)
  projectName: 'gen-image-factory', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          path: '../public_docs',
          routeBasePath: '/', // Serve docs at root
          // Remove edit links for now
          editUrl: undefined,
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'Gen Image Factory',
        logo: {
          alt: 'Gen Image Factory Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            type: 'doc',
            docId: 'support/contact',
            position: 'right',
            label: 'Contact',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/getting-started/installation',
              },
              {
                label: 'User Guide',
                to: '/user-guide/settings',
              },
            ],
          },
          {
            title: 'Support',
            items: [
              {
                label: 'Contact Us',
                to: '/support/contact',
              },
              {
                label: 'Troubleshooting',
                to: '/troubleshooting/common-issues',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Gen Image Factory. Built with Docusaurus.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
      },
    }),
};

module.exports = config;

