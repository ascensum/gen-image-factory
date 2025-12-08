# Test Coverage Summary

**Generated**: 2025-12-08  
**Test Suite**: 1030 tests passing, 2 skipped (99.8% pass rate)  
**Coverage Tool**: @vitest/coverage-v8  
**Coverage Scope**: Unit and Integration tests only (E2E tests excluded)

## Overall Coverage Statistics

| Metric | Overall | Frontend | Backend |
|--------|---------|----------|---------|
| **Statements** | 51.94% | 59.33% | 34.17% |
| **Branches** | 62.41% | 57.14% | 12.22% |
| **Functions** | 50.47% | 15% | 46.66% |
| **Lines** | 51.94% | 59.33% | 34.17% |

### Coverage Breakdown by Layer

**Frontend (src/renderer)**: 59.33% statements, 57.14% branches, 15% functions
- React components and UI logic
- User interactions and state management
- IPC communication with backend

**Backend (src/adapter, src/services, src/database, src/utils)**: 34.17% statements, 12.22% branches, 46.66% functions
- Business logic and API layer
- Database operations
- Service orchestration
- Image processing

**Note**: The overall 51.94% is a weighted average of frontend and backend coverage. Frontend has higher coverage due to comprehensive component tests, while backend services need more integration tests.

## Coverage by Category

### Frontend Code (src/renderer)
**Overall**: 59.33% statements, 57.14% branches, 15% functions, 59.33% lines

**Coverage Summary**: Frontend has good coverage with comprehensive component tests. Most React components are well-tested with unit and integration tests.

#### Dashboard Components
- **DashboardPanel.tsx**: 63.69% statements, 66.37% branches, 29.62% functions
- **FailedImageCard.tsx**: 98.44% statements, 62.96% branches, 58.33% functions
- **FailedImageReviewModal.tsx**: 85.36% statements, 56.73% branches, 56.52% functions
- **FailedImagesReviewPanel.tsx**: 59.47% statements, 68.22% branches, 56.81% functions
- **ImageGallery.tsx**: 70.76% statements, 54.9% branches, 45.45% functions
- **ImageModal.tsx**: 79.86% statements, 51.81% branches, 35% functions
- **JobHistory.tsx**: 88.35% statements, 75% branches, 79.16% functions
- **LogViewer.tsx**: 81.57% statements, 80.3% branches, 83.33% functions
- **ProcessingSettingsModal.tsx**: 92.28% statements, 87.23% branches, 88.23% functions

#### Jobs Components
- **JobTable.tsx**: 94.59% statements, 87.14% branches, 63.63% functions
- **SingleJobView.tsx**: 72.63% statements, 63.52% branches, 30.61% functions
- **JobFilters.tsx**: 100% statements, 94% branches, 84.61% functions
- **JobStatistics.tsx**: 98.37% statements, 92.1% branches, 100% functions
- **BatchOperationsToolbar.tsx**: 98.39% statements, 93.93% branches, 100% functions

#### Settings Components
- **SettingsPanel.tsx**: 53.95% statements, 48.57% branches, 32.69% functions
- **ApiKeysSection.tsx**: 74.92% statements, 64.91% branches, 50% functions
- **ParametersSection.tsx**: 90.83% statements, 83.78% branches, 80.64% functions
- **FilePathsSection.tsx**: 83.54% statements, 53.65% branches, 33.33% functions
- **SecureInput.tsx**: 86.74% statements, 79.45% branches, 100% functions
- **FileSelector.tsx**: 65.24% statements, 72.13% branches, 62.5% functions

### Backend Code

#### Backend Services (src/services)
**Overall**: 15.61% statements, 35.03% branches, 29.59% functions

**Coverage Summary**: Backend services have low coverage and need significant improvement, especially for critical business logic.

- **jobRunner.js**: 13% statements, 26.43% branches, 31.25% functions
- **retryExecutor.js**: 15.47% statements, 52.56% branches, 30.76% functions
- **errorTranslation.js**: 51.65% statements, 100% branches, 12.5% functions

