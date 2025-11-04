# Next Steps

## Architect Handoff

This Product Requirements Document is now finalized and ready for the architectural design phase. The Architect's task is to review this PRD and the initial "as-is" analysis document and create the definitive technical blueprint for the enhancement. 

## Release and CI (2025-11-02)

- CI quality gates:
  - Run unit/integration/E2E tests on push to `main`.
  - Run CodeQL (JavaScript) and Semgrep (Electron + JavaScript packs); high‑risk findings fail the workflow.
  - Optional: `npm audit` locally or in CI.
- Manual unsigned releases:
  - Use GitHub Releases; keep historical releases for rollback.
  - Provide a `workflow_dispatch` that builds matrix artifacts (macOS/Windows/Linux) and publishes to the selected Release; auto‑update disabled initially.