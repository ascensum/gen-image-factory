// @ts-check
// Note: type checking disabled for JavaScript config
// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const {themes} = require('prism-react-renderer');
const fs = require('fs');
const path = require('path');

// Function to fetch latest version from GitHub Releases (synchronous with fallback)
function getLatestVersionFromGitHubSync() {
  try {
    // Try to read from cache file first (updated by build script)
    const cacheFile = path.join(__dirname, '.version-cache.json');
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      // Use cache if it's less than 1 hour old
      if (Date.now() - cache.timestamp < 3600000) {
        return cache.version;
      }
    }
  } catch (_error) {
    // Ignore cache errors
  }
  
  // Fallback to package.json
  const rootPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
  );
  return rootPackageJson.version || '1.0.0';
}

// Get version - use cached GitHub version or fallback to package.json
const appVersion = getLatestVersionFromGitHubSync();

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Gen Image Factory',
  tagline: 'AI-powered image generation and processing by Shiftline Tools',
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
          // routeBasePath: '/', // Removed to allow src/pages/index.tsx to serve home
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

  plugins: [
    [
      '@docusaurus/plugin-google-gtag',
      {
        trackingID: 'G-X2N1PZ3PYX',
        anonymizeIP: true,
      },
    ],
  ],

  customFields: {
    appVersion: appVersion,
  },

  // Inject consent mode script before GA4 loads
  scripts: [
    {
      src: '/consent-mode.js',
      async: false,
      defer: false,
    },
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: true,
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
            type: 'doc',
            docId: 'about',
            position: 'right',
            label: 'About',
          },
          {
            type: 'doc',
            docId: 'getting-started/installation',
            position: 'right',
            label: 'Documentation',
          },
          {
            type: 'doc',
            docId: 'resources',
            position: 'right',
            label: 'Resources',
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
                to: '/docs/getting-started/installation',
              },
              {
                label: 'User Guide',
                to: '/docs/user-guide/settings',
              },
            ],
          },
          {
            title: 'Support',
            items: [
              {
                label: 'Contact Us',
                to: '/docs/support/contact',
              },
              {
                label: 'Troubleshooting',
                to: '/docs/troubleshooting/common-issues',
              },
            ],
          },
          {
            title: 'Shiftline Tools',
            items: [
              {
                label: 'About',
                to: '/docs/about',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/ShiftlineTools/gen-image-factory',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Privacy Policy',
                to: '/docs/legal/privacy-policy',
              },
              {
                label: 'Terms of Service',
                to: '/docs/legal/terms-of-service',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Shiftline Tools.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
      },
    }),
};

module.exports = config;

