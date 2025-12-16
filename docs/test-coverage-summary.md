# Test Coverage Summary

**Generated**: 2025-12-15  
**Test Suite**: 1360 tests passing, 0 skipped (100% pass rate)
**Coverage Tool**: @vitest/coverage-v8  
**Coverage Scope**: Unit and Integration tests only (E2E tests excluded)

## Overall Coverage Statistics

| Metric | Overall |
|--------|---------|
| **Statements** | 68.06% |
| **Branches** | 68.49% |
| **Functions** | 59.91% |
| **Lines** | 68.06% |

### Coverage Breakdown by Layer

**Note**: This run captures updated overall + file-level coverage. If you need an updated “Frontend vs Backend” split, derive it from the full Vitest report output (not included verbatim here).

## Coverage by Category

### Frontend Code (src/renderer)
**Overall**: 61.39% statements, 50% branches, 19.04% functions, 61.39% lines

**Coverage Summary**: Frontend has good coverage with comprehensive component tests. Most React components are well-tested with unit and integration tests.

#### Dashboard Components
- **DashboardPanel.tsx**: 67.14% statements, 66.53% branches, 38.88% functions
- **FailedImageCard.tsx**: 98.44% statements, 62.96% branches, 58.33% functions
- **FailedImageReviewModal.tsx**: 85.36% statements, 56.73% branches, 56.52% functions
- **FailedImagesReviewPanel.tsx**: 59.47% statements, 68.22% branches, 56.81% functions
- **ImageGallery.tsx**: 73.09% statements, 60.18% branches, 45.45% functions
- **ImageModal.tsx**: 79.86% statements, 51.81% branches, 35% functions
- **JobHistory.tsx**: 88.35% statements, 75% branches, 79.16% functions
- **LogViewer.tsx**: 81.57% statements, 80.3% branches, 83.33% functions
- **ProcessingSettingsModal.tsx**: 92.28% statements, 87.23% branches, 88.23% functions

#### Jobs Components
- **JobTable.tsx**: 94.59% statements, 87.14% branches, 63.63% functions
- **SingleJobView.tsx**: 73.26% statements, 65.62% branches, 32.65% functions
- **JobFilters.tsx**: 100% statements, 94% branches, 84.61% functions
- **JobStatistics.tsx**: 98.37% statements, 92.1% branches, 100% functions
- **BatchOperationsToolbar.tsx**: 98.39% statements, 93.93% branches, 100% functions

#### Settings Components
- **SettingsPanel.tsx**: 59.61% statements, 67.41% branches, 42.3% functions
- **ApiKeysSection.tsx**: 74.92% statements, 64.91% branches, 50% functions
- **ParametersSection.tsx**: 90.83% statements, 83.78% branches, 80.64% functions
- **FilePathsSection.tsx**: 83.54% statements, 53.65% branches, 33.33% functions
- **SecureInput.tsx**: 87.14% statements, 79.72% branches, 100% functions
- **FileSelector.tsx**: 65.24% statements, 72.13% branches, 62.5% functions

### Backend Code

#### Backend Services (src/services)
**Overall**: 36.82% statements, 66.38% branches, 62% functions

**Coverage Summary**: Backend services have low coverage and need significant improvement, especially for critical business logic.

- **jobRunner.js**: 23.04% statements, 65.01% branches, 59.09% functions
- **retryExecutor.js**: 74.34% statements, 70.35% branches, 84.61% functions
- **errorTranslation.js**: 51.65% statements, 100% branches, 12.5% functions

#### Database Layer (migrations, backup, models)
**Coverage Summary**: Backup/restore tests are now un-skipped and stabilized via sqlite3 mocks + isolated temp paths; JobConfiguration init error paths are covered.

