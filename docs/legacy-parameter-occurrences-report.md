## Legacy parameter occurrences report (MJ/PIAPI era)

Generated: 2025-12-15

Purpose: inventory remaining **Midjourney/PIAPI-era fields** and **MJ prompt flags** still referenced in the repo, so we can decide later whether to fully retire them (likely requires production/schema/UI changes).

### Definitions

- **Legacy MJ fields** (schema/UI + old provider era): `parameters.mjVersion`, `parameters.aspectRatios`, and (sometimes) MJ-style prompt flags like `--v`, `--ar`.
- **Legacy PIAPI field**: `apiKeys.piapi`.
- **Runware active provider fields** (current): `apiKeys.runware` and Runware parameters like `runwareModel`, `runwareDimensionsCsv`, `runwareFormat`, `variations`, etc.

---

## A) Schema/UI compatibility (expected to remain until UI/schema cleanup)

These references exist because the **settings shape still contains these fields** in types/default settings/UI forms.

### A1) Settings UI + structure tests (Vitest)

- `tests/integration/settings/BackendAdapter-SettingsUI.integration.test.ts`
  - Asserts `settings.apiKeys.piapi` exists
  - Asserts `settings.parameters.aspectRatios` and `settings.parameters.mjVersion` exist
  - Uses `aspectRatios` + `mjVersion` in sample settings payloads for “Story 1.4 structure”

### A2) Playwright E2E workflow tests

- `tests/e2e/workflows/settings-configuration.e2e.test.ts`
  - Interacts with `piapi` API key field
  - Interacts with “aspect ratios” and “Midjourney version” inputs

### A3) Manual test script

- `tests/manual/settings-persistence-test.js`
  - Includes `apiKeys.piapi`, `parameters.aspectRatios`, `parameters.mjVersion` as part of manual persistence workflow

### A4) App sources that drive this

- `src/renderer/components/Settings/SettingsPanel.tsx`
- `src/renderer/components/Settings/ParametersSection.tsx`
- `src/types/settings.d.ts`, `src/types/job.d.ts`
- `src/database/models/JobConfiguration.js` (default settings include `aspectRatios` + `mjVersion`)
- `src/index.js` (CLI includes `aspectRatios` + `mjVersion`)

**Follow-up options** (production work):
- Decide whether to remove these fields from the UI & types, or mark them explicitly as “legacy/ignored” in the UI.
- If removing: update Settings UI, types, defaults, migrations, and any “merge defaults” logic.

---

## B) Runtime compatibility / legacy behavior retained in code (still referenced by tests)

These references exist because the backend currently **still supports/normalizes** these legacy fields.

### B1) JobRunner legacy field handling

- `src/services/jobRunner.js`
  - Normalizes `aspectRatios` (string → array, fallbacks)
  - Uses `mjVersion` to influence generation parameters (legacy compatibility)

### B2) Params generator appends `--v`

- `src/paramsGeneratorModule.js`
  - Accepts `mjVersion` and `appendMjVersion` and appends ` --v {mjVersion}` to the prompt.

### B3) Tests that cover/mention these behaviors

- `tests/unit/paramsGeneratorModule.test.js`
  - Covers `appendMjVersion` behavior producing `"... --v 6"`
- `tests/unit/logic/jobManagement.logic.test.ts`
  - Includes legacy fields in settings validation/shape scenarios
- `tests/integration/database/JobConfiguration.integration.test.ts`
  - Validates persistence/shape around `aspectRatios` (and related defaults)

**Follow-up options** (production work):
- If we fully drop MJ-era prompt/version handling, remove `appendMjVersion`/`mjVersion` plumbing and adjust tests.
- If we keep it for backwards compatibility, consider renaming/annotating these as legacy fields and make it explicit they do not drive Runware generation.

---

## C) Prompt-flag sanitization (intentional regression guard)

These references exist because we intentionally sanitize Midjourney-style flags from prompts before persisting/exporting.

- `tests/unit/services/JobRunner.executeJob.sanitizePrompt.moreCoverage.test.js`
  - Uses a prompt containing `--v`, `--ar`, `--stylize`, `--q`, `--seed` and asserts they are stripped
- `tests/unit/services/JobRunner.executeJob.db-save-loop.test.js`
  - Includes MJ-style flags in a prompt string as part of DB persistence coverage
- `tests/unit/paramsGeneratorModule.test.js`
  - Asserts appended `--v` in the generated prompt

**Follow-up options**:
- Keep (recommended) as a regression guard even if MJ UI fields are later removed, since users may still paste prompts containing MJ flags.

---

## D) PIAPI references that remain (expected)

These references exist because PIAPI is still present as a **stored key field** and as **legacy provider-related UX/schema**.

### D1) Settings adapter integration

- `tests/integration/api/settingsAdapter.integration.test.ts`
  - Stores/clears `apiKeys.piapi` alongside `openai/runware/removeBg`
  - Uses `piapi-api-key` account name mapping in a keytar mock

### D2) BackendAdapter integration + label tests

- `tests/integration/backend/BackendAdapter.integration.test.ts`
  - Contains PIAPI key fields in some settings payloads (settings/schema coverage)
- `tests/integration/backend/RerunLabelPersistence.integration.test.ts`
  - Contains PIAPI in the “default settings schema” stub

### D3) Export security regression test

- `tests/integration/backend/ExportExcel.integration.test.ts`
  - Keeps `piapi` as a sample secret to ensure API keys are excluded from exports

### D4) App sources driving PIAPI existence

- `src/adapter/backendAdapter.js` (keytar account mapping still includes PIAPI)
- `src/services/errorTranslation.js`, `src/types/errors.d.ts`, `src/types/errors.js` (PIAPI error code)
- `src/database/models/JobConfiguration.js` (default settings include `apiKeys.piapi`)

**Follow-up options** (production work):
- If PIAPI is truly retired: remove PIAPI from settings UI, secure storage mapping, error translation, types, defaults, and add a migration/compat layer if old DBs exist.

---

## Quick sanity note

We previously cleaned up the high-risk cases:
- No remaining tests appear to use **PIAPI/MJ fields as the generation driver** for `startJob()`-style configs where the backend requires Runware.
- Remaining mentions are mostly **schema/UI compatibility**, **legacy parsing behavior**, or **prompt sanitization regression guards**.
