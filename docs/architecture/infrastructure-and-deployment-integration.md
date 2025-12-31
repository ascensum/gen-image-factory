# Infrastructure and Deployment Integration

## Local Guardrails and Policy (Solo Developer)

As a solo developer (no PR flow for now), enforce hygiene and security via local guardrails:

- Emoji/Logging Policy
  - Emojis allowed only in `.md` files; not allowed in source code, logs, or commit messages.
  - Pre-commit hook blocks emoji violations in staged code; commit-msg hook blocks emojis in commit messages.
  - Logging uses consistent levels (debug/info/warn/error); sensitive values (API keys, prompts) are redacted.

- Hygiene Commands
  - `npm run repo:scan` — scan repo for junk artifacts and emoji violations.
  - `npm run repo:clean` — remove known junk (dry-run by default; pass `--yes`).
  - `npm run guardrails:check` — scan + critical tests (exports, retry, labels, security, job flows).

- Workflow
  - Normal commits rely on pre-commit guardrails (fast checks + critical tests).
  - After risky cleanups, run `npm run guardrails:check` manually before tagging a release.

* **Deployment Approach**: The application will be packaged into distributable, platform-specific installers using **`electron-builder`**.
* **Auto-Updates**: Conditional based on runtime environment (Story 1.21):
  - **Windows (Microsoft Store)**: Automatic updates via Windows OS (Store handles updates, no `electron-updater` needed)
  - **Windows (GitHub Releases) / macOS / Linux**: `electron-updater` with GitHub Releases as provider (implemented in Story 1.21)
  - Application code detects runtime environment (`process.windowsStore`) and enables/disables `electron-updater` accordingly
* **Monitoring**: The application will rely on user-submitted bug reports via GitHub Issues, supported by the **"Debug Mode"** logging feature. The application will log detailed errors to a local file when in debug mode.

## Current State vs Plan (2025-11-02)

### Packaging and Distribution
- Current: `package.json` contains an `electron-builder` `build` block with platform icon configuration. Icon assets exist under `build/icons/` and are used in `electron/main.js`.
- Gap: `electron-builder` is not listed as a dependency and no packaging scripts exist (e.g., `dist`, `release`).
- Action:
  - Add `electron-builder` as a devDependency.
  - Add scripts: `"dist": "npm run build && electron-builder"`, and `"release": "npm run build && electron-builder --publish always"` (after CI is ready and `GH_TOKEN` configured).

### Release and Distribution Strategy (Story 1.21)

**Windows Distribution (Primary - Mandatory):**
- **Microsoft Store distribution is mandatory** for Windows users.
- Rationale: Free code signing, avoids SmartScreen/Defender warnings, provides automatic trust and update channel.
- Requirements:
  - Build **MSIX** package in CI (not NSIS/portable)
  - Do **not** sign locally
  - Upload MSIX to Microsoft Store
  - Microsoft Store handles code signing, certificate management, and secure distribution
- **Update Logic:** Application code must detect runtime environment (`process.windowsStore`):
  - **If Store:** Disable internal `electron-updater`. Rely on Windows OS updates.
  - **If GitHub:** Enable `electron-updater` to poll GitHub Releases.

**GitHub Releases (Secondary):**
- Triggered on version tags (`v*`):
  - Publish build artifacts to GitHub Releases
  - Windows artifacts published here may be **unsigned** (for advanced users)
  - GitHub Releases serve as open-source artifact archive and manual install option
- **Artifact Requirements:**
  - All platforms: Windows (MSIX for Store, unsigned for GitHub), macOS (unsigned `.dmg` or `.zip`), Linux (`.AppImage`, `.deb`, or `.rpm`)
  - **SHA-256 checksum file** must be generated alongside binaries for integrity verification
  - **SBOM (Software Bill of Materials)** must be generated for every release (using `cyclonedx-npm` or similar free tool)
- **Release Notes Automation (Story 1.21):**
  - GitHub native release notes generation configured via `.github/release.yml` for automatic categorization of changes
  - Release workflow uses `generate_release_notes: true` to auto-generate categorized release notes from commit messages
  - Helper script `scripts/extract-release-notes.js` available for Microsoft Store submission (extracts formatted release notes from GitHub Releases)
  - npm scripts: `release-notes` and `release-notes:latest` for easy access to release notes
  - Release notes follow Conventional Commits format for proper categorization (features, fixes, dependencies, etc.)
  - Dependabot PRs are automatically labeled with `dependencies` and `automated` labels for proper categorization in release notes
