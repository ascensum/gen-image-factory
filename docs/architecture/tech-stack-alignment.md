# Tech Stack Alignment

## Existing Technology Stack

The foundation of the application remains your proven Node.js backend.

| Category | Current Technology |
| :--- | :--- |
| **Runtime** | Node.js (v16+) |
| **AI/HTTP** | `openai`, `axios` |
| **Image/Data** | `sharp`, `xlsx` |
| **CLI** | `yargs` |

## New Technology Additions

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

## Security Technology Stack (Story 1.11)

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **Keytar** | Primary Secure Storage | Native OS credential manager for maximum security. |
| **Crypto (Node.js)** | Database Encryption | Encrypt API keys in database when keytar unavailable. |
| **Memory Protection** | Runtime Security | Clear sensitive data from memory on application exit. |
| **Security Status UI** | User Communication | Inform users about security level and storage method. |

## Testing Framework

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **Vitest** | Unit Testing Framework | Fast, modern testing framework with excellent TypeScript support and React integration. |
| **React Testing Library** | React Component Testing | Industry standard for testing React components in isolation with user-centric testing approach. |
| **Playwright** | End-to-End Testing | Cross-platform E2E testing framework with excellent Electron support and reliable test execution. | 