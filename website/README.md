# Gen Image Factory Documentation Website

This directory contains the Docusaurus-based documentation website for Gen Image Factory.

## Overview

The documentation site is built with Docusaurus and consumes content from `../public_docs/`. The site is configured with:
- Dark mode theme matching the Tauri desktop application
- Automatic sidebar generation from `public_docs/` directory structure
- Modern, responsive design

## Local Development

### Prerequisites

- Node.js >= 20.0
- npm

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The site will be available at `http://localhost:3000` with hot reload enabled.

### Development Workflow

- Content changes in `../public_docs/` are automatically reflected in the dev server
- The dev server supports hot reload for both content and configuration changes
- Use `Ctrl+C` to stop the development server

## Building

To build the static site for production:

```bash
npm run build
```

The built site will be generated in the `build/` directory and is ready for deployment to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

### Testing the Build

To test the production build locally:

```bash
npm run serve
```

This serves the built site from `build/` directory.

## Content Management

### Adding Content

1. Add or edit markdown files in `../public_docs/`
2. The sidebar is automatically generated from the directory structure
3. Update `sidebars.js` if you need custom sidebar organization

### Content Structure

The site consumes content from `../public_docs/` with the following structure:
- `getting-started/` - Installation and setup guides
- `user-guide/` - Feature documentation and usage guides
- `troubleshooting/` - Common issues and solutions
- `README.md` - Main landing page

### Linking Between Pages

When linking between documentation pages, use absolute paths starting with `/`:
- ✅ Good: `/user-guide/settings`
- ✅ Good: `/troubleshooting/common-issues`
- ❌ Bad: `../user-guide/settings.md`
- ❌ Bad: `../../troubleshooting/common-issues.md`

## Configuration

### Main Configuration

The main configuration is in `docusaurus.config.js`:
- Site metadata (title, tagline, URL)
- Theme configuration (dark mode)
- Content path (`../public_docs/`)
- Sidebar configuration

### Theme Customization

Theme colors and styling are defined in `src/css/custom.css`. The theme uses:
- Dark mode as default
- Modern color scheme matching the Tauri application
- Custom typography and spacing

### Sidebar Configuration

The sidebar is configured in `sidebars.js`. It can be:
- Auto-generated from directory structure
- Manually defined for custom organization

## Deployment

The build output in `build/` is a static site that can be deployed to any static hosting service.

### GitHub Pages

1. Build the site: `npm run build`
2. Push the `build/` directory to the `gh-pages` branch
3. Configure GitHub Pages to serve from the `gh-pages` branch

### Netlify/Vercel

1. Connect your repository
2. Set build command: `cd website && npm install && npm run build`
3. Set publish directory: `website/build`
4. Deploy

## Troubleshooting

### Build Errors

- **Broken links**: Ensure all internal links use absolute paths starting with `/`
- **Missing content**: Verify files exist in `../public_docs/`
- **Sidebar issues**: Check `sidebars.js` configuration

### Development Server Issues

- Clear cache: `npm run clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: Requires >= 20.0

## Project Structure

```
website/
├── docusaurus.config.js    # Main Docusaurus configuration
├── sidebars.js            # Sidebar configuration
├── package.json           # Dependencies and scripts
├── src/
│   ├── css/
│   │   └── custom.css     # Theme customization
│   └── pages/             # Custom pages (if any)
├── static/
│   └── img/               # Static assets (logo, favicon)
└── build/                 # Build output (generated)
```

## Related Documentation

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Story 2.2: Docusaurus Scaffolding & Branding](../../docs/stories/2.2.docusaurus-scaffolding-and-branding.story.md)
- [Public Documentation](../../public_docs/README.md)