- **Rollback:** Users can download and reinstall any prior version from Releases. Document this in the README/website.
- **Build Isolation:** Builds must run on clean runner instances (GitHub Actions standard). No local builds accepted for release candidates.

### Auto-Updates (Story 1.21)

**Platform-Specific Update Strategy:**

- **Windows (Microsoft Store):**
  - Disable internal `electron-updater` when running from Store
  - Rely on Windows OS automatic updates via Microsoft Store
  - Application code must detect `process.windowsStore` and disable `electron-updater` accordingly

- **Windows (GitHub Releases) / macOS / Linux:**
  - Use `electron-updater` with GitHub Releases as provider
  - Implementation: `electron-updater` dependency, `autoUpdater` initialization in `electron/main.js`
  - Check for updates on app ready, handle update events, expose IPC to trigger manual checks
  - Configure `publish` in `electron-builder` (GitHub provider) and set `GH_TOKEN` in CI
  - Only enable `electron-updater` when NOT running from Microsoft Store

### CI/CD
- **Current State:** CI workflows are present in the repository (see `.github/workflows/ci.yml` - Story 1.20).
- **Architecture:** Follows the two-layer approach:
  - **Layer 1:** Local pre-commit validation (fast, blocking)
  - **Layer 2:** CI/CD on GitHub (deep validation, security scanning, release automation)

### CI/CD Workflow Design (Solo Dev, direct-to-main)

- **Triggers:**
  - **CI: QA & Security Stage:** `on: push` to `main`.
    - Purpose: Deep security analysis, supply-chain protection, and validation on clean machine.
    - Jobs: Build, Unit/Integration Tests, Security-Sensitive Logic Tests, Static Analysis (Semgrep, CodeQL), Supply-Chain Scans (Socket.dev, npm audit).
    - Failure Policy: Blocking. Fix immediately.
    - **Note:** E2E tests are periodic/optional (nightly, on version tags, or manual via `workflow_dispatch`), not on every push.
  - **Automated Release Pipeline:** `on: push` tags (e.g., `v*.*.*`).
    - Purpose: Create and publish release artifacts with integrity guarantees.
    - Jobs: `electron-builder` matrix (Windows/Mac/Linux).
    - Output: Build artifacts with SHA-256 checksums and SBOM (Software Bill of Materials) uploaded to GitHub Releases.

- **CI Jobs (aligned with prioritized architecture):**
  - **Dependency Installation:** `npm ci --ignore-scripts` (supply-chain safe, enforces lockfile, blocks install-time malware)
  - **Build:** `npm run build`
  - **Tests:** Unit tests, integration tests, security-sensitive logic tests (on every push)
  - **Static Analysis:**
    - Semgrep (full scan, broader ruleset)
    - CodeQL (JavaScript)
    - npm audit (high severity only)
    - Socket.dev CLI (`npx socket audit`)
  - **Supply-Chain Protection (Mandatory):**
    - Lockfile usage (`npm ci --ignore-scripts`)
    - Socket.dev scanning
    - Dependabot configured for npm ecosystem (`.github/dependabot.yml`) with weekly updates (Mondays at 9:00 AM), grouped minor/patch PRs, optional auto-merge support, and PR limit of 10 open PRs. Dependabot PRs run full CI suite to catch breakages before merge.
    - Pinned action versions
    - Minimal permissions (`contents: read`)

- **Refinements:**
  - **Clean Room Validation:** CI runs on every push to `main` to verify build/tests on a clean machine.
  - **Automated Release Pipeline:** Triggered by **Git Tags** (e.g., `v1.0.0`) automatically builds `electron-builder` artifacts and uploads to GitHub Releases.
  - **Concurrency:** Uses `concurrency` group on `main` with `cancel-in-progress: true` to stop outdated runs.
  - **Scheduled Security:** Weekly CodeQL scheduled job in addition to push events.
  - **Semgrep Hygiene:** Exclude heavy directories (`node_modules`, `playwright-report`, `web-bundles`, built assets) via `.semgrepignore`. Configuration uses command-line flags (`--config=p/owasp-top-ten --config=p/javascript`) due to Semgrep 1.146.0 YAML config compatibility limitation. **Note**: `p/owasp-electron` does not exist; `p/owasp-top-ten` covers Electron security concerns.
  - **Artifact Integrity:** Every release must include SHA-256 checksums and SBOM (Software Bill of Materials) for auditability.

### Code-Signing (Future)
- Not configured yet. Document platform-specific signing steps (Apple Developer ID, Windows code signing) before public distribution.

