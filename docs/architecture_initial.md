
# NB! This document is not beeng maintain with any updates and chages for actual updated documentation split into separate docs always use docs/architecture/

# rb-auto-midjourney-adobe-stock Brownfield Enhancement Architecture

## 1. Introduction

This document outlines the architectural approach for enhancing the `rb-auto-midjourney-adobe-stock` application. Its primary goal is to serve as the guiding technical blueprint for converting the existing Node.js CLI tool into a full-featured Electron desktop application, ensuring seamless and robust integration with the existing, powerful backend logic.

### Existing Project Analysis

This architecture is built upon the detailed, code-verified analysis of the existing project and the comprehensive requirements defined in the `brownfield-prd.md`.

* **Current Project State**: The project is a modular Node.js application with a three-layer logical architecture: an **Orchestration Layer** (`index.js`), a **Prompt Engineering Layer** (`paramsGeneratorModule.js`), and an **Image Production Layer** (`producePictureModule.js` and `aiVision.js`). Its core technologies include Node.js, OpenAI, PiAPI, and Sharp.
* **Available Documentation**:
    * `docs/prd.md` (Brownfield Enhancement PRD)
    * Initial `Brownfield Architecture Document` (the "as-is" analysis).
    * `docs/architecture/testing-strategy.md` (Comprehensive testing framework specifications).
* **Identified Constraints**:
    * The existing backend logic must be reused with minimal refactoring (CR1).
    * A 'Backend Adapter' or 'Facade' pattern is mandatory for UI-to-backend communication (NFR5).
    * API keys must be stored using the native OS credential manager (NFR2).

### Change Log

| Change | Date | Version | Description | Author |
| :--- | :--- | :--- | :--- | :--- |
| Initial Draft | 2025-08-04 | 1.0 | Final version of architecture | Winston |
| UX Integration | 2025-01-27 | 1.1 | Added Settings UI component specifications and validation report | PO Agent |

## 2. Enhancement Scope and Integration Strategy

### Enhancement Overview

As defined in the PRD, this enhancement is a **major feature modification** with a **significant** impact on the existing codebase. The scope is to build a user-friendly Electron desktop application UI around the existing Node.js backend logic, and to add a database for persistence.

### Integration Approach

The architecture will be based on Electron's process model to ensure a responsive UI and clean separation of concerns.

* **Process Model**: Your existing Node.js backend logic will run entirely within Electron's **Main Process**. The new User Interface will run in a separate **Renderer Process**.
* **The Backend Adapter (NFR5)**: This is the central component of our integration strategy. It will act as the **sole intermediary** between the UI and your backend modules, exposing a clean API via Electron's secure IPC bridge.
* **Database Integration**: The new database logic will be implemented and accessed exclusively within the Main Process. The Backend Adapter will expose methods to the UI for saving/loading configurations and history.

### Compatibility Requirements

This architecture will adhere to the following compatibility requirements as defined in the PRD:
* The integration of the existing backend modules shall require minimal refactoring of their core logic to function within the Electron environment (CR1).
* The application must support all existing configuration options and workflows through the new UI (CR2).

## 3. Tech Stack Alignment

### Existing Technology Stack

The foundation of the application remains your proven Node.js backend.

| Category | Current Technology |
| :--- | :--- |
| **Runtime** | Node.js (v16+) |
| **AI/HTTP** | `openai`, `axios` |
| **Image/Data** | `sharp`, `xlsx` |
| **CLI** | `yargs` |

### New Technology Additions

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **Electron** | Desktop App Framework | Core technology to build a cross-platform desktop application. |
| **React** | UI Framework | To build the user interface components. |
| **TypeScript** | Type Safety & Development | Provides static type checking and better development experience. |
| **Tailwind CSS** | Utility-First Styling | Rapid UI development with consistent design system. |
| **Vite** | Build Tool & Dev Server | Fast development server and optimized build process. |
| **SQLite (`better-sqlite3`)**| Local Database | Provides persistence for job history and configurations. |
| **Keytar** | Secure Key Storage | To securely store API keys in the native OS credential manager. |
| **Electron Builder**| Application Packager | To package the application into distributable installers. |