#### Database Models (src/database/models)
**Overall**: 54.21% statements, 64.12% branches, 68% functions

**Coverage Summary**: Database models have moderate coverage with good function coverage. Integration tests cover most CRUD operations.

- **GeneratedImage.js**: 59.18% statements, 60.83% branches, 68% functions
- **JobConfiguration.js**: 64.63% statements, 60% branches, 72% functions
- **JobExecution.js**: 46.05% statements, 70.71% branches, 64% functions

#### Adapter Layer (src/adapter)
**Overall**: 49.77% statements, 50.74% branches, 55.55% functions

**Coverage Summary**: BackendAdapter has moderate coverage. Main API endpoints are tested, but error handling and edge cases need more coverage.

- **backendAdapter.js**: 49.77% statements, 50.74% branches, 55.55% functions

#### Utilities (src/utils)
**Overall**: 76.24% statements, 66.66% branches, 57.14% functions

**Coverage Summary**: Utility functions have good coverage, especially processing utilities which are well-tested.

- **processing.js**: 86.17% statements, 68.75% branches, 100% functions
- **logMasking.js**: 78.46% statements, 60% branches, 40% functions
- **logDebug.js**: 27.27% statements, 50% branches, 100% functions

### Low Coverage Areas

#### Zero Coverage (0%)
- **src/index.js**: 0% (main entry point, likely not testable in unit tests)
- **src/utils.js**: 0% (utility functions)
- **src/database/backupManager.js**: 0% (backup functionality)
- **src/database/migrationManager.js**: 0% (migration functionality)
- **src/database/migrations/**: 0% (migration scripts)
- **src/database/index.js**: 0% (database initialization)
- **src/constant/keywords_food.js**: 0% (constant data)

#### Very Low Coverage (<20%)
- **src/aiVision.js**: 18.51% statements
- **src/producePictureModule.js**: 5.78% statements
- **src/services/jobRunner.js**: 13% statements
- **src/services/retryExecutor.js**: 15.47% statements

## Frontend vs Backend Coverage Comparison

### Frontend Coverage (59.33% statements)
**Strengths**:
- Component tests cover most UI interactions
- State management and props are well-tested
- User workflows are covered through component tests

**Areas for Improvement**:
- Error states and edge cases in complex components
- Accessibility features
- Performance optimizations

### Backend Coverage (34.17% statements)
**Strengths**:
- Database models have good CRUD operation coverage (54.21%)
- Utility functions are well-tested (76.24%)
- Adapter layer has moderate coverage (49.77%)

**Critical Gaps**:
- **Backend Services** (15.61%): Core business logic needs significant improvement
  - `jobRunner.js` (13%): Critical job execution logic
  - `retryExecutor.js` (15.47%): Critical retry functionality
- **Database Infrastructure** (0%): Migrations and backup not tested
- **Entry Points** (0%): `src/index.js` not covered (may require E2E tests)

## Recommendations

### High Priority (Critical Business Logic)
1. **Backend Services** (15.61% coverage) - **CRITICAL**
   - `jobRunner.js` (13%): Core job execution logic needs more integration tests
   - `retryExecutor.js` (15.47%): Retry functionality needs comprehensive testing
   - These are critical paths that handle job processing and retries
   - **Impact**: Low backend coverage means critical business logic is not fully tested

2. **Database Layer** (0% for migrations/backup)
   - Migration scripts should have integration tests
   - Backup manager should be tested for data integrity

3. **Adapter Layer** (49.77% coverage)
   - `backendAdapter.js` is the main API layer and should have higher coverage
   - Focus on error handling paths and edge cases

### Medium Priority (UI Components)
1. **SettingsPanel.tsx** (53.95%): Main settings UI needs more test scenarios
2. **SingleJobView.tsx** (72.63%): Complex component with many edge cases
3. **ExportDialog.tsx** (37.33%): Export functionality needs more coverage

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
   - Add more integration tests for `retryExecutor.js`
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

