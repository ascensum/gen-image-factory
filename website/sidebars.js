// @ts-check
// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 * - create an ordered group of docs
 * - render a sidebar for each doc of that group
 * - provide next/previous navigation
 *
 * The sidebars can be generated from the filesystem, or explicitly defined here.
 *
 * Create as many sidebars as you want.
 */
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Generate sidebar from public_docs directory structure
  docsSidebar: [
    {
      type: 'doc',
      id: 'README',
      label: 'Home',
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/settings',
        'user-guide/dashboard',
        'user-guide/job-management',
        'user-guide/failed-images-review',
        'user-guide/export',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
      ],
    },
    {
      type: 'category',
      label: 'Support',
      items: [
        'support/contact',
      ],
    },
  ],
};

module.exports = sidebars;

