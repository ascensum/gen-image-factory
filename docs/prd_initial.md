
# NB! This document is not beeng maintain with any updates and chages for actual updated documentation split into separate docs always use docs/prd/

# rb-auto-midjourney-adobe-stock Brownfield Enhancement PRD

## 1. Intro Project Analysis and Context

### Existing Project Overview

* **Analysis Source**: The primary source for this analysis is the `Brownfield Architecture Document` recently completed by Winston the Architect, which was based on a full review of the project's source code.
* **Current Project State**: The project is a modular Node.js command-line tool that automates a complete AI art generation and post-processing pipeline. It uses PiAPI for Midjourney generation, OpenAI for prompt engineering and Vision-based quality control, and includes advanced features like CSV-based templating and robust image processing.

### Available Documentation Analysis

Based on our previous session, the following documentation is available and will be used as the foundation for this PRD:
* The code-verified `Brownfield Architecture Document`.

### Enhancement Scope Definition

* **Enhancement Type**: This is a major feature modification, effectively creating a new application shell (Electron UI) around the existing core logic.
* **Enhancement Description**: The project will be enhanced by building a user-friendly Electron desktop application UI around the existing Node.js backend logic. The enhancement will also include adding a database for persistence of settings and results.
* **Impact Assessment**: The impact on the existing codebase is **Significant**, as it will require refactoring the core logic to decouple it from the CLI and integrate with an Electron main process and a new database layer.

### Goals and Background Context

* **Goals**:
    1.  To create a user-friendly UI that makes the tool accessible to non-technical users.
    2.  To implement database persistence for key application data (e.g., settings, job history, generated metadata).
    3.  To reuse the existing, powerful backend logic for prompt engineering and image production within the new application.
* **Background Context**: The current CLI tool is powerful but requires technical expertise to operate. Creating an Electron application will broaden its audience and provide a more intuitive workflow, while adding persistence will enable more advanced features and job management in the future.

### Change Log

| Change | Date | Version | Description | Author |
| :--- | :--- | :--- | :--- | :--- |
| Initial Draft | 2025-08-04 | 0.1 | First draft of PRD | John (PM) |
| Final Version | 2025-08-04 | 1.0 | Finalized with user refinements | John (PM) |
| Story 1.2 Updates | 2025-01-27 | 1.1 | Added image enhancement features and UI improvements | PO (Sarah) |

## 2. Requirements (Final Version with Risk Mitigations)

### Functional Requirements

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

### Non-Functional Requirements

1.  **NFR1**: The application's UI must remain responsive and not freeze while the backend processing is running.
2.  **NFR2**: All external API keys must be stored securely using the native OS credential manager (e.g., via a library like `keytar`). If the native manager is unavailable, the application must not store keys persistently and will require the user to enter them at the start of each session.
3.  **NFR3**: The application must be packaged as a standalone desktop application for Windows, macOS, and Linux using Electron.
4.  **NFR4**: The core backend logic (prompt generation, image production) must be reused from the existing CLI tool.
5.  **NFR5**: A 'Backend Adapter' or 'Facade' layer must be implemented between the UI and the core backend logic. The UI will exclusively interact with this adapter, which will be responsible for managing backend interaction patterns (e.g., polling), translating technical errors into user-friendly messages, and providing a service-agnostic interface to allow for future backend provider changes with minimal UI impact.
6.  **NFR6**: The UI shall implement sophisticated conditional visibility logic to show only relevant settings based on user selections and feature dependencies.
7.  **NFR7**: Image processing controls shall provide real-time visual feedback with range sliders and value indicators for precise control over enhancement parameters.

### Compatibility Requirements

1.  **CR1**: The integration of the existing backend modules shall require minimal refactoring of their core logic to function within the Electron environment.
2.  **CR2**: The application must support all existing configuration options and workflows through the new UI.
3.  ~~CR3: To ensure compatibility with "Flying Upload" ...~~ *(Removed for MVP)*
4.  **CR4**: The new image enhancement features must be backward compatible with existing CLI workflows and configuration files.

## 3. User Interface Enhancement Goals

### High-Level UI Vision

The primary vision for the UI is to create a clean, modern, and intuitive single-window desktop application that guides non-technical users through the art generation process. The design should prioritize clarity and ease-of-use, abstracting away the complexity of the underlying command-line tool. The workflow should be linear and logical: configure a job, run it, and view the results.

### Core Screens and Views

