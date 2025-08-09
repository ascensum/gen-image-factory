# Introduction

This document outlines the architectural approach for enhancing the `rb-auto-midjourney-adobe-stock` application. Its primary goal is to serve as the guiding technical blueprint for converting the existing Node.js CLI tool into a full-featured Electron desktop application, ensuring seamless and robust integration with the existing, powerful backend logic.

## Existing Project Analysis

This architecture is built upon the detailed, code-verified analysis of the existing project and the comprehensive requirements defined in the `brownfield-prd.md`.

* **Current Project State**: The project is a modular Node.js application with a three-layer logical architecture: an **Orchestration Layer** (`index.js`), a **Prompt Engineering Layer** (`paramsGeneratorModule.js`), and an **Image Production Layer** (`producePictureModule.js` and `aiVision.js`). Its core technologies include Node.js, OpenAI, PiAPI, and Sharp.
* **Available Documentation**:
    * `docs/prd.md` (Brownfield Enhancement PRD)
    * Initial `Brownfield Architecture Document` (the "as-is" analysis).
* **Identified Constraints**:
    * The existing backend logic must be reused with minimal refactoring (CR1).
    * A 'Backend Adapter' or 'Facade' pattern is mandatory for UI-to-backend communication (NFR5).
    * API keys must be stored using the native OS credential manager (NFR2).

## Change Log

| Change | Date | Version | Description | Author |
| :--- | :--- | :--- | :--- | :--- |
| Initial Draft | 2025-08-04 | 1.0 | Final version of architecture | Winston | 