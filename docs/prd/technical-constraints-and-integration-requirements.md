# Technical Constraints and Integration Requirements

## Existing Technology Stack

The enhancement will be built upon the existing technology stack. New components must be compatible with these core technologies:

| Category | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v16+) |
| **AI Integration**| Runware (primary), OpenAI for QC/metadata, Remove.bg for background removal |
| **Image Processing**| `sharp` (^0.32.0) |
| **Data Handling**| `exceljs` (^4.x), `csv-parser` (^3.2.0) |
| **HTTP Client** | `axios` (^1.3.1) |

## Integration Approach

* **Process Model**: The application will use Electron's Main Process for the Node.js backend logic and the Renderer Process for the UI.
* **Communication Bridge**: All communication will go through the **Backend Adapter** (NFR5), which will manage asynchronous communication between the two processes.
* **Error Handling**: The Backend Adapter will catch technical errors and translate them into user-friendly messages.

## Code Organization and Standards

A new `/electron` directory will be created to house all UI and Electron-specific code, keeping it separate from the existing `/src` backend logic.

## Deployment and Operations

The final application will be packaged using `electron-builder` to generate distributable installers for Windows, macOS, and Linux.

*   **Automated Cloud Builds:** Releases are built automatically by GitHub Actions when a tag is pushed.
*   **Source of Truth:** The GitHub Releases page is the official source for all distribution artifacts. Local builds are for development and debugging only.

### Release and CI Policy (2025-11-02)

- **Automated Release Pipeline**: Triggered by Git Tags (e.g., `v*.*.*`) automatically builds `electron-builder` artifacts and uploads to GitHub Releases (Story 1.21)
- **Artifact Integrity**: SHA-256 checksums and SBOM (Software Bill of Materials) required for every release
- **Release Notes Automation**: GitHub native release notes generation configured via `.github/release.yml` for automatic categorization of changes. Release workflow uses `generate_release_notes: true` to auto-generate categorized release notes from commit messages following Conventional Commits format. Helper script `scripts/extract-release-notes.js` available for Microsoft Store submission. npm scripts `release-notes` and `release-notes:latest` provide easy access to release notes (Story 1.21)
- **Auto-Update**: Conditional based on runtime environment (Windows Store uses OS updates; GitHub Releases uses `electron-updater`)
- Historical releases kept for rollback capability
- CI quality gates: run unit/integration/E2E tests, CodeQL (JavaScript/TypeScript with security-extended queries), Semgrep (OWASP Top 10 + JavaScript - see NFR7), Socket.dev (supply-chain scanning), `npm audit` (high severity only, mandatory in CI), and Dependabot (automated dependency updates via `.github/dependabot.yml` with weekly updates, grouped PRs, optional auto-merge). CodeQL must run on every push AND as a weekly scheduled job to catch security drift. E2E tests run periodically (nightly scheduled, on version tags, or manual via workflow_dispatch), not on every push. All active E2E tests must pass (tests requiring Electron backend are properly skipped; backend functionality is covered by integration tests). High‑risk findings fail CI; network retry logic ensures reliability.

### Dual-Channel Distribution Policy

- **Windows Distribution**:
  - **Primary Channel**: Microsoft Store ($0 cost signed MSIX packages) - mandatory distribution channel
  - **Secondary Channel**: GitHub Releases (unsigned NSIS installer) - for advanced users requiring offline installation or bypassing Store restrictions
- **macOS/Linux Distribution**:
  - **Primary Channel**: GitHub Releases with `electron-updater` support for automatic updates

### Microsoft Store Identity Profile

The Microsoft Store Identity Profile is immutable and defines the internal vs. public brand separation:

- **Identity Name**: Stored in GitHub secret `MS_STORE_IDENTITY_NAME` (Internal only - not user-visible)
- **Publisher**: Stored in GitHub secret `MS_STORE_PUBLISHER_ID`
- **Publisher Display Name**: Stored in GitHub secret `MS_STORE_PUBLISHER_DISPLAY_NAME` (User-visible brand)
- **Store ID**: Stored in GitHub secret `MS_STORE_STORE_ID`
- **Package Family Name (PFN)**: Stored in GitHub secret `MS_STORE_PACKAGE_FAMILY_NAME`
- **Package SID**: Stored in GitHub secret `MS_STORE_PACKAGE_SID`

**Configuration**: Values are stored in GitHub secrets for security and CI/CD automation. See `docs/microsoft-store-secrets-setup.md` for setup instructions.

### Deployment Assets

- **System-Level Icons**: Production installers must use the textless version of the circular Factory Logo for all system-level icons (.ico, .icns, .png).