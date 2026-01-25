# Gemini CLI - Project Context & Governance

**Purpose:** This file defines the complete governance framework for the Gemini CLI to ensure strict adherence to the Gen Image Factory's Architecture Decision Records (ADRs) and brownfield refactoring strategy.

**CRITICAL:** This file mirrors the governance of `CLAUDE.md` for the Gemini environment. All extractions, refactorings, and code modifications **must** comply with the rules defined in this document.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Master Frozen List](#master-frozen-list)
3. [Surgical Extraction Mode](#surgical-extraction-mode)
4. [ADR Enforcement Rules](#adr-enforcement-rules)
5. [Service Boundaries](#service-boundaries)
6. [Testing Requirements](#testing-requirements)
7. [Rollout Strategy](#rollout-strategy)

---

## Project Overview

**Project:** Gen Image Factory  
**Stack:** Electron + React + Node.js + SQLite  
**Pattern:** Brownfield Refactoring using Strangler Fig  
**Workflow:** Solo Developer → Pre-commit Hooks → Push to `main` → CI → Release

**Constraints:**
- **File Size Limit:** All source files **< 400 lines** (ADR-001)
- **CSS File Size Limit:** All CSS files **< 100 lines** (ADR-007)
- **IPC Handler Limit:** All IPC handlers **< 5 lines** (ADR-002)
- **Zero Deletion Policy:** Legacy code remains until new services are proven stable (ADR-006)
- **Feature Toggles Required:** All extractions must use `FEATURE_MODULAR_*` flags (ADR-006)

---

## Master Frozen List

**CRITICAL:** The following files are **FROZEN** per ADR-001. **NO NEW LOGIC** may be added to these files. All new features must be extracted to new Services/Repositories following the Surgical Extraction Mode.

### Backend/Services
- `src/services/jobRunner.js` (3,381 lines)
  - **Extraction:** ADR-002 (IPC Controllers), ADR-003 (Dependency Injection)
  - **Target:** Extract to `JobEngine`, `JobInitializer`, `JobExecutor`, `JobFinalizer`
  
- `src/adapter/backendAdapter.js` (3,407 lines)
  - **Extraction:** ADR-002 (IPC Controllers), ADR-003 (Dependency Injection)
  - **Target:** Extract to `SecurityService`, `JobRepository`, `ExportService`, `IPCControllers`
  
- `src/producePictureModule.js` (799 lines)
  - **Extraction:** ADR-008 (Image Production Layer)
  - **Target:** Extract to `ImageGeneratorService`, `ImageRemoverService`, `ImageProcessorService`
  
- `src/services/retryExecutor.js` (1,160 lines)
  - **Extraction:** ADR-012 (Retry Executor Decomposition)
  - **Target:** Extract to `RetryQueue`, `RetryProcessor`, `RetryStrategy`
  
- `src/database/models/JobExecution.js` (1,100 lines)
  - **Extraction:** ADR-009 (Repository Layer)
  - **Target:** Reduce to < 200 lines schema definition, extract query logic to `JobRepository`
  
- `src/database/models/GeneratedImage.js` (1,000 lines)
  - **Extraction:** ADR-009 (Repository Layer)
  - **Target:** Reduce to < 200 lines schema definition, extract query logic to `ImageRepository`

### Frontend Components
- `src/renderer/components/Dashboard/DashboardPanel.tsx` (1,600 lines)
  - **Extraction:** ADR-010 (Frontend Decomposition)
  - **Target:** Decompose into View/Component/Hook structure
  
- `src/renderer/components/Settings/SettingsPanel.tsx` (1,400 lines)
  - **Extraction:** ADR-010 (Frontend Decomposition)
  - **Target:** Decompose into View/Component/Hook structure
  
- `src/renderer/components/Dashboard/FailedImagesReviewPanel.tsx` (1,200 lines)
  - **Extraction:** ADR-010 (Frontend Decomposition)
  - **Target:** Decompose into View/Component/Hook structure
  
- `src/renderer/components/Jobs/JobManagementPanel.tsx` (1,100 lines)
  - **Extraction:** ADR-010 (Frontend Decomposition)
  - **Target:** Decompose into View/Component/Hook structure

### Infrastructure/Tests
- `tests/integration/backend/BackendAdapter.integration.test.ts` (1,000 lines)
  - **Extraction:** ADR-011 (Modular Testing)
  - **Target:** Split into feature-based test suites
  - **Status:** Immutable Safety Net - must pass on every commit

### Component Styling
- `src/renderer/components/Jobs/SingleJobView.css` (1,300 lines)
  - **Extraction:** ADR-007 (CSS Standards)
  - **Target:** Refactor to Tailwind utilities or CSS Modules (< 100 lines each)

---

## Surgical Extraction Mode

**CRITICAL:** When performing code extractions, you **must** operate in "Surgical Extraction Mode" to ensure zero functional changes during migration.

### Behavioral Lock Rules

**RULE 1: NO RESTYLING**
- Do not reformat code during extraction
- Preserve original indentation, spacing, and code style
- Do not apply Prettier/ESLint auto-formatting during extraction
- Style improvements are a **separate** commit after extraction is verified

**RULE 2: NO VARIABLE RENAMING**
- Preserve original variable names during extraction
- Do not apply naming conventions during the move
- Renaming is a **separate** commit after extraction is verified
- Exception: Only rename if it prevents naming conflicts in the new location

**RULE 3: NO UI CHANGES**
- Do not modify component layouts, styling, or markup during extraction
- Do not change class names, IDs, or data attributes
- UI improvements are a **separate** commit after extraction is verified

**RULE 4: 100% FUNCTIONAL EQUIVALENCE**
- Extracted code must produce **identical output** to legacy code
- Run integration tests with both legacy and new code paths to verify equivalence
- Use Shadow Bridge pattern (ADR-006) to test both paths in parallel

**RULE 5: ZERO LOGIC CHANGES**
- Do not fix bugs during extraction (unless critical for extraction)
- Do not optimize algorithms during extraction
- Do not refactor conditional logic during extraction
- All improvements are **separate** commits after extraction is verified

### Surgical Extraction Workflow

```
STEP 1: Identify Extraction Target
  - Review frozen file to identify feature/responsibility to extract
  - Define service boundary and interface
  - Document dependencies and side effects

STEP 2: Create New Service (Blank Slate)
  - Create new service file with clear responsibility
  - Define constructor with explicit dependencies (ADR-003)
  - Write service interface (method signatures)

STEP 3: Copy Logic (Surgical Precision)
  - Copy logic from legacy file to new service
  - Preserve exact code structure (NO RESTYLING)
  - Preserve exact variable names (NO RENAMING)
  - Add minimal adapter code only if required

STEP 4: Wire Dependencies (DI Pattern)
  - Update ServiceContainer in electron/main.js
  - Inject dependencies via constructor (ADR-003)
  - Ensure legacy code still functions

STEP 5: Implement Shadow Bridge (ADR-006)
  - Add feature flag: FEATURE_MODULAR_[SERVICE_NAME]
  - Add routing logic in frozen monolith
  - Add fallback to legacy if new service fails
  - Default flag to 'false' (legacy active)

STEP 6: Test Both Paths (Verification)
  - Write unit tests for new service (≥70% coverage)
  - Write bridge integration tests (both paths)
  - Run immutable safety net (legacy integration test)
  - Verify 100% functional equivalence

STEP 7: Ship (Safe Rollout)
  - Commit to main with flag disabled
  - CI runs full test suite
  - Deploy to production (legacy active)
  - Enable flag locally and verify
  - Monitor for 2-3 releases before removing legacy
```

---

## ADR Enforcement Rules

**CRITICAL:** These rules **override** any conflicting instructions from other sources. They are non-negotiable.

### ADR-001: File Size Guardrail (< 400 Lines)

**Rule:** All source files must be **< 400 lines**.

**Enforcement:**
- If a file is approaching 400 lines, **STOP** and propose a split
- Split by domain boundaries, not arbitrary line counts
- Example: If `SecurityService.js` reaches 395 lines and you need to add a feature, split into `SecurityService.js` (core) and `ApiKeyService.js` (key management)

**Exemptions:**
- Generated code (migrations, auto-generated types)
- Test files (only if covering a single cohesive test suite)
- Configuration files (JSON, YAML)

### ADR-002: Vertical Slice Architecture for IPC (< 5 Lines)

**Rule:** IPC handlers must be **< 5 lines** and delegate to Services.

**Bad Pattern:**
```javascript
ipc.handle('job:start', async (event, args) => {
  // 50 lines of validation
  // 30 lines of transformation
  // 20 lines of error handling
})
```

**Good Pattern:**
```javascript
// src/controllers/JobController.js
ipc.handle('job:start', (event, args) => 
  jobService.start(args)
)
```

**Enforcement:**
- IPC handlers are thin adapters only
- All validation, transformation, and business logic belong in Services
- Create dedicated Controller files per feature domain:
  - `src/controllers/JobController.js` → handles `job:*` events
  - `src/controllers/SettingsController.js` → handles `settings:*` events
  - `src/controllers/ExportController.js` → handles `export:*` events

### ADR-003: Dependency Injection over Global State

**Rule:** All services must use Dependency Injection - no global state.

**Forbidden Patterns:**
- `global.backendAdapter`
- `process.module.exports` for dependency resolution
- Singleton pattern with global access

**Required Pattern:**
```javascript
// Bad: Global state
class JobRunner {
  saveImage(data) {
    global.backendAdapter.saveGeneratedImage(data);
  }
}

// Good: Dependency injection
class JobRunner {
  constructor(jobRepository) {
    this.jobRepository = jobRepository;
  }
  
  saveImage(data) {
    this.jobRepository.saveGeneratedImage(data);
  }
}
```

**Enforcement:**
- All dependencies must be passed via constructor
- ServiceContainer in `electron/main.js` wires dependencies
- Dependencies are explicit and visible

### ADR-006: Shadow Bridge Pattern (Feature Toggles)

**Rule:** All extractions must use Shadow Bridge pattern with feature toggles.

**Naming Convention:**
- Format: `FEATURE_MODULAR_[SERVICE_NAME]`
- Examples: `FEATURE_MODULAR_SECURITY`, `FEATURE_MODULAR_JOB_REPOSITORY`

**Implementation Pattern:**
```javascript
// In BackendAdapter.js (Frozen Monolith)
async getApiKey(serviceName) {
  if (process.env.FEATURE_MODULAR_SECURITY === 'true') {
    try {
      return await this.securityService.getSecret(serviceName);
    } catch (error) {
      console.warn('New service failed, falling back to legacy:', error);
      return await this._legacyGetApiKey(serviceName);
    }
  }
  // Legacy implementation (default)
  return await this._legacyGetApiKey(serviceName);
}
```

**Enforcement:**
- Feature flags default to `false` (legacy code active)
- Legacy code remains until Phase 5 (after 2-3 stable releases)
- Bridge must support fallback if new service fails

### ADR-007: CSS Standards (Tailwind-First, < 100 Lines)

**Rule:** Tailwind-First development with CSS file size limit < 100 lines.

**Primary Approach:**
- All styling must use Tailwind utility classes as primary method
- Inline Tailwind classes in `.tsx` files
- Custom CSS is the exception, not the rule

**CSS Modules (Exception Cases):**
- Use CSS Modules (`.module.css`) only for:
  - Complex animations that cannot be expressed in Tailwind
  - Pseudo-selectors with complex logic
  - Third-party component overrides requiring specificity
- CSS Modules must be co-located with component
- CSS Modules must remain < 100 lines

**Enforcement:**
- If a CSS file is frozen (e.g., `SingleJobView.css`), **STOP** and propose Tailwind migration
- No new styles may be added to frozen CSS files
- Refactor existing CSS to Tailwind utilities or CSS Modules

### ADR-008: Image Production Layer Extraction

**Rule:** Extract `producePictureModule.js` into modular services.

**Target Services:**
- `ImageGeneratorService` - Runware API integration (lines ~223-519)
- `ImageRemoverService` - remove.bg API + alpha trimming (lines ~21-87, ~584-692)
- `ImageProcessorService` - Sharp-based manipulation (lines ~694-798)

**Interface:** All services accept Buffer/string, return Buffer (pipeline-ready).

### ADR-009: Persistence Repository Layer

**Rule:** Extract database query logic from models to Repository Layer.

**Target:**
- `JobRepository` - CRUD operations for JobConfiguration, JobExecution
- `ImageRepository` - CRUD operations for GeneratedImage

**Database Models:**
- Reduce to < 200 lines containing only Sequelize/SQLite schema definitions
- Move all query logic, hooks, and instance methods to Repository Layer

### ADR-010: Frontend Decomposition Standard

**Rule:** Decompose large React panels into View/Component/Hook structure.

**Structure:**
```
src/renderer/components/Dashboard/
  ├── DashboardView.tsx (< 150 lines) - Layout orchestration
  ├── components/
  │   ├── StatisticsCard.tsx (< 100 lines) - Atomic component
  │   ├── JobsList.tsx (< 150 lines) - Composite component
  │   └── ProgressChart.tsx (< 100 lines) - Atomic component
  └── hooks/
      ├── useDashboardData.ts (< 100 lines) - Data fetching
      └── useDashboardFilters.ts (< 100 lines) - Filter state
```

### ADR-011: Modular Testing Standard

**Rule:** Split large integration tests into feature-based test suites.

**Structure:**
```
tests/integration/backend/
  ├── BackendAdapter.integration.test.ts (Immutable Safety Net)
  ├── security/
  │   └── SecurityService.integration.test.ts
  ├── persistence/
  │   └── JobRepository.integration.test.ts
  └── export/
      └── ExportService.integration.test.ts
```

### ADR-012: Retry Executor Decomposition

**Rule:** Extract `retryExecutor.js` into queue and processor separation.

**Target Services:**
- `RetryQueue` - Queue management and persistence
- `RetryProcessor` - Execution logic and retry strategy
- `RetryStrategy` - Backoff algorithms and retry policies

---

## Service Boundaries

When extracting services from frozen monoliths, follow these boundaries:

### 1. SecurityService (Infrastructure)
- **Responsibility:** API Key management, encryption/decryption, keytar interaction
- **Extracted from:** BackendAdapter (lines ~50-150)
- **Interface:** `getSecret(key)`, `setSecret(key, val)`, `getPublicSettings()`

### 2. JobRepository (Persistence)
- **Responsibility:** CRUD operations for JobConfiguration, JobExecution, GeneratedImage
- **Extracted from:** BackendAdapter (lines ~1000-2000)
- **Goal:** Isolate database logic. Services call `JobRepository.save(job)`, not build raw DB objects.

### 3. ExportService (Feature)
- **Responsibility:** Generating Excel reports and ZIP archives
- **Extracted from:** BackendAdapter (lines ~2200-2600)
- **Logic:** Pure functional transformation of Data → File

### 4. IPCController (Presentation)
- **Responsibility:** Mapping Electron IPC events to Service calls
- **Extracted from:** BackendAdapter (lines ~300-900)
- **Structure:** `src/controllers/[Feature]Controller.js` per feature domain
- **Rule:** Handlers must be < 5 lines

### 5. JobEngine (Core Domain)
- **Responsibility:** Pure orchestration of generation pipeline (Init → ParamGen → ImageGen → QC → Metadata)
- **Refactoring:** Strip out all direct DB calls. Return "Result Objects" that JobService persists via JobRepository.

---

## Testing Requirements

**CRITICAL:** All extractions must meet these testing requirements before merging.

### Tier 1: Unit & Integration Tests (Vitest)
- **Purpose:** Verify new service logic in isolation
- **Coverage:** ≥70% statement and branch coverage for new services
- **Coverage:** 100% coverage for bridge logic (both new and legacy paths)
- **Framework:** Vitest with mocking via Dependency Injection

### Tier 2: Bridge Integration Tests (Vitest)
- **Purpose:** Verify bridge routing logic works correctly
- **Requirements:**
  - Test both new service path (flag enabled) and legacy path (flag disabled)
  - Verify fallback behavior when new service fails
  - Test feature flag toggling behavior

### Tier 3: E2E & Regression Tests (Playwright)
- **Purpose:** Full-flow verification and immutable safety net
- **Requirements:**
  - Legacy integration test (`BackendAdapter.integration.test.ts`) is **immutable safety net**
  - Must pass with feature flags both enabled and disabled
  - E2E tests verify complete user workflows

### Tier 4: Frontend Component Tests (Vitest + React Testing Library)
- **Purpose:** Test atomic components and custom hooks in isolation
- **Framework:** Vitest + React Testing Library
- **Requirements:** Mock IPC calls and external dependencies

---

## Rollout Strategy

**Five-Phase Process** per ADR-006:

### Phase 1: Develop
1. Create new service (e.g., `SecurityService.js`)
2. Write Vitest unit tests (≥70% coverage)
3. Write Vitest integration tests
4. Ensure all tests pass locally

### Phase 2: Bridge
1. Add feature flag to environment configuration
2. Implement bridge routing in frozen monolith
3. Write bridge integration tests (both paths)
4. Ensure legacy code path still works

### Phase 3: Ship
1. Commit to `main` (feature flag defaults to `false`)
2. CI runs full test suite
3. Deploy to production (legacy code active)

### Phase 4: Verify
1. Enable feature flag locally (`FEATURE_MODULAR_[SERVICE]=true`)
2. Run Playwright E2E suite with flag enabled
3. Verify all user workflows function correctly
4. Monitor for regressions or performance issues

### Phase 5: Finalize
1. Once stable in production for 2-3 releases
2. Remove bridge logic and legacy implementation
3. Remove feature flag
4. Update tests to remove legacy path coverage

---

## Code Review Checklist

Before committing, ensure:

- [ ] Files are < 400 lines (or exempted)
- [ ] No new logic added to any file on the Master Frozen List
- [ ] CSS files are < 100 lines (or exempted)
- [ ] Styling uses Tailwind utilities as primary method
- [ ] IPC handlers are < 5 lines and delegate to Services
- [ ] Services use Dependency Injection (no global state)
- [ ] Dependencies are explicit in constructor signatures
- [ ] Service boundaries follow defined extraction strategy
- [ ] Feature toggle implemented (defaults to `false`)
- [ ] Shadow Bridge pattern implemented with fallback
- [ ] Unit tests written (≥70% coverage)
- [ ] Bridge integration tests written (both paths)
- [ ] Immutable safety net passes
- [ ] No restyling, renaming, or UI changes during extraction

---

## References

- [ADR-001: File Size Guardrail](../docs/architecture/adr/ADR-001-File-Size-Guardrail.md)
- [ADR-002: Vertical Slice Architecture for IPC](../docs/architecture/adr/ADR-002-Vertical-Slice-IPC.md)
- [ADR-003: Dependency Injection over Global State](../docs/architecture/adr/ADR-003-DI-Pattern.md)
- [ADR-006: Solo-Developer Testing & Rollout Strategy](../docs/architecture/adr/ADR-006-Solo-Developer-Testing-Rollout.md)
- [ADR-007: CSS Standards - Tailwind-First Development](../docs/architecture/adr/ADR-007-CSS-Standards.md)
- [ADR-008: Image Production Layer Extraction](../docs/architecture/adr/ADR-008-Image-Production-Layer-Extraction.md)
- [ADR-009: Persistence Repository Layer](../docs/architecture/adr/ADR-009-Persistence-Repository-Layer.md)
- [ADR-010: Frontend Decomposition Standard](../docs/architecture/adr/ADR-010-Frontend-Decomposition-Standard.md)
- [ADR-011: Modular Testing Standard](../docs/architecture/adr/ADR-011-Modular-Testing-Standard.md)
- [ADR-012: Retry Executor Decomposition](../docs/architecture/adr/ADR-012-Retry-Executor-Decomposition.md)
- [Code Standards](../docs/standards/CODE_STANDARDS.md)

---

**FINAL REMINDER:** This is a **BROWNFIELD REFACTORING** project. The primary goal is to extract modular services from frozen monoliths while maintaining 100% functional equivalence. All extractions must follow the Surgical Extraction Mode and Shadow Bridge pattern. No shortcuts, no exceptions.
