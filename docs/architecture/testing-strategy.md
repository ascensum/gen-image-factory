# Testing Strategy and Standards

## AI Generation & Integrity Protocols (Strict Enforcement)

**Critical Instruction for AI Agents:** When generating tests, you must strictly adhere to the following anti-hallucination rules. Violations will result in the code being rejected.

### 1. The "No-Tautology" Rule
- **Forbidden:** Asserting that a constant equals itself or that `true` is `true`.
- **Forbidden:** Asserting `expect(service.method).not.toThrow()` without verifying the *outcome* of the method (unless specifically testing error swallowing).
- **Required:** Every test must assert a state change, a return value, or a specific side-effect.

### 2. The "SUT Isolation" Rule
- **Forbidden:** Mocking the System Under Test (SUT).
- **Explanation:** If you are testing `BackendAdapter`, you must mock `keytar` and `electron`, but you CANNOT mock methods inside `BackendAdapter` itself to make the test pass.
- **Required:** The SUT must be the real implementation.

### 3. The "Concrete Data" Rule
- **Forbidden:** Using `expect.any(String)` or `expect.objectContaining({})` for critical data paths.
- **Required:** Use hardcoded, concrete expectation values.
  - *Bad:* `expect(result.id).toBeDefined()`
  - *Good:* `expect(result.id).toBe('user_123')`

### 4. The "Mock-check" Rule
- **Context:** This project uses specific mocks in `src/test/setup.ts`.
- **Instruction:** Do not hallucinate new mocking patterns. Use `vi.mock('keytar')` patterns as defined in the "Test Setup Files" section above.
- **Constraint:** When asserting mocks, check arguments: `expect(mock).toHaveBeenCalledWith(specificArgs)`, not just `toHaveBeenCalled()`.

Note (2025-11-02): CI is not yet configured in this repository. Add GitHub Actions to run unit/integration tests (Vitest) and E2E (Playwright) on PRs, and a separate build workflow to package Electron apps on tags.

## QA + DevSecOps Pipeline (Solo Developer, direct-to-main)

This project uses a two-layer QA approach optimized for a solo developer committing straight to `main` while keeping security first and avoiding over‑engineering.

### Test Infrastructure Prerequisites

To ensure stability and eliminate "flakiness" caused by shared resources, the following infrastructure helpers are mandatory:

- **Database Isolation:** Every integration test interacting with the database MUST use a unique, temporary SQLite file.
  - Implementation: `createIsolatedDbPath()` helper in `src/test/setup.ts` or a dedicated test utils file.
  - Constraint: No shared `database.sqlite` usage in tests.

- **Global Mocks:** `src/test/setup.ts` MUST provide default mocks for system-level dependencies to prevent tests from accessing real OS resources.
  - `keytar`: Mocked to prevent accessing the real OS keychain.
  - `electron`: Mocked to prevent real dialogs and IPC bridges from attempting to spawn.
  - `fs`: Mocked or carefully scoped to temporary directories to protect the real file system.

### Local QA Layer (Developer Machine)

- Trigger: husky `pre-commit` (staged files only)
- Purpose: Fast, blocking checks for obvious bugs and security issues (< 20s)
- Steps (fail fast, non‑zero exit on failure):
  - ESLint (no warnings allowed) on staged files
  - Critical regression tests: `npm run test:critical`
  - Semgrep security scan with open rulesets (Electron + JS): `p/owasp-electron`, `p/javascript` (staged files)
  - Optional: `npm audit --omit=dev`
- Out of scope for pre-commit: full E2E tests

Deliverable: `.husky/pre-commit` script enforcing the above.

### Cloud QA Layer (GitHub Actions)

- Trigger: `on: push` to `main`
- Purpose: Deep validation and dependency security on every commit
- Jobs (minimal, reproducible):
  - Build: `npm ci && npm run build`
  - Unit + Integration tests: `npm test`
  - CodeQL scan: `github/codeql-action` (free for public repos)
  - Semgrep scan: `npx semgrep --config p/owasp-electron --error`
  - Dependency check: `npm audit` and/or Dependabot alerts
  - Optional artifact build: `electron-builder --publish never` (no release)
- Fail workflow on high-risk findings from CodeQL or Semgrep.

Deliverables:
- `.github/workflows/ci.yml` (single minimal workflow)
- `.semgrep.yml` (project overrides; base rulesets remain public packs)

