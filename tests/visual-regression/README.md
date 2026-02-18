# Visual regression baselines (Story 3.4)

Baseline screenshots for panel decomposition. Used to enforce **ZERO visual changes** (AC 11).

## Capturing baselines (Phase 0.5)

Ensure Playwright browsers are installed: `npx playwright install`

Run once (or when you intend to update baselines):

```bash
CAPTURE_VISUAL_BASELINES=1 npx playwright test tests/e2e/visual-regression/panel-baselines.e2e.test.ts --project=chromium
```

Screenshots are written to `tests/visual-regression/baselines/`.

## Comparing (Phase 6)

Visual regression tests compare current UI to these baselines. Run with:

```bash
npx playwright test tests/e2e/visual-regression/ --project=chromium
```

(Comparison tests to be added in Phase 6.)

## Baseline files

- `dashboard-initial.png` – Dashboard panel (main view)
- `failed-review-initial.png` – Failed Images Review panel
- `job-management-initial.png` – Job Management panel
- `settings-api-keys.png` – Settings, API Keys tab
- `settings-files.png` – Settings, File Paths tab
- `settings-parameters.png` – Settings, Parameters tab
- `settings-processing.png` – Settings, Processing tab
- `settings-ai.png` – Settings, AI Features tab
- `settings-advanced.png` – Settings, Advanced tab
