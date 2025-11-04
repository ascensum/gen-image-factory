# Epic and Story Structure

## Epic 1: CLI to Full Electron Application with UI and Persistence

**Epic Goal**: This epic will deliver a fully functional desktop application with a graphical user interface that encapsulates the existing CLI tool's power, adds database persistence for job history and configurations, and is packaged for easy distribution on major operating systems.

**User Stories (in implementation order):**

### Status Notes (2025-11-02)

- Story 10 (UI Visual Cleanup & Consistency): Done; unified progress behavior, counters/filters correctness, and labeling parity applied.
- Provider swap to Runware: Done; Runware is default; Midjourney‑specific UI actions removed.
- Export UX: Updated; single‑job Excel via modal (.xlsx) and bulk ZIP export via modal; `exceljs` used end‑to‑end.
- Distribution policy: Initial releases are manual and unsigned via GitHub Releases; auto‑update is planned for a later phase after signing/notarization.

1.  **Foundation: Setup Basic Electron Shell**
    - Create Electron main process
    - Setup basic window and renderer process
    - Establish project structure with `/electron` directory
    - Configure Vite for React + TypeScript development
    - Setup Tailwind CSS for styling
    - Implement basic IPC communication

2.  **Backend Integration: Implement Backend Adapter and IPC Bridge**
    - Create Backend Adapter (NFR5) for UI-backend communication
    - Implement secure IPC bridge between processes
    - Integrate existing CLI modules with minimal refactoring (CR1)
    - Setup error handling and user-friendly message translation
    - Configure TypeScript types for IPC communication

3.  **Database Foundation: Setup SQLite Database and Models**
    - Implement SQLite database setup
    - Create JobConfiguration, JobExecution, and GeneratedImage models
    - Setup database service layer
    - Implement secure credential storage with Keytar (NFR2)
    - Define TypeScript interfaces for database models

4.  **Configuration: Implement Application Settings UI - (DONE)**
    - Create settings management interface for all `.env` parameters (FR1)
    - Implement file browser for input files (FR2)
    - Add API key management with secure storage
    - Include cost labeling for API features (FR12)
    - Integrate with database for configuration persistence
    - Style UI components with Tailwind CSS



5.  **Core Controls: Implement Main Dashboard and Pipeline Controls**
    - Create main dashboard with start/stop controls (FR3)
    - Implement real-time progress indicator (FR4)
    - Add dual-mode logging (Standard/Debug) (FR4, FR10)
    - Include force stop all processes button (FR11)
    - Ensure responsive UI during backend processing (NFR1)
    - Style dashboard components with Tailwind CSS

6.  **Results: Implement 'Successful Results' View - (DONE)**
    - Create results gallery view
    - Display images with metadata and QC status (FR5)
    - Implement Excel export functionality (FR8)
    - Add image metadata display
    - Style gallery components with Tailwind CSS

7.  **Review: Implement 'Failed Images' Review Workflow**
    - Create failed images review interface
    - Display QC failure reasons (FR5)
    - Implement manual approval workflow
    - Add retry mechanisms for failed images
    - Style review components with Tailwind CSS

8.  **Persistence: Implement Job History and Advanced Features**
    - Complete job configuration saving (FR6)
    - Implement job results saving with full history (FR7)
    - Create job history view and management
    - Add data export and cleanup features
    - Style history components with Tailwind CSS

9.  **Critical Backend Fixes and Technical Debt Resolution**
    

10.  **UI Visual Cleanup & Consistency**
    - Address visual inconsistencies and responsiveness across Dashboard, Job Management, Single Job View and Settings
    - Standardize status badges and input behaviors
    - Ensure responsive headers and consistent field widths
    - Align Single Job View edit with file pickers and stats layout

11. **Provider Swap to Runware (Unified Image Inference)**
    - Replace legacy Midjourney provider with Runware as the default
    - Hide MJ‑specific UI actions; introduce Runware settings and advanced controls
    - Keep pipeline intact (download → processing → DB → QC/metadata → final move)

12. **Results Advanced Export and File Management**
    - Add ZIP export button to ImageGallery for selected images
    - Package selected images with Excel metadata into downloadable ZIP files
    - Implement backend ZIP creation service with progress tracking
    - Create logical folder structure (images/ + metadata.xlsx)
    - Add file validation and error handling for missing images
    - Style ZIP export components with Tailwind CSS

13. **Project Housekeeping: Cleanup Junk, Logs, and Emoji Policy**
    - Remove existing junk artifacts; expand `.gitignore` to prevent future junk
    - Enforce emoji policy: allowed only in `.md`; reject in code/logs/commits
    - Clean up logging output (no emojis/glyphs; standardized levels; redaction)
    - Add repo hygiene scripts (`repo:scan`, `repo:clean`) and update pre-commit hook

14. **UI Cosmetic Polish & Minor Fixes (Ongoing Small PR Lane)**
    - Incremental non-functional visual polish: spacing, alignment, typography, badges
    - Consistent hover/focus states; dark/light consistency; microcopy clarity
    - Small, low-risk PRs with brief change log entries and before/after when helpful

15. **Security: Implement Production Security Measures**
    - Implement encrypted database fallback for API key storage
    - Add comprehensive memory protection for sensitive data
    - Create secure logging that masks API keys and sensitive information
    - Add security health checks and monitoring capabilities
    - Style security components with Tailwind CSS

16. **Testing: Implement Comprehensive Testing for Story 1.1**
    - Create unit tests for React components using React Testing Library
    - Implement integration tests for IPC communication
    - Create end-to-end tests for basic app functionality
    - Validate TypeScript type safety and configuration
    - Test cross-platform compatibility (Windows, macOS, Linux)
    - Implement security tests for IPC and app security
    - Create performance and build optimization tests

17. **Testing Stabilization & Post-1.9 Remediation: Unit & Integration (Story 1.17)**
    - Stabilize database integration tests using in-memory/isolated SQLite and migrations in setup
    - Align settings integration tests with `BackendAdapter` (replace legacy `SettingsAdapter` usage)
    - Centralize Electron and `keytar` mocks; assert IPC handlers and payloads
    - Reflect Story 1.7 clamping rules in assertions
    - Provide npm scripts for targeted subsets (DB, settings, story-1.7)
    - Remediate failing tests introduced after Story 1.9 development, excluding unit/integration/E2E already green and covered by the HySky pre-commit script

18. **Distribution: Implement Application Packaging** (Detailed story to be drafted by Scrum Master)
    - Configure Electron Builder for cross-platform packaging (NFR3)
    - Generate distributable installers for Windows, macOS, and Linux
    - Initial distribution: manual unsigned releases via GitHub Releases (keep history for rollback)
    - Auto‑update: planned for later after signing/notarization; disabled initially
    - Create deployment documentation
    - Optimize Vite build for production

**Testing Strategy**: Each story includes comprehensive testing tasks covering unit tests, integration tests, and end-to-end validation as appropriate for the story scope. TypeScript will provide additional type safety during development. Story 1.16 specifically addresses the testing requirements for the foundational components from Story 1.1. Story 1.17 stabilizes unit and integration tests to ensure CI reliability and alignment with current architecture.