#### Refinements for Speed and Signal
- Concurrency: cancel superseded runs on `main` to avoid wasting minutes on old pushes.
- Semgrep scope: exclude heavy/non-source paths (e.g., `node_modules`, `playwright-report`, `web-bundles`, build output) and pin ruleset versions via `.semgrep.yml` to ensure reproducibility.
- Scheduling: keep Semgrep on every push; run CodeQL both on push and as a lightweight weekly scheduled run to catch drift.
- Critical subset discipline: keep `test:critical` very small and high-signal so pre-commit stays < 20s.

### Electron Security Standards (Enforced)

All generated code and reviews must adhere to the following defaults in the Electron app:
- `nodeIntegration: false`
- `contextIsolation: true`
- `enableRemoteModule: false`
- `sandbox: true`
- `webSecurity: true`

Also required:
- Use preload scripts + `contextBridge` for IPC
- Whitelist IPC channels; validate and sanitize inputs
- Never load remote code or use `eval()`
- Apply a Content Security Policy (CSP) in the renderer

These are statically checked via Semgrep (Electron rules) and validated in code reviews.

### Optional Enhancements

- Add OWASP ZAP or Trivy scans as a stage 2 CI job
- Add AI code risk review (e.g., CodeRabbit or Semgrep AI plugin)
- Periodically run `npx semgrep --config p/security-audit` locally (manual)

### Test Taxonomy and Runners

- Unit tests (Vitest): default runner via `npm test`
- Integration tests (Vitest + Electron IPC mocks): included in `npm test`
- E2E tests (Playwright): triggered manually or in nightly CI (not in pre-commit)
- Critical subset (`test:critical`): minimal set for pre-commit gate

### Maintenance

- Keep CI YAML minimal; prefer official actions and public rule packs
- Dependabot enabled for vulnerable dependency PRs
- Revisit critical test set quarterly to ensure fast, representative coverage

## Overview

This document defines the comprehensive testing strategy for the Electron application, ensuring reliability, maintainability, and user confidence across all layers of the application.
 
## Stabilization Update (Story 1.14)
 
To address intermittent failures and align tests with the current architecture, the following stabilization measures are now standard:
 
- Database integration tests
  - Use an in-memory or unique-per-test SQLite database path.
  - Run migrations in suite setup (`beforeAll`) and clean up in `afterAll`.
  - Run DB-focused suites serially if contention occurs.
- Settings integration tests
  - Target `BackendAdapter` APIs (not legacy `SettingsAdapter`).
  - Mock `keytar` for secure storage and Electron file selection flows.
  - Assert merged defaults behavior for `getSettings()`.
- IPC tests
  - Use explicit Electron mocks; assert handler registration and payload validation.
  - Avoid direct invocation of native modules in tests.
- Story 1.7 alignment
  - Normalize/clamp processing settings in assertions (e.g., saturation clamped to 0..3).
- Tooling & DX
  - Centralize common mocks in `tests/setup.ts` (keytar, Electron dialog, `window.api`).
  - Add scripts to run focused subsets (DB, settings, story-1.7) in package tooling.

## Testing Philosophy

The application implements a **Testing Pyramid** approach with the following distribution:
- **Unit Tests (70%)**: Fast, isolated tests for individual functions and components
- **Integration Tests (20%)**: Tests for component interactions and API communication
- **End-to-End Tests (10%)**: Complete user workflow validation

## Test Execution Scripts (Story 1.18)

Targeted test subsets for faster development feedback:

- `npm run test:integration:db` - Run database integration tests (JobConfiguration)
- `npm run test:integration:settings` - Run settings adapter integration tests
- `npm run test:story:1.7` - Run Story 1.7 related tests (clamping, normalization)
- `npm run test:exports` - Run export functionality tests (ZIP + Excel)

## Testing Framework Specifications

### Unit Testing with Vitest

**Purpose**: Fast, modern testing framework with excellent TypeScript support and React integration.

**Backend Testing**
```javascript
// Example: Testing backend services
import { describe, it, expect, vi } from 'vitest'
import { someService } from '../src/services/someService'

describe('SomeService', () => {
  it('should process data correctly', () => {
    const result = someService.process(input)
    expect(result).toEqual(expectedOutput)
  })
})
```