### Microsoft Store Identity Management

**Current Identity (Shiftline Tools Organization):**
- Identity Name: `ShiftlineTools.GenImageFactory` (immutable Store identity, internal only)
- Publisher: `CN=25094057-9D25-4368-831B-EF71134D46D6`
- Publisher Display Name: `Shiftline Tools` (user-visible brand)
- Store ID: `9P761655KPBW`
- Package Family Name (PFN): `ShiftlineTools.GenImageFactory_0gwrxd6wp7ebt`
- Package SID: `S-1-15-2-1705884162-2587684083-2754433856-416162892-334062652-2777467336-848623385`
- Configuration: `package.json#build.appx`

**Identity Migration Completed (Story 2.7):**
- New Microsoft Store identity created in Partner Center connected to Shiftline Tools brand
- Identity Name, Publisher ID, and Store ID obtained and configured
- `package.json#build.appx` updated with new identity properties
- All documentation references updated (`docs/microsoft-store-guide.md`, PRD, Architecture)
- Migration process documented

**Configuration Management:**
- Store identity properties are centralized in `package.json#build.appx`
- All documentation must reference the same identity properties
- Identity changes require updates to: package.json, microsoft-store-guide.md, PRD, Architecture docs
- CI/CD workflows may need updates if identity affects build process

**Build Process Impact:**
- Identity properties are embedded in MSIX package during build
- Identity changes require new package builds (cannot update existing packages)
- Identity validation should be part of build verification process

### Documentation Website Deployment (Epic 2)

**Overview:**
- **Technology:** Docusaurus static site generator
- **Location:** `/website` directory (separate from main Electron app)
- **Content Source:** `docs/public_docs/` directory (privacy firewall enforced)
- **Deployment Target:** GitHub Pages (or alternative hosting provider)

**Deployment Strategy:**
- **Automated Deployment:** GitHub Actions workflow (`.github/workflows/deploy-site.yml`)
- **Trigger:** Push to `main` branch or manual `workflow_dispatch`
- **Build Process:** 
  - Install dependencies in `/website` directory (`npm ci`)
  - Run version fetch script (`website/scripts/fetch-version.js`) to update version cache from GitHub Releases API
  - Build Docusaurus site (`npm run build`)
  - Deploy static site from `/website/build` to GitHub Pages

**Website Dependencies (Story 2.6):**
- **Core Dependencies:**
  - `@docusaurus/plugin-google-gtag` - Google Analytics 4 integration
  - `react-cookie-consent` - Cookie consent banner component
  - `@easyops-cn/docusaurus-search-local` - Full-text search functionality
  - `lucide-react` - Icon library for consistent iconography
- **Build Scripts:**
  - Version fetch script (`website/scripts/fetch-version.js`) runs automatically before build/start
  - Version cached in `.version-cache.json` with 1-hour TTL
  - npm hooks configured to run version fetch on build/start commands
