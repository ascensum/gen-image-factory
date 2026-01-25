# Gemini Code Assist - Style Guide & Compliance Rules

**Purpose:** This file defines the real-time compliance checks for Gemini Code Assist to enforce during refactoring and code generation.

**CRITICAL:** These rules are **non-negotiable**. Gemini Code Assist must enforce them during all code modifications, extractions, and refactoring operations.

---

## Table of Contents
1. [File Size Limits](#file-size-limits)
2. [IPC Handler Limits](#ipc-handler-limits)
3. [Behavioral Lock Rules](#behavioral-lock-rules)
4. [Dependency Injection Requirements](#dependency-injection-requirements)
5. [Feature Toggle Requirements](#feature-toggle-requirements)
6. [CSS Standards](#css-standards)
7. [Testing Requirements](#testing-requirements)

---

## File Size Limits

### Rule 1: File Size Limit < 400 Lines (ADR-001)

**Enforcement:**
- **STOP** any operation that would result in a file exceeding 400 lines
- **REJECT** any commit that introduces files > 400 lines
- **PROPOSE** a split by domain boundaries if approaching limit

**Check Implementation:**
```javascript
// Real-time check during editing
if (currentFile.lineCount > 400) {
  throw new Error('File exceeds 400-line limit (ADR-001). Split by domain boundaries.');
}

// Pre-commit check
if (changedFiles.some(file => file.lineCount > 400)) {
  throw new Error('Commit contains files exceeding 400-line limit (ADR-001).');
}
```

**Exemptions:**
- Generated code (migrations, auto-generated types)
- Test files covering a single cohesive test suite
- Configuration files (JSON, YAML)

**Split Strategy:**
- Split by feature/responsibility, not arbitrary line counts
- Example: `JobRunner.js` → `JobInitializer.js`, `JobExecutor.js`, `JobFinalizer.js`

---

## IPC Handler Limits

### Rule 2: IPC Handler Size Limit < 5 Lines (ADR-002)

**Enforcement:**
- **REJECT** any IPC handler exceeding 5 lines
- **REQUIRE** handlers to delegate to Services immediately
- **PROPOSE** extraction to Service if handler contains business logic

**Check Implementation:**
```javascript
// Real-time check during IPC handler creation
if (ipcHandler.lineCount > 5) {
  throw new Error('IPC handler exceeds 5-line limit (ADR-002). Delegate to Service.');
}

// Pattern detection
if (ipcHandler.contains(['validation', 'transformation', 'error handling'])) {
  throw new Error('IPC handler contains business logic (ADR-002). Move to Service.');
}
```

**Valid Pattern:**
```javascript
// ✅ Good: < 5 lines, delegates to service
ipc.handle('job:start', (event, args) => 
  jobService.start(args)
)
```

**Invalid Pattern:**
```javascript
// ❌ Bad: > 5 lines, contains business logic
ipc.handle('job:start', async (event, args) => {
  if (!args.apiKey) throw new Error('Missing API key');
  const validated = validateJobArgs(args);
  const transformed = transformJobData(validated);
  return await jobService.start(transformed);
})
```

---

## Behavioral Lock Rules

### Rule 3: Behavioral Lock - 100% Functional Equivalence

**Enforcement:**
- **NO RESTYLING** during extraction
- **NO VARIABLE RENAMING** during extraction
- **NO UI CHANGES** during extraction
- **NO LOGIC CHANGES** during extraction

**Check Implementation:**
```javascript
// Pre-commit check for extraction commits
if (commit.isExtraction()) {
  if (commit.hasRestyling()) {
    throw new Error('Extraction commit contains restyling (Behavioral Lock Rule). Restyling is a separate commit.');
  }
  
  if (commit.hasVariableRenaming()) {
    throw new Error('Extraction commit contains variable renaming (Behavioral Lock Rule). Renaming is a separate commit.');
  }
  
  if (commit.hasUIChanges()) {
    throw new Error('Extraction commit contains UI changes (Behavioral Lock Rule). UI changes are a separate commit.');
  }
  
  if (commit.hasLogicChanges()) {
    throw new Error('Extraction commit contains logic changes (Behavioral Lock Rule). Logic changes are a separate commit.');
  }
}
```

**Surgical Extraction Checklist:**
- [ ] Code copied verbatim (no reformatting)
- [ ] Variable names preserved
- [ ] UI markup unchanged
- [ ] Logic structure identical
- [ ] Integration tests pass with both legacy and new code paths

---

## Dependency Injection Requirements

### Rule 4: Dependency Injection Required (ADR-003)

**Enforcement:**
- **REJECT** any use of global state (`global.backendAdapter`)
- **REJECT** any use of process module exports for dependency resolution
- **REQUIRE** constructor injection for all dependencies

**Check Implementation:**
```javascript
// Real-time check during service creation
if (serviceClass.usesGlobalState()) {
  throw new Error('Service uses global state (ADR-003). Use Dependency Injection via constructor.');
}

// Pattern detection
const forbiddenPatterns = [
  'global.backendAdapter',
  'global.jobRunner',
  'process.module.exports',
];

if (code.contains(forbiddenPatterns)) {
  throw new Error('Code uses forbidden global state pattern (ADR-003). Use constructor injection.');
}
```

**Valid Pattern:**
```javascript
// ✅ Good: Dependency injection
class JobRunner {
  constructor(jobRepository, imageProcessor) {
    this.jobRepository = jobRepository;
    this.imageProcessor = imageProcessor;
  }
  
  async saveImage(data) {
    return await this.jobRepository.saveGeneratedImage(data);
  }
}
```

**Invalid Pattern:**
```javascript
// ❌ Bad: Global state
class JobRunner {
  async saveImage(data) {
    return await global.backendAdapter.saveGeneratedImage(data);
  }
}
```

---

## Feature Toggle Requirements

### Rule 5: Feature Toggles Required for Extractions (ADR-006)

**Enforcement:**
- **REQUIRE** all extractions to use `FEATURE_MODULAR_*` flags
- **REQUIRE** Shadow Bridge pattern with fallback to legacy
- **REQUIRE** feature flags to default to `false`

**Check Implementation:**
```javascript
// Pre-commit check for extraction commits
if (commit.isExtraction() && !commit.hasFeatureToggle()) {
  throw new Error('Extraction commit missing feature toggle (ADR-006). Add FEATURE_MODULAR_[SERVICE_NAME].');
}

// Check for Shadow Bridge pattern
if (commit.hasFeatureToggle() && !commit.hasShadowBridge()) {
  throw new Error('Feature toggle without Shadow Bridge (ADR-006). Add fallback to legacy code.');
}

// Check default state
if (commit.featureToggle.defaultValue !== false) {
  throw new Error('Feature toggle must default to false (ADR-006). Legacy code must be active by default.');
}
```

**Valid Pattern:**
```javascript
// ✅ Good: Shadow Bridge with fallback
async getApiKey(serviceName) {
  if (process.env.FEATURE_MODULAR_SECURITY === 'true') {
    try {
      return await this.securityService.getSecret(serviceName);
    } catch (error) {
      console.warn('New service failed, falling back to legacy:', error);
      return await this._legacyGetApiKey(serviceName);
    }
  }
  return await this._legacyGetApiKey(serviceName);
}
```

**Invalid Pattern:**
```javascript
// ❌ Bad: No fallback, no error handling
async getApiKey(serviceName) {
  if (process.env.FEATURE_MODULAR_SECURITY === 'true') {
    return await this.securityService.getSecret(serviceName);
  }
  return await this._legacyGetApiKey(serviceName);
}
```

---

## CSS Standards

### Rule 6: CSS File Size Limit < 100 Lines (ADR-007)

**Enforcement:**
- **STOP** any operation that would result in a CSS file exceeding 100 lines
- **REJECT** any commit that adds styles to frozen CSS files
- **REQUIRE** Tailwind-First approach for all styling

**Check Implementation:**
```javascript
// Real-time check during CSS editing
if (cssFile.lineCount > 100) {
  throw new Error('CSS file exceeds 100-line limit (ADR-007). Refactor to Tailwind or CSS Module.');
}

// Check for frozen CSS files
const frozenCSSFiles = [
  'src/renderer/components/Jobs/SingleJobView.css',
];

if (frozenCSSFiles.includes(cssFile.path) && commit.modifiesCSSFile(cssFile.path)) {
  throw new Error(`CSS file ${cssFile.path} is frozen (ADR-007). Refactor to Tailwind utilities.`);
}
```

**Valid Pattern:**
```tsx
// ✅ Good: Inline Tailwind classes
<div className="flex flex-col p-4 bg-gray-100 rounded-lg shadow-md">
  <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
</div>
```

**CSS Module Pattern (Exception):**
```tsx
// ✅ Good: CSS Module for complex animations (< 100 lines)
import styles from './Component.module.css';

<div className={`flex flex-col ${styles.complexAnimation}`}>
  {/* Component content */}
</div>
```

**Invalid Pattern:**
```css
/* ❌ Bad: Adding styles to frozen CSS file */
/* SingleJobView.css (FROZEN) */
.new-style {
  color: red;
}
```

---

## Testing Requirements

### Rule 7: Testing Coverage Requirements (ADR-006)

**Enforcement:**
- **REQUIRE** ≥70% coverage for new services
- **REQUIRE** 100% coverage for bridge logic
- **REQUIRE** integration tests for both new and legacy paths
- **REQUIRE** immutable safety net to pass

**Check Implementation:**
```javascript
// Pre-commit check for test coverage
if (commit.addsNewService() && commit.testCoverage < 0.70) {
  throw new Error('New service coverage < 70% (ADR-006). Add unit tests.');
}

if (commit.addsBridge() && commit.bridgeTestCoverage < 1.0) {
  throw new Error('Bridge logic coverage < 100% (ADR-006). Test both new and legacy paths.');
}

// CI check for immutable safety net
if (!immutableSafetyNet.passes()) {
  throw new Error('Immutable safety net failed (ADR-006). Legacy code path is broken.');
}
```

**Test Structure Requirements:**
```javascript
// ✅ Required: Unit test for new service
describe('SecurityService', () => {
  it('should get API key from keytar', async () => {
    // Test implementation
  });
});

// ✅ Required: Bridge integration test (both paths)
describe('BackendAdapter Bridge Logic', () => {
  it('should use new service when flag enabled', async () => {
    process.env.FEATURE_MODULAR_SECURITY = 'true';
    // Test implementation
  });
  
  it('should use legacy when flag disabled', async () => {
    process.env.FEATURE_MODULAR_SECURITY = 'false';
    // Test implementation
  });
  
  it('should fallback to legacy if new service fails', async () => {
    process.env.FEATURE_MODULAR_SECURITY = 'true';
    // Mock new service to throw error
    // Verify fallback to legacy
  });
});
```

---

## Master Frozen List - Real-Time Enforcement

**CRITICAL:** Gemini Code Assist must **REJECT** any attempt to add new logic to these files:

### Frozen Backend/Services
- `src/services/jobRunner.js`
- `src/adapter/backendAdapter.js`
- `src/producePictureModule.js`
- `src/services/retryExecutor.js`
- `src/database/models/JobExecution.js`
- `src/database/models/GeneratedImage.js`

### Frozen Frontend Components
- `src/renderer/components/Dashboard/DashboardPanel.tsx`
- `src/renderer/components/Settings/SettingsPanel.tsx`
- `src/renderer/components/Dashboard/FailedImagesReviewPanel.tsx`
- `src/renderer/components/Jobs/JobManagementPanel.tsx`

### Frozen Infrastructure/Tests
- `tests/integration/backend/BackendAdapter.integration.test.ts`

### Frozen Component Styling
- `src/renderer/components/Jobs/SingleJobView.css`

**Check Implementation:**
```javascript
// Real-time check during editing
const frozenFiles = [
  'src/services/jobRunner.js',
  'src/adapter/backendAdapter.js',
  'src/producePictureModule.js',
  'src/services/retryExecutor.js',
  'src/database/models/JobExecution.js',
  'src/database/models/GeneratedImage.js',
  'src/renderer/components/Dashboard/DashboardPanel.tsx',
  'src/renderer/components/Settings/SettingsPanel.tsx',
  'src/renderer/components/Dashboard/FailedImagesReviewPanel.tsx',
  'src/renderer/components/Jobs/JobManagementPanel.tsx',
  'tests/integration/backend/BackendAdapter.integration.test.ts',
  'src/renderer/components/Jobs/SingleJobView.css',
];

if (frozenFiles.includes(currentFile.path) && edit.addsNewLogic()) {
  throw new Error(`File ${currentFile.path} is frozen (ADR-001). Extract to new Service/Repository instead.`);
}
```

---

## Pre-Commit Hook Integration

**Implementation:** Add these checks to `.husky/pre-commit`:

```bash
#!/bin/bash

# Check file size limits
echo "Checking file size limits (ADR-001)..."
npm run lint:file-size

# Check IPC handler limits
echo "Checking IPC handler limits (ADR-002)..."
npm run lint:ipc-handlers

# Check frozen file modifications
echo "Checking frozen file modifications (ADR-001)..."
npm run lint:frozen-files

# Check CSS file limits
echo "Checking CSS file limits (ADR-007)..."
npm run lint:css-size

# Run critical test suite
echo "Running critical test suite..."
npm run test:critical

# ESLint validation
echo "Running ESLint..."
npm run lint

# Semgrep security scan
echo "Running Semgrep security scan..."
npm run security:scan

echo "✅ All pre-commit checks passed!"
```

---

## References

- [GEMINI.md](./.gemini/GEMINI.md)
- [ADR-001: File Size Guardrail](../docs/architecture/adr/ADR-001-File-Size-Guardrail.md)
- [ADR-002: Vertical Slice Architecture for IPC](../docs/architecture/adr/ADR-002-Vertical-Slice-IPC.md)
- [ADR-003: Dependency Injection over Global State](../docs/architecture/adr/ADR-003-DI-Pattern.md)
- [ADR-006: Solo-Developer Testing & Rollout Strategy](../docs/architecture/adr/ADR-006-Solo-Developer-Testing-Rollout.md)
- [ADR-007: CSS Standards - Tailwind-First Development](../docs/architecture/adr/ADR-007-CSS-Standards.md)
- [Code Standards](../docs/standards/CODE_STANDARDS.md)