**React Component Testing**
```typescript
// Example: Testing React components
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsPanel } from '../components/Settings/SettingsPanel'

describe('SettingsPanel', () => {
  it('should render settings sections', () => {
    render(<SettingsPanel />)
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('File Paths')).toBeInTheDocument()
  })

  it('should handle user interactions', () => {
    render(<SettingsPanel />)
    const input = screen.getByLabelText('API Key')
    fireEvent.change(input, { target: { value: 'test-key' } })
    expect(input).toHaveValue('test-key')
  })
})
```

### React Testing Library

**Purpose**: Industry standard for testing React components in isolation with user-centric testing approach.

**Key Principles**:
- Test components as users interact with them
- Focus on behavior, not implementation details
- Use semantic queries (getByRole, getByLabelText, etc.)
- Test accessibility features

### End-to-End Testing with Playwright

**Purpose**: Cross-platform E2E testing framework with excellent Electron support and reliable test execution.

**Electron Application Testing**
```typescript
// Example: E2E test for settings workflow
import { test, expect } from '@playwright/test'

test('complete settings configuration workflow', async ({ page }) => {
  // Navigate to settings
  await page.goto('file:///path/to/electron/app')
  await page.click('[data-testid="settings-tab"]')
  
  // Configure API keys
  await page.fill('[data-testid="openai-api-key"]', 'test-key')
  await page.click('[data-testid="save-api-keys"]')
  
  // Configure file paths
  await page.click('[data-testid="select-input-file"]')
  // Handle file dialog interaction
  
  // Verify settings are saved
  await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible()
})
```

## Test Organization

### Co-located Component Testing Pattern

**Approved Pattern**: Component tests are co-located with their components in `__tests__` directories. This pattern has been implemented and approved for all future component development.

**Benefits**:
- **Maintainability**: Tests are located next to their components, making them easier to find and update
- **Developer Experience**: When modifying a component, the test file is immediately visible
- **Industry Standard**: Follows React community best practices and modern testing patterns
- **Reduced Cognitive Load**: Developers don't need to navigate between separate test directories

**Implementation Pattern**:
```
src/renderer/components/[ComponentName]/
├── ComponentName.tsx
├── ComponentName.module.css (if applicable)
└── __tests__/
    ├── ComponentName.test.tsx
    └── ComponentName.integration.test.tsx (if needed)
```

**Current Implementation**: The Settings components demonstrate this pattern with all 8 components having co-located tests in `src/renderer/components/Settings/__tests__/`.

### Directory Structure
```
project-root/
├── tests/
│   ├── unit/
│   │   ├── backend/           # Backend service tests
│   │   │   ├── services/
│   │   │   ├── adapter/
│   │   │   └── utils/
│   │   └── frontend/          # React component tests
│   │       └── components/
│   ├── integration/
│   │   ├── api/               # API integration tests
│   │   └── database/          # Database integration tests
│   └── e2e/
│       ├── workflows/         # User workflow tests
│       └── cross-platform/    # Platform-specific tests
├── src/
│   └── renderer/
│       └── components/
│           ├── ComponentName/
│           │   ├── ComponentName.tsx
│           │   └── __tests__/     # Co-located component tests (APPROVED PATTERN)
│           │       └── ComponentName.test.tsx
│           └── Settings/
│               ├── SettingsPanel.tsx
│               ├── ApiKeysSection.tsx
│               ├── FilePathsSection.tsx
│               ├── ParametersSection.tsx
│               ├── SettingsSection.tsx
│               ├── SecureInput.tsx
│               ├── FileSelector.tsx
│               ├── CostIndicator.tsx
│               └── __tests__/     # Co-located component tests
│                   ├── SettingsPanel.test.tsx
│                   ├── ApiKeysSection.test.tsx
│                   ├── FilePathsSection.test.tsx
│                   ├── ParametersSection.test.tsx
│                   ├── SettingsSection.test.tsx
│                   ├── SecureInput.test.tsx
│                   ├── FileSelector.test.tsx
│                   └── CostIndicator.test.tsx
└── src/
    └── __tests__/             # Backend-specific tests
```

### Test File Naming Conventions
- **Component tests**: `ComponentName.test.tsx` (co-located in `__tests__/` directories)
- **Backend unit tests**: `*.test.ts` or `*.test.tsx`
- **Integration tests**: `*.integration.test.ts`
- **E2E tests**: `*.e2e.test.ts`
- **Test utilities**: `*.test-utils.ts`