- **backupManager.js**: 82.23% statements, 70.68% branches, 100% functions
- **transactionManager.js**: 84.92% statements, 68.62% branches, 87.5% functions
- **migrations/**: 78.98% statements, 79.54% branches, 81.81% functions
- **src/database/migrations/index.js**: 66.26% statements, 79.54% branches, 81.81% functions
- **GeneratedImage.js**: 63.63% statements, 64.11% branches, 72% functions
- **JobConfiguration.js**: 62.4% statements, 69.74% branches, 64% functions
- **JobExecution.js**: 65.03% statements, 70.73% branches, 76.92% functions

#### Adapter Layer (src/adapter)
**Overall**: 70.18% statements, 70.13% branches, 80.24% functions

**Coverage Summary**: BackendAdapter has moderate coverage. Main API endpoints are tested, but error handling and edge cases need more coverage.

- **backendAdapter.js**: 70.18% statements, 70.13% branches, 80.24% functions

#### Utilities (src/utils)
**Overall**: 95.58% statements, 78.94% branches, 85.71% functions

**Coverage Summary**: Utility functions have good coverage, especially processing utilities which are well-tested.

- **processing.js**: 94.68% statements, 77.77% branches, 100% functions
- **logMasking.js**: 95.38% statements, 76.47% branches, 80% functions
- **logDebug.js**: 100% statements, 100% branches, 100% functions

### Low Coverage Areas

#### Zero Coverage (0%)
- **src/constant/keywords_food.js**

#### Excluded from Coverage (entrypoints / side-effect modules)
- **src/index.js**
- **src/utils.js**

#### Very Low Coverage (<25% statements)
- **src/services/jobRunner.js**: 23.04% statements

#### Notable Improvements (this story)
- **src/paramsGeneratorModule.js**: 96.69% statements, 90.47% branches
- **src/database/backupManager.js**: 82.23% statements, 70.68% branches (previously very low)
- **src/database/migrations/**: migration scripts are now covered; multi-statement migrations execute via `db.exec`
- **src/database/transactionManager.js**: added unit tests + fixed transaction callback binding

#### Remaining Gaps / Follow-ups
- **Overall guardrail not yet met**: overall coverage is still below **≥70% statements/branches**.
- **JobRunner remains low statements**: `src/services/jobRunner.js` still has low statement coverage; continue adding **scenario-driven, integration-like** tests that execute larger orchestration slices (stop/cancel, rerun persistence, QC + processing + DB persistence), and avoid micro-tests just to hit numeric targets.

## Frontend vs Backend Coverage Comparison

### Frontend Coverage (61.39% statements)
**Strengths**:
- Component tests cover most UI interactions
- State management and props are well-tested
- User workflows are covered through component tests

**Areas for Improvement**:
- Error states and edge cases in complex components
- Accessibility features
- Performance optimizations

### Backend Services Coverage (36.82% statements)
**Strengths**:
- Database layer is in moderate shape overall (see DB section above)
- Utility functions are strong (see `src/utils` section above)
- Adapter layer meets the ≥70% per-file target for `backendAdapter.js`

**Critical Gaps**:
- **Backend Services** (36.82%): Core business logic still needs significant improvement
  - `jobRunner.js` (23.04%): Critical job execution logic
  - `retryExecutor.js` now meets the ≥70% per-file target (74.34% statements, 70.35% branches)

## Recommendations

### High Priority (Critical Business Logic)
1. **Backend Services** (36.82% coverage) - **CRITICAL**
   - `jobRunner.js` (23.04%): Core job execution logic needs more integration tests
   - These are critical paths that handle job processing and retries
   - **Impact**: Low backend coverage means critical business logic is not fully tested

2. **Database Layer** (0–41% for migrations/backup)
   - Migration scripts should have integration tests (and rollback/idempotency checks)
   - Backup manager should be tested for data integrity across happy/corrupt/missing file cases

3. **Adapter Layer** (≥70% per-file met for `backendAdapter.js`)
   - Continue expanding error-path coverage as new handlers are added

### Medium Priority (UI Components)
1. **SettingsPanel.tsx** (59.61%): Main settings UI still needs more edge/error/a11y scenarios
2. **SingleJobView.tsx** (73.26%): Complex component with many edge cases
3. **ExportDialog.tsx**: Improved (90.66%) but keep an eye on failure/permission edge cases

### Low Priority (Utilities and Constants)
1. **Constants and Keywords**: Low priority as these are mostly data
2. **Utility Functions**: Some utilities have good coverage (processing.js at 86.17%)

## Test Types Coverage

### Unit Tests
- **Frontend Components**: Good coverage (59-100% for most components)
- **Database Models**: Moderate coverage (46-65%)
- **Utilities**: Good coverage (76% overall)

### Integration Tests
- **Backend Adapter**: Moderate coverage (49.77%)
- **Settings API**: Good coverage (tests passing)
- **Database Operations**: Good coverage (tests passing)

### E2E Tests (Playwright)
- **Not included in this coverage report** - E2E tests run separately via Playwright
- E2E tests provide additional coverage for user workflows but are not measured by Vitest coverage
- E2E tests cover:
  - Complete user workflows (job creation, processing, export)
  - Cross-platform compatibility
  - Electron app packaging and launch
  - UI interactions and accessibility
- To get complete coverage picture, E2E tests should be considered separately

## Coverage Goals

Based on `docs/architecture/testing-strategy.md`:
- **Unit Tests**: Minimum 80% coverage (Current: 51.94% overall)
- **Integration Tests**: Minimum 70% coverage (Current: ~50% for adapter layer)
- **E2E Tests**: Coverage of all critical user workflows

## Next Steps

1. **Increase Backend Service Coverage**
   - Add more integration tests for `jobRunner.js`
   - Keep `retryExecutor.js` above ≥70% statements/branches as it evolves
   - Focus on error handling and edge cases

2. **Increase Adapter Coverage**
   - Add tests for error paths in `backendAdapter.js`
   - Test IPC handler registration and error handling
   - Test all API endpoints

3. **Add Migration Tests**
   - Test database migration scripts
   - Test backup/restore functionality

4. **Improve Component Coverage**
   - Add tests for error states in components
   - Add tests for edge cases in complex components
   - Test accessibility features

## Notes

### Coverage Scope
- **Included**: Unit tests and Integration tests (Vitest)
- **Excluded**: E2E tests (Playwright) - these run separately and are not measured by Vitest coverage
- Coverage excludes test files themselves, build artifacts, and node_modules
- E2E tests provide additional coverage but are measured separately

### Why E2E Tests Are Excluded
- E2E tests run in a separate process (Playwright/Electron)
- Vitest coverage only measures code executed during Vitest test runs
- E2E tests execute the full application, but coverage instrumentation is not active
- To measure E2E coverage, you would need Playwright's coverage tools or manual instrumentation

### Files Not Covered
- Some files (like `src/index.js`) may not be testable in unit tests and require E2E coverage
- Database migrations and backup functionality may require separate integration test strategy
- Electron main process code may have limited unit test coverage (requires E2E or integration tests)

