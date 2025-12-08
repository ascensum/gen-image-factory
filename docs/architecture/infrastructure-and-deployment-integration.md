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
* **Auto-Updates**: Not enabled initially. Users update manually by downloading new assets from **GitHub Releases**. In the future, after signing/notarization and (optionally) App Store/Microsoft Store submission, **`electron-updater`** can be enabled with GitHub Releases as the provider.
* **Monitoring**: The application will rely on user-submitted bug reports via GitHub Issues, supported by the **"Debug Mode"** logging feature. The application will log detailed errors to a local file when in debug mode.

## Current State vs Plan (2025-11-02)

### Packaging and Distribution
- Current: `package.json` contains an `electron-builder` `build` block with platform icon configuration. Icon assets exist under `build/icons/` and are used in `electron/main.js`.
- Gap: `electron-builder` is not listed as a dependency and no packaging scripts exist (e.g., `dist`, `release`).
- Action:
  - Add `electron-builder` as a devDependency.
  - Add scripts: `"dist": "npm run build && electron-builder"`, and `"release": "npm run build && electron-builder --publish always"` (after CI is ready and `GH_TOKEN` configured).

### Manual Release and Rollback (Unsigned)
- Policy: Publish unsigned artifacts; no auto-update. Users accept "Unknown/Undefined Publisher" prompts per OS and install manually.
- Release channel: GitHub Releases (mark as prerelease by default). Keep all historical releases to enable rollback.
- Rollback: Users can download and reinstall any prior version from Releases. Document this in the README/website.
- Workflow: Provide a manual, on-demand `workflow_dispatch` in GitHub Actions that:
  - Accepts inputs (version, prerelease flag, release notes URL/summary)
  - Builds a matrix of artifacts (Windows NSIS/portable, macOS dmg/zip, Linux AppImage/deb)
  - Publishes to the specified GitHub Release (create/update) using `GH_TOKEN`
  - Does not enable auto-update; no code-signing required initially

### Auto-Updates
- Planned: Use `electron-updater` with GitHub Releases as provider.
- Current: No `electron-updater` dependency or `autoUpdater` wiring in `electron/main.js`.
- Action:
  - Add `electron-updater` dependency.
  - Initialize `autoUpdater` in `electron/main.js` (check for updates on app ready, handle update events, and expose a minimal IPC to trigger checks).
  - Configure `publish` in `electron-builder` (GitHub provider) and set `GH_TOKEN` in CI.

### CI/CD
- Planned: CI should run unit/integration/E2E tests and produce signed build artifacts for macOS/Windows/Linux; releases published from tags.
- Current: No CI workflows are present in the repository.
- Action:
  - Add GitHub Actions workflows:
    - `ci.yml`: install deps, cache, run `vitest run`, selected integration tests, and Playwright E2E in headless mode.
    - `build.yml`: on tag, run `electron-builder` matrix for mac/win/linux to produce artifacts; upload artifacts to release draft.
  - Configure required secrets (e.g., `GH_TOKEN`).

### CI/CD Workflow Design (Solo Dev, direct-to-main)

- **Triggers:**
  - **Clean Room Validation:** `on: push` to `main`.
    - Purpose: Verify build and tests pass on a clean machine (eliminates "works on my machine").
    - Jobs: Build, Unit/Integration Tests, E2E Tests (Headless).
    - Failure Policy: Blocking. Fix immediately.
  - **Automated Release Pipeline:** `on: push` tags (e.g., `v*.*.*`).
    - Purpose: Create and publish release artifacts.
    - Jobs: `electron-builder` matrix (Windows/Mac/Linux).
    - Output: Signed/Unsigned artifacts uploaded to GitHub Releases.

- **Cloud QA jobs (minimal):**
  - Build → `npm ci && npm run build`
  - Tests → `npm test`
  - CodeQL → `github/codeql-action` (Javascript)
  - Semgrep → `npx semgrep --config p/owasp-electron --error`
  - Audit → `npm audit` (or rely on Dependabot)

- **Refinements:**
  - **Clean Room Validation:** A lightweight GitHub Action runs on every push to `main` to verify the build/tests work on a clean machine.
  - **Automated Release Pipeline:** A GitHub Action triggered by **Git Tags** (e.g., `v1.0.0`) automatically builds `electron-builder` artifacts (Windows/Mac/Linux) and uploads them to GitHub Releases.
  - Concurrency: use a `concurrency` group on `main` with `cancel-in-progress: true` to stop outdated runs.
  - Scheduled security: add a weekly CodeQL scheduled job in addition to push events.
  - Semgrep hygiene: exclude heavy directories (`node_modules`, `playwright-report`, `web-bundles`, built assets) and pin rule versions via `.semgrep.yml`.

### Code-Signing (Future)
- Not configured yet. Document platform-specific signing steps (Apple Developer ID, Windows code signing) before public distribution.

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