**Component Test Naming Example**:
```
src/renderer/components/Settings/SettingsPanel.tsx
src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx
```

## Testing Standards

### Code Coverage Requirements (Story 1.19 Policy)

**Overall Coverage Target:**
- **Overall (Vitest)**: Target **≥70% statements and ≥70% branches** across the codebase
- Future work must not introduce major regressions from this baseline
- Coverage should trend upward over time

**Per-File Gates (Stable API-like Modules):**
- **`src/adapter/backendAdapter.js`**: Must maintain **≥70% statements and ≥70% branches**
- **`src/services/retryExecutor.js`**: Must maintain **≥70% statements and ≥70% branches**
- These modules act as stable APIs and are practical to unit test deeply

**Scenario-Driven Coverage (JobRunner):**
- **`src/services/jobRunner.js`**: Validated by a **must-not-regress scenario suite** rather than a rigid percentage target
- **Rationale**: For large orchestration modules, a rigid statement target incentivizes low-value tests for logging/guards and micro-branches
- **Strategy**: Protect the app by validating **end-to-end orchestration behaviors** with integration-like unit tests
- **Approach**: Raise coverage by adding **big-path tests** that execute meaningful slices (start → generate → persist → QC → post-process → finalize; stop/cancel; rerun)
- Branch coverage is prioritized over statement coverage for this file

**Other Modules:**
- **Unit Tests**: Target ≥70% coverage for backend services and React components (pragmatic approach, not rigid 80%)
- **Integration Tests**: Minimum 70% coverage for API endpoints and database operations
- **E2E Tests**: Coverage of all critical user workflows

### Must-Not-Regress Scenarios (Formal Validation Standard)

These scenarios represent the **formal validation standard** for critical application behaviors. All scenarios must be covered by tests and must not regress.

#### Settings (Critical)
- [x] Load defaults and load persisted settings (success + failure surfaces)
- [x] Save settings (success + backend failure surfaces)
- [x] API key update/clear flows (and no secret leakage in UI banners)
- [ ] Schema/legacy fields preserved where UI/schema requires them (do not reintroduce PIAPI-era params as "active" generation settings)

#### JobRunner (Critical)
- [x] Start → generate → persist (DB execution + generated images persisted; configurationSnapshot safe)
- [x] QC on/off (approve path and failure path persist correctly)
- [x] Post-processing success/failure (including remove.bg failure modes)
- [x] Metadata success/failure (per-image failure persistence)
- [x] Stop/cancel mid-flight (terminates cleanly; terminal state persisted; no hang)
- [x] Rerun (label persistence + rerun flag clearing + safe snapshot; bulk rerun queue advancement)
- [ ] Retry per-generation (attempts/backoff; partial success without corrupting state)

#### RetryExecutor / Retry flows (Critical)
- [x] Retry job updates statuses correctly across success/failure branches; stop/clear queue behaves; DB update failures are surfaced/contained
- [x] `retryExecutor.js` per-file gate met and should not regress

**Validation Approach**: These scenarios are validated through integration-like unit tests that exercise meaningful orchestration behaviors rather than micro-branch testing. The test suite must demonstrate that all checked scenarios are covered and passing.

### Testing Best Practices

**Backend Tests**
- Mock external dependencies (API calls, file system)
- Test error conditions and edge cases
- Use factories for test data generation
- Test async operations properly

**Component Tests**
- **Location**: Co-located in `__tests__/` directories alongside components
- Test user interactions and accessibility
- Mock external dependencies (API calls, context providers)
- Test component integration with state management
- Verify proper event handling
- Follow naming convention: `ComponentName.test.tsx`

**E2E Tests**
- Focus on user journeys, not implementation details
- Test critical workflows end-to-end
- Include cross-platform compatibility tests
- Use reliable selectors (data-testid attributes)

### Test Data Management
- Use factories and fixtures for consistent test data
- Clean up test data after each test
- Avoid hardcoded test values
- Use environment-specific test configurations

### Async Testing
- Properly handle asynchronous operations and timeouts
- Use appropriate wait strategies in E2E tests
- Mock timers when testing time-dependent code
- Test loading states and error handling

## Continuous Integration

### Pre-commit Hooks (Free Tools Stack)

**Purpose**: Fast, blocking checks for obvious bugs and security issues (< 30s)

**Implementation**: Executed via **Husky pre-commit hook** (`scripts/pre-commit-hook.sh`)