### Testing Framework

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **Vitest** | Unit Testing Framework | Fast, modern testing framework with excellent TypeScript support and React integration. |
| **React Testing Library** | React Component Testing | Industry standard for testing React components in isolation with user-centric testing approach. |
| **Playwright** | End-to-End Testing | Cross-platform E2E testing framework with excellent Electron support and reliable test execution. |

## 4. Data Models and Schema Changes

**Note**: Detailed data models and schema information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/data-models-and-schema-changes.md`

This document contains the complete database schema, model definitions, and schema change specifications. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- SQLite database with three core models: JobConfiguration, JobExecution, GeneratedImage
- Secure credential storage using Keytar
- Comprehensive metadata tracking for generated images
- Backward compatibility with existing CLI workflows

For complete database schema, model definitions, and implementation details, please refer to `docs/architecture/data-models-and-schema-changes.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

**IMPORTANT FOR SCRUM MASTER AGENTS**: When creating stories, use the sharded files in `docs/architecture/` as the main source of truth, not this overview document. Specifically:
- Use `docs/architecture/component-architecture.md` for component specifications and integration patterns
- Use `docs/architecture/internal-api-design.md` for API specifications and method definitions
- Use `docs/architecture/data-models-and-schema-changes.md` for database models and schema details
- Use `docs/architecture/source-tree-integration.md` for file organization and project structure
- Use `docs/architecture/testing-strategy.md` for testing requirements and frameworks
- Use `docs/architecture/tech-stack-alignment.md` for technology specifications

## 5. Component Architecture

**Note**: Detailed component architecture information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/component-architecture.md`

This document contains the complete component breakdown, integration patterns, and architectural diagrams. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Electron process model with Main and Renderer processes
- Backend Adapter pattern for UI-backend communication
- Secure IPC bridge implementation
- Component separation and responsibility boundaries

For complete component architecture, integration patterns, and technical diagrams, please refer to `docs/architecture/component-architecture.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

## 6. Internal API Design (Backend Adapter)

**Note**: Detailed API design information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/internal-api-design.md`

This document contains the complete API specification, method definitions, and integration patterns. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Single global API object (`window.api`) exposed via Electron's contextBridge
- Asynchronous methods returning Promises
- Event-based real-time updates
- Secure credential management
- Comprehensive job execution and data management APIs

For complete API specification, method definitions, and integration details, please refer to `docs/architecture/internal-api-design.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

## 7. Source Tree Integration

**Note**: Detailed source tree information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/source-tree-integration.md`

This document contains the complete project structure, file organization, and integration patterns. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- New `/electron` directory for UI and Electron-specific code
- Existing `/src` directory for backend logic
- Clear separation of concerns
- Modular component organization

For complete source tree structure, file organization, and integration patterns, please refer to `docs/architecture/source-tree-integration.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

## 8. Infrastructure and Deployment Integration

**Note**: Detailed infrastructure and deployment information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/infrastructure-and-deployment-integration.md`

This document contains the complete deployment strategy, infrastructure requirements, and operational considerations. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Electron Builder for cross-platform packaging
- SQLite database deployment considerations
- Security and credential management
- Distribution and update mechanisms

For complete infrastructure and deployment details, please refer to `docs/architecture/infrastructure-and-deployment-integration.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

## 9. Testing Strategy and Standards

**Note**: Detailed testing strategy information has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/testing-strategy.md`

This document contains the complete testing framework, standards, and implementation guidelines. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Comprehensive testing pyramid (Unit 70%, Integration 20%, E2E 10%)
- Vitest for unit and integration testing
- React Testing Library for component testing
- Playwright for end-to-end testing
- Cross-platform compatibility validation

For complete testing strategy, framework specifications, and implementation guidelines, please refer to `docs/architecture/testing-strategy.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.

## 10. Next Steps

**Note**: Detailed next steps and implementation guidance has been moved to a dedicated document for better organization.

**Reference Document**: `docs/architecture/next-steps.md`

This document contains the complete implementation roadmap, priorities, and development guidance. The detailed information is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Implementation priorities and sequencing
- Development milestones and checkpoints
- Risk mitigation strategies
- Quality assurance checkpoints

For complete next steps, implementation roadmap, and development guidance, please refer to `docs/architecture/next-steps.md`. For navigation to all architecture sections, see `docs/architecture/index.md`.