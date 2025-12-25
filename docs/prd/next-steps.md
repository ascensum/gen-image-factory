# Next Steps

## Architect Handoff

This Product Requirements Document is now finalized and ready for the architectural design phase. The Architect's task is to review this PRD and the initial "as-is" analysis document and create the definitive technical blueprint for the enhancement. 

## Release and CI (2025-11-02)

- CI quality gates:
  - Run unit/integration/E2E tests on push to `main`.
  - Run CodeQL (JavaScript) and Semgrep (OWASP Top 10 + JavaScript packs); CI fails on **any Semgrep error** (not just high-risk findings) to prevent silent failures. **Note**: `p/owasp-electron` does not exist; using `p/owasp-top-ten` + `p/javascript` instead.
  - **npm audit** (high severity only) **must** run in CI and fail workflow on high-severity vulnerabilities (NFR7).
- Automated release pipeline (Story 1.21):
  - **Triggered by Git Tags** (e.g., `v*.*.*`) automatically builds `electron-builder` artifacts and uploads to GitHub Releases
  - **Windows Distribution**: Microsoft Store (mandatory, primary) with MSIX packages; GitHub Releases (secondary, unsigned) for advanced users
  - **macOS/Linux**: GitHub Releases with `electron-updater` for automatic updates
  - **Artifact Integrity**: SHA-256 checksums and SBOM (Software Bill of Materials) required for every release
  - **Auto-Update**: Conditional based on runtime environment (Windows Store uses OS updates; GitHub Releases uses `electron-updater`)
  - Historical releases kept for rollback capability