**Mandatory Checks** (executed in order):
1. **Repository hygiene scan**: `repo:scan:staged` - Validates staged files for repo standards
2. **Critical regression test suite**: `npm run test:critical` - Validates all Story 1.19 must-not-regress scenarios
3. **ESLint**: Zero warnings allowed on staged JS/TS files (blocking failure)
4. **Semgrep security scan**: Electron + JavaScript rulesets (`p/owasp-electron`, `p/javascript`) on staged files
5. **Socket.dev supply-chain scan**: `npx socket audit` - Detects high-risk npm dependencies
6. **Sensitive data check**: Scans for API keys and secret leakage in non-test files

**Critical Test Suite (`test:critical`)**:
The critical test suite is optimized to cover all Story 1.19 must-not-regress scenarios in < 30 seconds:

- **Settings (Critical)**: `tests/integration/api/settingsAdapter.integration.test.ts`
  - Covers: Load defaults/persisted settings, save settings, API key update/clear flows (no secret leakage)

- **JobRunner (Critical)**: 
  - `tests/unit/services/JobRunner.executeJob.qcDisabled.integration-like.test.js` - Start → generate → persist
  - `tests/unit/services/JobRunner.executeJob.qcEnabled.integration-like.test.js` - QC on/off (approve + failure paths)
  - `tests/unit/services/JobRunner.executeJob.stopCancel.integration-like.moreCoverage.test.js` - Stop/cancel mid-flight
  - `tests/unit/services/JobRunner.startJob.rerunPersistence.moreCoverage.test.js` - Rerun (label persistence + flag clearing + snapshot safety)

- **RetryExecutor (Critical)**:
  - `tests/unit/services/RetryExecutor.queue.test.js` - Status updates, stop/clear queue
  - `tests/unit/services/RetryExecutor.updateImageStatus.test.js` - DB update failures surfaced/contained

**Test-to-Scenario Mapping**: See `docs/stories/1.20-test-analysis.md` for detailed mapping analysis.

**What Does NOT Run Locally**:
- Full test suite (belongs in CI)
- E2E tests (belongs in CI)
- CodeQL (belongs in CI)
- Large dependency scans (belongs in CI)
- Multi-platform builds (belongs in CI)

**Deliverable**: `scripts/pre-commit-hook.sh` enforcing the above checks with non-zero exit on failure

### CI Pipeline (GitHub Actions)

**Trigger**: `on: push` to `main` and `pull_request` to `main`

**Purpose**: Deep validation and dependency security on every commit

**Workflow File**: `.github/workflows/ci.yml`

**Jobs (minimal, reproducible, run in parallel)**:
1. **Build**: `npm ci --ignore-scripts && npm run build`
   - Enforces lockfile usage
   - Blocks install-time malware
   - Reduces supply-chain risk
   - Uses Node.js caching for `node_modules`

2. **Test Suite**: `npm test`
   - Runs full unit, integration, and E2E test suite
   - Uses Node.js caching for `node_modules`

3. **CodeQL Security Scan**: `github/codeql-action`
   - Free for public repos
   - JavaScript/TypeScript analysis
   - Uploads SARIF results to GitHub Security tab

4. **Semgrep Security Scan**: Full codebase scan
   - Rulesets: `p/owasp-electron`, `p/javascript`, `p/typescript`
   - Excludes heavy paths via `.semgrep.yml` (node_modules, build output, etc.)
   - Uploads SARIF results to GitHub Security tab
   - Fails workflow on high-risk findings

5. **Socket.dev Supply Chain Scan**: `npx socket audit`
   - Detects high-risk/malicious npm dependencies
   - Fails workflow on high-risk findings

**Failure Policy**: Fail workflow on:
- Build failures
- Test failures
- High-severity vulnerabilities
- High-confidence malicious dependency signals
- CodeQL or Semgrep high-risk findings

**Refinements for Speed and Signal**:
- **Concurrency**: Cancel superseded runs on `main` to avoid wasting minutes on old pushes
- **Semgrep scope**: Exclude heavy/non-source paths (e.g., `node_modules`, `playwright-report`, `web-bundles`, build output) via `.semgrep.yml`
- **Caching**: Node.js cache for `node_modules` to speed up builds
- **Parallel execution**: All jobs run in parallel for faster feedback

