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

### Code Coverage Requirements
- **Unit Tests**: Minimum 80% coverage for backend services and React components
- **Integration Tests**: Minimum 70% coverage for API endpoints and database operations
- **E2E Tests**: Coverage of all critical user workflows

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

### Pre-commit Hooks
- Run unit tests before code commits
- Check code coverage thresholds
- Lint and format code automatically

### CI Pipeline
- Run full test suite on pull requests
- Generate coverage reports
- Parallelize test execution
- Cache dependencies for faster builds

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