# Requirements

## Functional Requirements

1.  **FR1**: The application shall provide a graphical user interface (UI) for managing all configuration settings currently handled by the `.env` file and command-line flags.
2.  **FR2**: The UI shall allow users to select input files (e.g., keyword files, custom prompt templates) via a file browser.
3.  **FR3**: A main dashboard shall provide controls to start, monitor the progress of, and stop the image generation pipeline.
4.  **FR4**: The UI shall display real-time progress via a structured progress indicator. It will also feature a logging view with two modes: a 'Standard' mode showing user-friendly status updates (e.g., 'Step 1/5: Generating prompt...') and readable errors, and a 'Debug' mode showing detailed technical logs for troubleshooting.
5.  **FR5**: A results view shall display the generated images, their quality check status (pass/fail), and any generated metadata. For images that fail the quality check, the UI must display the specific reason provided by the AI Vision model.
6.  **FR6**: The application shall save job *configurations* (settings, file paths) to a local database for reuse.
7.  **FR7**: The application shall save job *results* (including generated metadata, QC status, and final file paths) to the database, creating a viewable job history.
8.  **FR8**: The UI shall provide a function to export the generated image metadata and their corresponding file paths into an Excel (.xlsx) file.
9.  ~~FR9: The UI shall allow the user to specify custom output paths...~~ *(Removed for MVP)*
10. **FR10**: The application shall provide a setting or control (e.g., a toggle in the settings area) to switch between 'Standard' and 'Debug' logging modes.
11. **FR11**: The UI must include a global 'Force Stop All Processes' button to immediately terminate any running backend tasks in case of an error or runaway process.
12. **FR12**: In the settings UI, features that incur direct API costs (like AI Quality Check and AI Metadata Generation) must be clearly labeled as such to inform the user of potential costs.
13. **FR13**: The application shall provide configurable image enhancement controls including sharpening intensity (0-10) and saturation level (0-2) with independent toggle functionality.
14. **FR14**: The UI shall implement a master toggle system with proper feature dependencies and conditional visibility to prevent user confusion and ensure logical workflow.
15. **FR15**: The application shall support independent image enhancement features that can be enabled regardless of image conversion settings, providing flexible image processing options.
16. **FR16**: The UI shall provide ZIP export functionality that packages selected images with their metadata (title, description, tags) into a downloadable ZIP file containing both the image files and an Excel spreadsheet.
17. **FR17**: The Dashboard shall use a unified Generation Progress bar with the following semantics: single generation (N=1) shows 0 while running and 100 on completion; multiple generations (N>1) compute percent as `gensDone / totalGenerations × 100`. When QC is enabled, the progress caps at 95% until QC completes, then reaches 100%.
18. **FR18**: Status labels, counters, and filters shall be consistent and accurate across Dashboard, Job Management, Single Job View, Image Gallery, and Failed Images Review; label taxonomy is unified (e.g., Approved, QC Failed, Processing, Retry Pending, Retry Failed).
19. **FR19**: Rerun job labels shall be displayed uniformly across the UI as `Parent Label (Rerun execIdShort)` including during in‑progress states and in all lists, filters, and detail views.
20. **FR20**: Export UX shall follow: single‑job export via destination‑aware Excel modal (.xlsx) and bulk export via destination‑aware ZIP modal (images + metadata.xlsx), both supporting duplicate policy (append/overwrite), remembering last custom location per type, and using `exceljs` end‑to‑end.

## Non-Functional Requirements

1.  **NFR1**: The application's UI must remain responsive and not freeze while the backend processing is running.
2.  **NFR2**: All external API keys must be stored securely using a tiered approach: Primary storage in the native OS credential manager via `keytar`; production fallback to encrypted database storage when `keytar` is unavailable (planned under Security Hardening); development fallback is non‑persistent plain text. The UI must display the current security status and storage method. Sensitive values must be masked in logs; memory protection is planned under Security Hardening.
3.  **NFR3**: The application must be packaged as a standalone desktop application for Windows, macOS, and Linux using Electron.
4.  **NFR4**: The core backend logic (prompt generation, image production) must be reused from the existing CLI tool.
5.  **NFR5**: A 'Backend Adapter' or 'Facade' layer must be implemented between the UI and the core backend logic. The UI will exclusively interact with this adapter, which will be responsible for managing backend interaction patterns (e.g., polling), translating technical errors into user-friendly messages, and providing a service-agnostic interface to allow for future backend provider changes with minimal UI impact.
6.  **NFR6**: The test suite must be stable and deterministic in CI, including:
    - Database integration tests isolated per suite (in-memory or unique path) with migrations in setup and serial execution when needed.
    - Settings integration tests aligned to `BackendAdapter` with mocks for `keytar` and Electron dialogs.
    - Centralized mocks and helpers in `tests/setup.ts` to avoid native module invocation during tests.