**Supply-Chain Protection (Mandatory)**:
- Lockfile usage (`npm ci --ignore-scripts`)
- Socket.dev scanning in CI
- Dependabot enabled for npm ecosystem (separate configuration)
- GitHub Actions hygiene: pinned action versions, minimal permissions (`contents: read`)
- **Artifact Integrity & Provenance**: CI must generate an **SBOM (Software Bill of Materials)** for every release (using `cyclonedx-npm` or similar free tool) - *Future enhancement*

**Deliverables**:
- `.github/workflows/ci.yml` (single minimal workflow with all quality gates)
- `.semgrep.yml` (project overrides; base rulesets remain public packs)

### Coverage Reporting
- Generate HTML coverage reports
- Track coverage trends over time
- Set minimum coverage thresholds
- Fail builds on coverage regression

## Testing Tools Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'file:///path/to/electron/app',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
```

### Test Setup Files

#### Database Test Setup (Story 1.18)

Integration tests that interact with the database use isolated SQLite databases to avoid native `sqlite3` worker crashes and ensure test isolation:

- **Unique Database Paths**: Each test suite creates a unique temporary database file using `os.tmpdir()` with timestamp and random suffix
- **Database Isolation**: Tests override `dbPath` after construction to use test-specific paths
- **Migrations**: Database tables are created via `init()` method which runs `CREATE TABLE IF NOT EXISTS` statements
- **Cleanup**: Test databases are cleaned up in `afterAll` hooks

Example pattern:
```typescript
beforeEach(async () => {
  const testDbPath = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`)
  jobConfig = new JobConfiguration()
  // Close constructor's connection
  if (jobConfig.db) {
    await new Promise<void>((resolve) => {
      jobConfig.db.close(() => resolve())
    })
  }
  // Override path and reinit
  jobConfig.dbPath = testDbPath
  await jobConfig.init()
})
```

#### Electron and Keytar Mocks (Story 1.18)

Tests that use BackendAdapter mock Electron and keytar at module level:

- **keytar Mock**: Mocks `keytar.getPassword`, `keytar.setPassword`, `keytar.deletePassword` for API key storage (NOT user authentication - stores service API keys like OpenAI, remove.bg)
- **Electron Dialog Mock**: Mocks `electron.dialog.showOpenDialog` and `electron.dialog.showSaveDialog` for file selection
- **IPC Mock**: Mocks `electron.ipcMain.handle` to capture and test IPC handlers

Example:
```typescript
// Mock keytar at module level
vi.mock('keytar', () => ({
  default: {
    getPassword: mockGetApiKey,
    setPassword: mockSetApiKey,
    deletePassword: mockDeleteApiKey,
  }
}))

// Mock Electron dialog
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: {
    showOpenDialog: mockShowOpenDialog,
    showSaveDialog: mockShowSaveDialog,
  }
}))
```

#### Test Setup Files
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron API for tests
global.window.electronAPI = {
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  selectFile: vi.fn(),
  // ... other API methods
}

// Mock file system operations
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

// Mock external APIs
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))
 
// Mock secure storage (keytar)
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}))

// Optional: Mock Electron dialog if used directly in Node context
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/mock.txt'] })
  }
}))

// Helper for DB isolation in integration tests
export const createIsolatedSqlitePath = () => `test-${Date.now()}-${Math.random()}.sqlite` // or ':memory:'
```

## Specific Testing Scenarios

### Settings Component Testing
```typescript
// src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsPanel } from '../SettingsPanel'

describe('SettingsPanel', () => {
  it('should render all settings sections', () => {
    render(<SettingsPanel />)
    
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('File Paths')).toBeInTheDocument()
    expect(screen.getByText('Parameters')).toBeInTheDocument()
  })

  it('should save API keys securely', async () => {
    const mockSetApiKey = vi.fn()
    global.window.api.setApiKey = mockSetApiKey
    
    render(<SettingsPanel />)
    
    const apiKeyInput = screen.getByLabelText('OpenAI API Key')
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } })
    
    const saveButton = screen.getByText('Save API Keys')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockSetApiKey).toHaveBeenCalledWith('openai', 'test-api-key')
    })
  })
})
```

### Backend Service Testing
```typescript
// tests/unit/backend/services/backendAdapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}))

