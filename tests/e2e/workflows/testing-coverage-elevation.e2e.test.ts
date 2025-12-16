import { test, expect } from '@playwright/test'

test.describe('Testing Coverage Elevation - critical E2E gaps (Story 1.19)', () => {
  const injectElectronProxyStub = async (page: any) => {
    await page.addInitScript(() => {
      if (window.electronAPI) return

      const createAsyncFunction = () => {
        const fn = function () {}
        return new Proxy(fn, {
          apply: () => Promise.resolve(undefined),
          get: (_target, prop) => {
            if (prop === 'then') return undefined
            return createAsyncFunction()
          },
        })
      }

      const createNamespace = () =>
        new Proxy(
          {},
          {
            get: (_target, prop) => {
              if (prop === 'then') return undefined
              if (typeof prop === 'string' && prop.startsWith('on')) {
                return () => {}
              }
              return createAsyncFunction()
            },
          }
        )

      window.electronAPI = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === 'ping') return () => Promise.resolve('pong')
            if (prop === 'getAppVersion') return () => Promise.resolve('e2e')
            if (prop === 'generatedImages' || prop === 'jobManagement') return createNamespace()
            return createAsyncFunction()
          },
        }
      )
    })
  }

  test('export flow surfaces save-dialog permission errors', async ({ page }) => {
    await page.addInitScript(() => {
      // Ensure the harness uses this stub instead of its default `ensureElectronStub()`.
      // Simulate a save-dialog failure (e.g., permission denied / invalid path).
      window.electronAPI = {
        ping: async () => 'pong',
        getAppVersion: async () => 'e2e',
        getExportsFolderPath: async () => ({ success: true, path: '/Users/e2e/Exports' }),
        openExportsFolder: async () => ({ success: true }),
        selectFile: async () => {
          throw new Error('EACCES: permission denied')
        },
        generatedImages: {
          onZipExportProgress: () => {},
          onZipExportCompleted: () => {},
          onZipExportError: () => {},
          removeZipExportProgress: () => {},
          removeZipExportCompleted: () => {},
          removeZipExportError: () => {},
        },
        jobManagement: {
          rerunJobExecution: async () => ({ success: true }),
          deleteJobExecution: async () => ({ success: true }),
        },
      }
    })

    await page.goto('/#/__e2e__/export')
    await page.waitForSelector('[data-testid="export-harness"]')

    await page.click('[data-testid="open-xlsx-export"]')
    await expect(page.locator('.export-file-modal')).toBeVisible()

    // Trigger the save dialog via the CTA button (calls electronAPI.selectFile with xlsx filters).
    const cta = page.locator('.export-file-modal button:has-text("Save to another location…")')
    await cta.click()

    await expect(page.locator('.export-file-modal')).toBeVisible()
    await expect(page.locator('.export-file-modal')).toContainText('EACCES: permission denied')
  })

  test('window reload resilience on dashboard route', async ({ page }) => {
    await injectElectronProxyStub(page)

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('text=Open Settings')).toBeVisible()
    await expect(page.locator('text=Open Dashboard')).toBeVisible()

    // Reload should not crash and should keep core navigation working.
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Open Dashboard')).toBeVisible()
    await expect(page.locator('text=Open Settings')).toBeVisible()
  })

  // TODO(Story 1.19, owner: Quinn): add true SQLite-backed Electron E2E coverage for:
  // - first-run migrations + existing DB launch
  // - CRUD flows that hit SQLite
  // - DB-locked/constraint error surfacing
  // - export failure after backend write (permission/invalid path) in real filesystem
  // - offline/online recovery when backend/DB is unavailable
})