7.  **NFR7**: CI must enforce quality gates: unit/integration/E2E tests, CodeQL, and Semgrep security scanning.
   - **CodeQL**: JavaScript/TypeScript analysis with security-extended and security-and-quality query suites. CodeQL must run on every push AND as a weekly scheduled job to catch security drift.
   - **Semgrep**: Security scanning using `p/owasp-top-ten` and `p/javascript` rulesets (configured via command-line flags due to Semgrep 1.146.0 YAML config compatibility limitation). **Note**: The `p/owasp-electron` ruleset does not exist in the Semgrep registry (returns HTTP 404); `p/owasp-top-ten` provides comprehensive coverage for Electron security concerns. The `p/typescript` ruleset is excluded as the JavaScript ruleset covers TypeScript code. Path exclusions are handled via `.semgrepignore`. CI fails on **any Semgrep error** (not just high-risk findings) to prevent silent failures where security scanning isn't working but CI shows green.
   - **Socket.dev**: Supply-chain risk detection for npm dependencies
   - **npm audit**: `npm audit` (high severity only) **must** run in CI and fail workflow on high-severity vulnerabilities.
   - **Dependabot**: Automated dependency updates configured via `.github/dependabot.yml` with weekly update schedule (Mondays at 9:00 AM), grouped minor/patch PRs, and optional auto-merge support. Dependabot PRs run full CI suite (tests, security scans) to catch breakages before merge. PR limit set to 10 open PRs at a time with `dependencies` and `automated` labels for proper categorization.
   - **E2E Tests**: E2E tests must run periodically: nightly scheduled run, on version tags (before release), and via manual workflow_dispatch. E2E tests are NOT required on every push (too slow). **Optimization Strategy**: Manual/workflow_dispatch/tag runs use chromium-only execution (~3x faster) for quick feedback; nightly scheduled runs execute full cross-browser suite (chromium, firefox, webkit) to catch browser-specific regressions. Tests use 2 workers for parallelization, reducing execution time from 35+ minutes to ~20 minutes for full suite. **E2E Test Scope**: E2E tests focus on UI/navigation workflows and user-facing interactions. All active E2E tests must pass (tests that require Electron backend or have flaky UI rendering are properly skipped with documentation). Backend functionality and business logic are validated through integration tests, which provide comprehensive coverage for Electron-specific functionality and job execution workflows.
   - High‑risk findings from CodeQL or Semgrep fail CI; network retry logic (5 attempts with 10-second delays) ensures transient failures don't cause false negatives.

## Compatibility Requirements

1.  **CR1**: The integration of the existing backend modules shall require minimal refactoring of their core logic to function within the Electron environment.
2.  **CR2**: The application must support all existing configuration options and workflows through the new UI.
3.  ~~CR3: To ensure compatibility with "Flying Upload" ...~~ *(Removed for MVP)*

## UI/UX Branding

1.  **BR1**: The application must display "FROM SHIFTLINE TOOLS™" on the splash screen as the primary brand identifier.
2.  **BR2**: The legacy 'GIMF' acronym and icon are strictly deprecated and must not be used in production builds or any user-facing interfaces.

## Legal Documentation Requirements

1.  **LR1**: Privacy Policy page must be created on the documentation website and meet Microsoft Store certification requirements. Policy must cover: data collection practices, API key storage security, local data handling, third-party services disclosure (OpenAI, Runware, Remove.bg), user rights, and individual developer privacy policy (not corporate entity).

2.  **LR2**: Terms of Service page must be created on the documentation website and meet Microsoft Store certification requirements. Terms must cover: software license terms (individual developer), usage restrictions, liability disclaimers, Microsoft Store terms compliance, API usage terms, and intellectual property rights.

3.  **LR3**: Security policy (SECURITY.md) must be created at repository root level and include: security policy statement, vulnerability reporting process, security contact information, data handling and privacy commitments, API key storage security, and update policy.

4.  **LR4**: Repository-level documentation (README.md, SECURITY.md) must be professional, comprehensive, and include Shiftline Tools branding. README.md must include installation instructions, links to documentation website, Microsoft Store badge/link, and support information. 