describe('BackendAdapter (settings)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns merged defaults from getSettings()', async () => {
    const adapter = new BackendAdapter()
    const settings = await adapter.getSettings()
    expect(settings).toMatchObject({ apiKeys: expect.any(Object), filePaths: expect.any(Object) })
  })

  it('stores API keys via secure storage (mocked)', async () => {
    const adapter = new BackendAdapter()
    const result = await adapter.setApiKey('openai', 'test-key')
    expect(result?.success ?? true).toBe(true)
  })
})
```

### E2E Workflow Testing
```typescript
// tests/e2e/workflows/settings-configuration.e2e.test.ts
import { test, expect } from '@playwright/test'

test.describe('Settings Configuration Workflow', () => {
  test('should complete full settings configuration', async ({ page }) => {
    // Navigate to settings
    await page.goto('file:///path/to/electron/app')
    await page.click('[data-testid="settings-tab"]')
    
    // Configure API keys
    await page.fill('[data-testid="openai-api-key"]', 'test-openai-key')
    await page.fill('[data-testid="pi-api-key"]', 'test-pi-key')
    await page.click('[data-testid="save-api-keys"]')
    
    // Verify API keys are saved
    await expect(page.locator('[data-testid="api-keys-saved"]')).toBeVisible()
    
    // Configure file paths
    await page.click('[data-testid="select-input-file"]')
    // Handle file dialog - this would need platform-specific handling
    
    // Configure parameters
    await page.fill('[data-testid="quality-parameter"]', 'high')
    await page.fill('[data-testid="style-parameter"]', 'photographic')
    
    // Save all settings
    await page.click('[data-testid="save-all-settings"]')
    
    // Verify settings are persisted
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible()
  })

  test('should handle invalid API keys', async ({ page }) => {
    await page.goto('file:///path/to/electron/app')
    await page.click('[data-testid="settings-tab"]')
    
    await page.fill('[data-testid="openai-api-key"]', 'invalid-key')
    await page.click('[data-testid="test-api-connection"]')
    
    await expect(page.locator('[data-testid="api-error"]')).toBeVisible()
  })
})
```

## Performance Testing

### Test Execution Performance
- Unit tests should complete in under 30 seconds
- Integration tests should complete in under 2 minutes
- E2E test suite should complete in under 10 minutes
- Use test parallelization to optimize execution time

### Memory and Resource Testing
- Test for memory leaks in long-running operations
- Verify proper cleanup of resources
- Test application performance under load
- Monitor CPU and memory usage during tests

## Security Testing

### Input Validation Testing
- Test all user inputs for proper validation
- Verify sanitization of user data
- Test for injection attacks
- Validate file upload security

### Authentication and Authorization Testing
- Test secure storage of API keys
- Verify proper access controls
- Test session management
- Validate credential handling

### Security Implementation Testing (Story 1.2)

#### **API Key Storage Testing**
```typescript
// tests/unit/security/apiKeyStorage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'
import * as keytar from 'keytar'

describe('API Key Storage Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should store API keys in native keychain when available', async () => {
    const adapter = new BackendAdapter();
    const result = await adapter.setApiKey('openai', 'test-key');
    expect(result.success).toBe(true);
    
    const retrieved = await adapter.getApiKey('openai');
    expect(retrieved.securityLevel).toBe('native-keychain');
  });

  it('should fallback to plain text when keytar unavailable', async () => {
    // Mock keytar to fail
    jest.spyOn(keytar, 'setPassword').mockRejectedValue(new Error('Keytar failed'));
    
    const adapter = new BackendAdapter();
    const result = await adapter.getApiKey('openai');
    expect(result.securityLevel).toBe('plain-text-fallback');
    expect(result.message).toContain('Secure storage unavailable');
  });
});
```

#### **Security Status Communication Testing**
```typescript
// tests/unit/security/securityStatus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('Security Status Communication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return correct security status', async () => {
    const adapter = new BackendAdapter();
    const status = await adapter.getSecurityStatus();
    
    expect(status).toHaveProperty('secureStorage');
    expect(status).toHaveProperty('securityLevel');
    expect(status).toHaveProperty('message');
  });

  it('should communicate fallback status correctly', async () => {
    // Mock keytar to fail
    jest.spyOn(keytar, 'getPassword').mockRejectedValue(new Error('Keytar failed'));
    
    const adapter = new BackendAdapter();
    const status = await adapter.getSecurityStatus();
    
    expect(status.secureStorage).toBe('unavailable');
    expect(status.fallback).toBe('plain-text-database');
    expect(status.message).toContain('Using plain text storage');
  });
});
```

#### **UI Security Testing**
```typescript
// tests/integration/ui/securityUI.integration.test.ts
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SecureInput } from '../components/SecureInput'