- **Custom Domain:** Configured via CNAME file in `/website/static/`
- **HTTPS:** Automatic via GitHub Pages (Let's Encrypt)

**Privacy Firewall:**
- **Content Source:** Only `docs/public_docs/` is included in build
- **Excluded:** All internal documentation (PRD, stories, architecture, logs) is explicitly excluded
- **Validation:** Deployment workflow validates privacy firewall before deployment

**Deployment Workflow:**
- Build runs in clean CI environment
- Deployment gated by successful build
- Rollback via commit revert or manual redeploy
- Deployment status visible in GitHub Actions

**Website Page Structure:**
- **Home Page**: Custom React component (`website/src/pages/index.tsx`) with hero section, Shiftline Tools branding, key features, call-to-action buttons, version badge, Bento Grid feature cards, Integrated Platforms/APIs section, and Recommended Apps section
- **Documentation Pages**: Markdown files in `public_docs/` consumed by Docusaurus
- **Legal Pages**: Privacy Policy (`public_docs/legal/privacy-policy.md`) and Terms of Service (`public_docs/legal/terms-of-service.md`) accessible from footer, sidebar, and installation guide
- **Resources Page**: Markdown file (`public_docs/resources.md`) for affiliate links and third-party service credits
- **Routing**: Docusaurus routes home page to custom React component, documentation to markdown files

**Custom React Components:**
- Hero home page component (`website/src/pages/index.tsx`) replaces standard docs index
  - Hero section with Blue Lamp Glow effect and technical SVG grid
  - Version badge automatically fetches latest version from GitHub Releases API
  - Asymmetrical Bento Grid with 6 interactive feature cards
  - Integrated Platforms/APIs section with monospace links
  - Recommended Apps section with 2-column Bento Grid
- Root component (`website/src/theme/Root.tsx`) manages GA4 consent lifecycle
- Custom mobile menu components for consistent navigation across all pages
- Components must maintain privacy firewall (no internal docs references)

**Visual Design System (Industrial Zen):**
- **Permanent Dark Mode**: Theme locked to dark mode only (`#050505` background, no theme toggle)
- **Color Palette**:
  - Primary Background: `#050505`
  - Surface/Card Background: `#0d0d0d`
  - Accent Color: Shiftline Blue (`#3b82f6`) - used only for Download button, Lamp Glow, active sidebar/link, search highlights
  - Borders: Muted Silver-Gray `rgba(255, 255, 255, 0.08)`
  - Typography: Pure White (`#ffffff`) primary, soft Gray (`#a3a3a3`) secondary
- **Typography**: Monospace font stack (Inter/system-sans) with letter-spacing for Industrial Zen aesthetic
- **Bento Grid Layout**: Asymmetrical grid with glassmorphism effects (`rgba(255,255,255,0.03)` background)
- **Glassmorphism Navbar**: Transparent with `backdrop-filter: blur(12px)` (desktop only, >= 996px)
- **Hero Enhancements**: Blue Lamp Glow effect (`#3b82f6` at 10% opacity), technical SVG grid with radial mask
- **Code Blocks**: Dark theme (`#0d0d0d` background) with Shiftline Blue syntax highlighting
- **Scrollbars**: Thin, dark style (`#1a1a1a` background)

**Full-Text Search:**
- **Plugin**: `@easyops-cn/docusaurus-search-local`
- **Configuration**: Indexes docs and static pages (`indexDocs: true, indexPages: true`)
- **Features**: OS-aware keyboard shortcuts (⌘K on Mac, Ctrl+K on Windows/Linux), search term highlighting on target pages
- **Styling**: Industrial Zen design matching navbar glassmorphism, dark card background with Shiftline Blue accents, monospace typography for results
- **Mobile Optimization**: Hidden title, visible search icon, compact layout

**Version Badge System:**
- Automatically displays latest GitHub release version from GitHub Releases API
- Version fetching script (`website/scripts/fetch-version.js`) runs before build/start
- Version cached in `.version-cache.json` with 1-hour TTL
- Falls back to `package.json` version if GitHub API is unavailable
- Monospaced pill badge positioned directly under "Gen Image Factory" heading

**Config-as-Code Approach:**
- **Data Structure**: `website/src/data/ecosystem.js` contains `PARTNER_DATA` constant
- **Integrated APIs**: Array of API services (RUNWARE.COM, OPENAI, REMOVE.BG) with direct links to homepages
- **Recommended Apps**: Array of recommended applications (Topaz Labs Gigapixel, Flying Upload) with descriptions and links
- **Benefits**: Easy link management and future affiliate integration without code changes

**Privacy Firewall Validation:**
- All new pages must be validated to ensure no internal documentation references
- Legal pages must be accessible from footer and sidebar navigation
- Resources page must maintain transparency about third-party services

**Legal Pages Integration (Story 2.5):**
- **Privacy Policy**: `public_docs/legal/privacy-policy.md` - Comprehensive privacy policy covering:
  - Data collection practices (individual developer focused)
  - API key storage and security (keytar, encrypted database fallback)
  - Local data handling (no cloud data collection)
  - Third-party services disclosure (OpenAI, Runware, Remove.bg)
  - User rights and data access
  - Microsoft Store privacy requirements compliance
  - GDPR considerations
- **Terms of Service**: `public_docs/legal/terms-of-service.md` - Comprehensive terms covering:
  - Software license terms (individual developer)
  - Usage restrictions
  - Liability disclaimers
  - Microsoft Store terms compliance
  - API usage terms (OpenAI, Runware, Remove.bg)
  - Intellectual property rights
- **Navigation Integration**:
  - Legal section added to website sidebar (`website/sidebars.js`)
  - Legal links section added to website footer (`website/docusaurus.config.js`)
  - Legal Information section added to installation guide (`public_docs/getting-started/installation.md`)
  - All content emphasizes individual developer context (Shiftline Tools, not corporate entity)

**Mobile Responsiveness and Navigation:**
- **Responsive Design**: Mobile-first approach with breakpoints at 996px (Docusaurus standard)
- **Mobile Menu**: Custom mobile menu components ensure visibility on all pages (docs, static pages)
  - Industrial Zen styling (monospace, uppercase, blue accents) applied consistently
  - Fixed mobile menu visibility issues across all page types
- **Touch Feedback**: Mobile-specific touch feedback (`:active` states) for CTA buttons and integration links
- **Responsive Layouts**:
  - Bento Grid stacks to 1 column on mobile
  - Integration brand links scale from horizontal (desktop) to vertical (mobile) using `clamp()`
  - Footer columns center-align on mobile (max-width: 996px)
  - Search interface optimized for mobile (hidden title, visible search icon, compact layout)
- **Navigation Structure**:
  - Desktop navbar uses glassmorphism with Industrial Zen styling
  - Mobile menu uses consistent styling across all pages
  - "Documentation" menu item positioned on right side (after "About")
  - Resources page accessible from both navbar and sidebar

**Analytics and Consent Management (Microsoft Store Compliance):**
- **Google Analytics 4 (GA4)**: Integrated via `@docusaurus/plugin-google-gtag`
  - Measurement ID: `G-X2N1PZ3PYX`
  - IP anonymization enabled (`anonymizeIP: true`)
  - Configured in `website/docusaurus.config.js`
- **Consent Mode v2**: Required for GDPR and privacy compliance
  - Default deny state: All analytics and ad storage denied by default
  - Consent state initialized before GA4 loads via `window.dataLayer` and `gtag('consent', 'default')`
  - Consent script injected via custom Root component (`website/src/theme/Root.tsx`)
  - Consent Mode v2 ensures no tracking occurs before user consent
- **Cookie Consent Banner**: Implemented via `react-cookie-consent` library
  - Custom Root component (`website/src/theme/Root.tsx`) manages consent lifecycle
  - Accept/Decline buttons with clear disclosure text
  - Consent state persisted via cookie (`gen-image-factory-consent`, 365-day expiration)
  - Styled to match website dark theme (Industrial Zen design)
  - Includes application version in consent text
  - On user acceptance, updates GA4 Consent Mode to `granted` state
- **Implementation Architecture:**
  - Root component initializes Consent Mode v2 with default deny before any GA4 scripts load
  - Cookie consent banner rendered at application root level
  - Consent state changes trigger GA4 Consent Mode updates via `gtag('consent', 'update')`
  - All analytics tracking respects user consent preferences
  - No tracking occurs if user declines consent
- **Compliance Requirements:**
  - Privacy Policy must disclose analytics usage and cookie practices
  - Terms of Service must reference cookie usage and consent requirements
  - All analytics tracking requires explicit user consent
  - Consent state must be clearly communicated to users

**Related Stories:**
- Story 2.1: Docs Structure Migration & Firewall
- Story 2.2: Docusaurus Scaffolding & Branding
- Story 2.3: Website Deployment
- Story 2.5: Legal Pages for Microsoft Store Compliance
- Story 2.6: Website Hero Home Page and Resources Page

## Security Deployment Considerations

### Secure Storage Requirements
* **Native OS Keychain**: The application uses `keytar` for secure API key storage in the native OS credential manager
* **Platform Support**: Keychain (macOS), Credential Manager (Windows), Secret Service (Linux)
* **Fallback Strategy**: When keytar is unavailable, the application falls back to plain text storage (development mode)
* **Future Enhancement**: Story 1.13 will implement encrypted database fallback for production environments

### Security Status Communication
* **User Messaging**: The application communicates security status to users through the UI
* **Storage Method Indicators**: Users are informed about the current storage method and security level
* **Development vs Production**: Clear distinction between development (plain text) and production (encrypted) storage

### Memory Protection
* **API Key Handling**: API keys are cleared from memory on application exit
* **Log Masking**: Sensitive data is masked in logs and error messages
* **Secure String Handling**: API key operations use secure string handling practices

### Cross-Platform Compatibility
* **Security Feature Testing**: All security features must be tested across target platforms
* **Credential Manager Integration**: Native OS credential manager integration varies by platform
* **Fallback Mechanism**: Robust fallback mechanisms ensure application functionality across different environments

## Security Monitoring and Logging

### Debug Mode Security
* **Sensitive Data Masking**: Debug logs mask API keys and sensitive information
* **Security Status Logging**: Application logs security status changes and fallback events
* **Error Handling**: Security-related errors are logged with appropriate detail levels

### User Communication
* **Security Status UI**: Real-time security status display in the user interface
* **Storage Method Indicators**: Clear indication of current storage method and security level
* **Future Enhancement Messaging**: Users are informed about upcoming security improvements 