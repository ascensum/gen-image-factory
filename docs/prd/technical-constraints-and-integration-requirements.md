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

### Release and CI Policy (2025-11-02)

- Manual unsigned releases via GitHub Releases; keep historical releases for rollback.
- Provide a `workflow_dispatch` that builds matrix artifacts (macOS/Windows/Linux) and publishes to the selected Release; auto‑update is disabled initially.
- CI quality gates: run unit/integration/E2E tests, CodeQL (JavaScript), and Semgrep (Electron + JavaScript packs). High‑risk findings fail CI; optional `npm audit` may run locally or in CI.