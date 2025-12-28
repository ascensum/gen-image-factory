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

**Current Identity (Legacy - Personal Account):**
- Identity Name: `AscensumTools.GenImageFactory` (immutable Store identity, internal only)
- Publisher: `CN=E312E730-261C-4C09-AA08-642C4C57E8F8`
- Publisher Display Name: `Shiftline Tools` (user-visible brand)
- Store ID: `9P0D8CQ3R86F`
- Configuration: `package.json#build.appx`

**Identity Migration Process (Story 2.7):**
- Create new Microsoft Store identity in Partner Center connected to Shiftline Tools brand
- Obtain new Identity Name, Publisher ID, and Store ID
- Update `package.json#build.appx` with new identity properties
- Update all documentation references (`docs/microsoft-store-guide.md`, PRD, Architecture)
- Validate MSIX package builds with new identity
- Verify package can be submitted to Store with new identity
- Document migration checklist and process

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
  - Build Docusaurus site (`npm run build`)
  - Deploy static site from `/website/build` to GitHub Pages
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
- **Home Page**: Custom React component (`website/src/pages/index.tsx` or `.js`) with hero section, Shiftline Tools branding, key features, and call-to-action buttons
- **Documentation Pages**: Markdown files in `public_docs/` consumed by Docusaurus
- **Legal Pages**: Privacy Policy and Terms of Service in `public_docs/legal/` or `public_docs/`
- **Resources Page**: Markdown or React component for affiliate links and third-party service credits
- **Routing**: Docusaurus routes home page to custom React component, documentation to markdown files

**Custom React Components:**
- Hero home page component replaces standard docs index
- Resources/affiliate page component (optional, can be markdown)
- Components must maintain privacy firewall (no internal docs references)

**Privacy Firewall Validation:**
- All new pages must be validated to ensure no internal documentation references
- Legal pages must be accessible from footer and sidebar navigation
- Resources page must maintain transparency about third-party services

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