To meet the functional requirements, the application will be conceptually organized around these core views:
1.  **Configuration View**: A dedicated area where users can manage all settings, select input files, and configure a generation job with enhanced image processing controls.
2.  **Dashboard / Run View**: The main control center to start/stop the job, see a progress indicator, and view the user-friendly log.
3.  **Results & History View**: A gallery-style view to display final images, their metadata, QC failure reasons, and historical job results.

### UI Design Principles

* **Clarity over Density**: Avoid overwhelming users with too many options at once.
* **Guided Workflow**: The UI should naturally guide the user through the process: 1. Configure -> 2. Run -> 3. View Results.
* **Immediate Feedback**: Every user action should provide clear and immediate visual feedback.
* **Conditional Visibility**: Show only relevant options based on user selections to reduce complexity.
* **Master Toggle System**: Implement logical feature dependencies to prevent user confusion.
* **Independent Features**: Allow flexible feature combinations while maintaining logical relationships.

### New Image Enhancement UI Features

#### **Configurable Image Processing**
- **Image Enhancement Toggle**: Independent master switch for enhancement features
- **Sharpening Control**: Range slider (0-10) with 0.5 step increments and real-time value display
- **Saturation Control**: Range slider (0-2) with 0.1 step increments and visual feedback
- **Visual Indicators**: Range markers and current value display for precise control

#### **Conditional Visibility Logic**
- **Remove Background Section**: Controls visibility of Remove.bg size and trim transparent background
- **Image Convert Section**: Controls visibility of format selection and quality settings
- **Image Enhancement Section**: Independent feature with its own controls
- **Sharpening/Saturation Controls**: Only visible when image enhancement is enabled

#### **Master Toggle System**
- **Image Convert**: Master switch for image conversion features
- **Remove Background**: Controls background removal features
- **Image Enhancement**: Independent master switch for enhancement features

## 4. Technical Constraints and Integration Requirements

### Existing Technology Stack

The enhancement will be built upon the existing technology stack. New components must be compatible with these core technologies:

| Category | Technology |
| :--- | :--- |
| **Runtime** | Node.js (v16+) |
| **AI Integration**| `openai` (^4.52.0) |
| **Image Processing**| `sharp` (^0.32.0) |
| **Data Handling**| `xlsx` (^0.18.5), `csv-parser` (^3.2.0) |
| **HTTP Client** | `axios` (^1.3.1) |

### Integration Approach

* **Process Model**: The application will use Electron's Main Process for the Node.js backend logic and the Renderer Process for the UI.
* **Communication Bridge**: All communication will go through the **Backend Adapter** (NFR5), which will manage asynchronous communication between the two processes.
* **Error Handling**: The Backend Adapter will catch technical errors and translate them into user-friendly messages.

### Code Organization and Standards

A new `/electron` directory will be created to house all UI and Electron-specific code, keeping it separate from the existing `/src` backend logic.

### Deployment and Operations

The final application will be packaged using `electron-builder` to generate distributable installers for Windows, macOS, and Linux.

## 5. Epic and Story Structure

**Note**: The detailed epic and story structure has been moved to a dedicated document for better organization and maintainability.

**Reference Document**: `docs/prd/epic-and-story-structure.md`

This document contains the complete breakdown of Epic 1 with all user stories, their implementation order, and detailed acceptance criteria. The story structure is maintained in the sharded document to allow for easier updates and better organization.

**Key Points**:
- Epic 1 focuses on converting the CLI to a full Electron application with UI and persistence
- Stories are sequenced for optimal development flow
- Each story includes comprehensive testing requirements
- The structure supports both greenfield and brownfield development patterns

For the complete story breakdown, implementation order, and detailed acceptance criteria, please refer to `docs/prd/epic-and-story-structure.md`. For navigation to all PRD sections, see `docs/prd/index.md`.

**IMPORTANT FOR SCRUM MASTER AGENTS**: When creating stories, use the sharded files in `docs/prd/` as the main source of truth, not this overview document. Specifically:
- Use `docs/prd/epic-and-story-structure.md` for story requirements and acceptance criteria
- Use `docs/prd/requirements.md` for detailed functional and non-functional requirements
- Use `docs/prd/technical-constraints.md` for technical constraints and integration requirements
- Use `docs/prd/user-interface-goals.md` for UI/UX specifications

## 6. Next Steps

### Architect Handoff

This Product Requirements Document is now finalized and ready for the architectural design phase. The Architect's task is to review this PRD and the initial "as-is" analysis document and create the definitive technical blueprint for the enhancement.