describe('Security UI Integration', () => {
  it('should display correct security status in UI', async () => {
    const { getByTestId } = render(<SecureInput serviceName="openai" />);
    
    // Wait for security status to load
    await waitFor(() => {
      const statusElement = getByTestId('secure-storage-status');
      expect(statusElement).toBeInTheDocument();
    });
  });

  it('should show appropriate help text based on security level', async () => {
    const { getByText } = render(<SecureInput serviceName="openai" />);
    
    await waitFor(() => {
      const helpText = getByText(/API key will be stored/);
      expect(helpText).toBeInTheDocument();
    });
  });
});
```

#### **Memory Protection Testing**
```typescript
// tests/unit/security/memoryProtection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackendAdapter } from '../../../src/adapter/backendAdapter'

describe('Memory Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not expose API keys in logs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const adapter = new BackendAdapter();
    await adapter.setApiKey('openai', 'secret-key-123');
    
    // Verify no API keys in logs
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('secret-key-123')
    );
  });

  it('should clear sensitive data on application exit', async () => {
    const adapter = new BackendAdapter();
    await adapter.setApiKey('openai', 'test-key');
    
    // Simulate application exit
    adapter.clearSensitiveData();
    
    const result = await adapter.getApiKey('openai');
    expect(result.apiKey).toBe('');
  });
});
```

#### **Cross-Platform Security Testing**
```typescript
// tests/e2e/security/crossPlatformSecurity.e2e.test.ts
import { test, expect } from '@playwright/test'

describe('Cross-Platform Security', () => {
  test('should handle keytar failures gracefully', async ({ page }) => {
    // Test on platforms where keytar might fail
    await page.goto('file:///path/to/electron/app');
    await page.click('[data-testid="settings-tab"]');
    
    // Verify fallback messaging is displayed
    await expect(page.locator('[data-testid="security-fallback-message"]')).toBeVisible();
  });

  test('should communicate security status correctly', async ({ page }) => {
    await page.goto('file:///path/to/electron/app');
    await page.click('[data-testid="settings-tab"]');
    
    // Verify security status is displayed
    const statusElement = page.locator('[data-testid="security-status"]');
    await expect(statusElement).toBeVisible();
    
    // Verify appropriate messaging based on platform
    const message = await statusElement.textContent();
    expect(message).toMatch(/Secure storage|plain text|encrypted/);
  });
});
```

### Security Testing Requirements

#### **Unit Testing Requirements**
- API key encryption/decryption functionality
- Security status reporting accuracy
- Memory protection mechanisms
- Error handling for security failures
- Fallback mechanism validation

#### **Integration Testing Requirements**
- Encrypted database operations (when implemented)
- Security fallback mechanisms
- Cross-platform security validation
- IPC security for sensitive data transmission
- Security status UI updates

#### **End-to-End Testing Requirements**
- Security status UI accuracy
- User messaging about security implications
- Security feature toggles and configuration
- Cross-platform security behavior
- Security status persistence across sessions

#### **Performance Testing for Security**
- Security operations should not significantly impact performance
- Memory usage for security operations
- Encryption/decryption performance (when implemented)
- Security status checking performance

### Security Testing Best Practices

#### **Test Data Management**
- Use mock API keys for testing
- Never commit real API keys to test files
- Use environment variables for sensitive test data
- Clear test data after each test

#### **Mocking Strategy**
- Mock keytar for testing fallback scenarios
- Mock crypto operations for testing encryption
- Mock IPC for testing security communication
- Mock file system for testing secure storage

#### **Test Coverage Requirements**
- 100% coverage of security-related methods
- All security fallback paths tested
- All error conditions for security operations
- All UI security status displays tested

## Maintenance and Evolution

### Test Maintenance
- Regular review and update of test cases
- Remove obsolete tests
- Update tests when requirements change
- Maintain test data and fixtures

### Test Documentation
- Document complex test scenarios
- Maintain test case descriptions
- Update testing guidelines as needed
- Share testing best practices with team

### Continuous Improvement
- Monitor test effectiveness
- Gather feedback on testing process
- Improve test coverage over time
- Optimize test execution performance 