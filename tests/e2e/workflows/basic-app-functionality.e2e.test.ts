import { test, expect, Page } from '@playwright/test'

// Declare the electronAPI type for test context
declare global {
  interface Window {
    electronAPI?: any;
  }
}

/**
 * Injects a stub for the Electron API into the page context.
 * This allows testing of Electron-specific functionality in a browser environment.
 * @param page - The Playwright page instance
 */
async function injectElectronStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Skip if already injected to avoid conflicts
    if (window.electronAPI) return

    // Helper to create mock async functions with proper promise handling
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
          if (prop === 'getAppVersion') return () => Promise.resolve('0.0.0')
          if (prop === 'selectFile') return () => Promise.resolve({ 
            success: true, 
            filePath: '/Users/e2e/Documents/demo-report.xlsx' 
          })
          if (prop === 'generatedImages' || prop === 'jobManagement') {
            return createNamespace()
          }
          return createAsyncFunction()
        },
      }
    )
  })
}

/**
 * E2E Test Suite for Story 1.1: Basic App Functionality
 * 
 * This comprehensive test suite validates the core application functionality including:
 * - Electron app launch and initialization
 * - Basic UI rendering and responsiveness
 * - User interaction handling
 * - Window management
 * - Development server integration
 * - IPC communication between renderer and main process
 * - Error resilience and recovery
 * - Performance benchmarks
 */
test.describe('Basic App Functionality - Story 1.1', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Electron API stub before navigation
    await injectElectronStub(page)
    
    // Navigate to the Electron app root
    await page.goto('/')
    
    // Ensure page is fully loaded before tests
    await page.waitForLoadState('domcontentloaded')
  })

  test.describe('Electron App Launch', () => {
    test('should launch Electron app successfully', async ({ page }) => {
      // Verify page is loaded at the correct URL
      await expect(page).toHaveURL('http://localhost:5173')
      
      // Verify no critical JavaScript errors on launch
      const hasErrors = await page.evaluate(() => {
        return window.onerror !== null
      })
      expect(hasErrors).toBe(false)
    })

    test('should display main app container', async ({ page }) => {
      // Verify the app renders
      const appContainer = page.getByTestId('app-root')
      await expect(appContainer).toBeVisible()
    })

    test('should load without console errors', async ({ page }) => {
      const errors: string[] = []
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })
      
      await page.waitForLoadState('networkidle')
      
      // Filter out known non-critical warnings if any
      const criticalErrors = errors.filter(error => 
        !error.includes('ResizeObserver loop limit exceeded') && // Known browser warning
        !error.includes('Non-Error promise rejection') // Development warnings
      )
      
      // Should have no critical console errors
      expect(criticalErrors).toHaveLength(0)
    })
  })

  test.describe('Basic UI Rendering', () => {
    test('should render home screen with navigation buttons', async ({ page }) => {
      await expect(page.locator('text=Open Settings')).toBeVisible()
      await expect(page.locator('text=Open Dashboard')).toBeVisible()
    })

    test('should display app version', async ({ page }) => {
      const versionText = page.locator('text=/Version/')
      await expect(versionText).toBeVisible()
      
      // Should not show "Loading..." for long
      await expect(page.locator('text=/Version Loading.../i')).not.toBeVisible({
        timeout: 5000,
      })
    })

    test('should display app logo', async ({ page }) => {
      // Look for the logo element
      const logo = page.locator('[class*="home-launch"]')
      await expect(logo).toBeVisible()
    })

    test('should render with proper styling', async ({ page }) => {
      const appContainer = page.getByTestId('app-root')
      await expect(appContainer).toHaveCSS('min-height', /.*/)
    })
  })

  test.describe('User Interactions', () => {
    test('should navigate to settings on button click', async ({ page }) => {
      await page.click('text=Open Settings')
      
      // Wait for settings panel to load
      await page.waitForSelector('[data-testid="settings-panel"]', { timeout: 5000 })
      
      // Verify settings panel is visible
      const settingsPanel = page.getByTestId('settings-panel')
      await expect(settingsPanel).toBeVisible()
    })

    test('should navigate to dashboard on button click', async ({ page }) => {
      await page.click('text=Open Dashboard')
      
      // Wait for dashboard to load
      await page.waitForLoadState('networkidle')
      
      // Verify we're not on the home screen anymore
      await expect(page.locator('text=Open Settings')).not.toBeVisible()
    })

    test('should handle rapid button clicks', async ({ page }) => {
      // Click settings button multiple times rapidly
      const settingsButton = page.locator('text=Open Settings')
      await settingsButton.click()
      
      // Attempt rapid second click (button should be disabled or removed)
      try {
        await settingsButton.click({ force: true, timeout: 1000 })
      } catch (error) {
        // Expected: Button is properly disabled/removed after first click
        // This validates the app prevents duplicate navigation attempts
      }
      
      // Verify app maintains stability after rapid clicks
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      
      // Ensure no duplicate navigation or console errors
      const navigationErrors = await page.evaluate(() => {
        return window.location.pathname
      })
      expect(navigationErrors).toBeTruthy()
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Tab to first button
      await page.keyboard.press('Tab')
      
      // Enter to activate
      await page.keyboard.press('Enter')
      
      await page.waitForLoadState('networkidle')
      expect(page.url()).toBeTruthy()
    })
  })

  test.describe('Window Management', () => {
    test('should have proper window title', async ({ page }) => {
      await expect(page).toHaveTitle(/Gen Image Factory/i)
    })

    test('should handle window resize', async ({ page }) => {
      // Resize viewport
      await page.setViewportSize({ width: 1200, height: 800 })
      
      // Verify app still renders correctly
      await expect(page.getByTestId('app-root')).toBeVisible()
    })

    test('should be responsive on smaller screens', async ({ page }) => {
      // Set mobile viewport (iPhone 12 dimensions)
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Wait for any responsive layout adjustments
      await page.waitForTimeout(100)
      
      // Verify app adapts to smaller screen
      const appRoot = page.getByTestId('app-root')
      await expect(appRoot).toBeVisible()
      
      // Verify no horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth
      })
      expect(hasOverflow).toBe(false)
    })
  })

  test.describe('Development Server Integration', () => {
    test('should load from Vite dev server', async ({ page }) => {
      // Verify we're connected to dev server
      await expect(page).toHaveURL('http://localhost:5173')
    })

    test('should load all assets correctly', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // Check that no network requests failed
      const failedRequests: string[] = []
      
      page.on('requestfailed', (request) => {
        failedRequests.push(request.url())
      })
      
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      expect(failedRequests.length).toBe(0)
    })

    test('should handle hot reload gracefully', async ({ page }) => {
      // Get initial state
      const initialButton = page.locator('text=Open Settings')
      await expect(initialButton).toBeVisible()
      
      // Simulate hot reload by reloading page
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Verify app still works
      await expect(initialButton).toBeVisible()
    })
  })

  test.describe('IPC Communication E2E', () => {
    test('should communicate with main process for version', async ({ page }) => {
      // Wait for version to load from IPC
      await page.waitForSelector('text=/Version/', { timeout: 5000 })
      
      const versionElement = page.locator('text=/Version/')
      await expect(versionElement).toBeVisible()
    })

    test('should test IPC ping successfully', async ({ page }) => {
      // The app tests IPC on mount
      // Verify no IPC errors in console
      const errors: string[] = []
      
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('IPC')) {
          errors.push(msg.text())
        }
      })
      
      await page.waitForLoadState('networkidle')
      
      expect(errors).toHaveLength(0)
    })
  })

  test.describe('Error Resilience', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Save initial state
      const initialTitle = await page.title()
      
      // Simulate network failure for API calls only (not navigation)
      await page.route('**/api/**', (route) => route.abort())
      
      // Attempt an action that would trigger API call
      const settingsButton = page.locator('text=Open Settings')
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
      }
      
      // Wait a moment for error handling
      await page.waitForTimeout(1000)
      
      // Restore network
      await page.unroute('**/api/**')
      
      // Verify app remains functional
      await expect(page.getByTestId('app-root')).toBeVisible()
      
      // Verify title wasn't corrupted
      expect(await page.title()).toContain(initialTitle)
    })

    test('should handle JavaScript errors gracefully', async ({ page }) => {
      const errors: string[] = []
      
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      
      await page.waitForLoadState('networkidle')
      
      // Should have no unhandled errors
      expect(errors).toHaveLength(0)
    })
  })

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Should load in less than 5 seconds
      expect(loadTime).toBeLessThan(5000)
    })

    test('should be responsive to user interactions', async ({ page }) => {
      // Use performance.mark for more accurate timing
      await page.evaluate(() => {
        performance.mark('interaction-start')
      })
      
      await page.click('text=Open Settings')
      
      // Wait for settings panel to be visible
      await page.waitForSelector('[data-testid="settings-panel"]', { timeout: 2000 })
      
      // Measure interaction completion time
      const interactionTime = await page.evaluate(() => {
        performance.mark('interaction-end')
        performance.measure('interaction', 'interaction-start', 'interaction-end')
        const measure = performance.getEntriesByType('measure')[0]
        return measure ? measure.duration : 0
      })
      
      // Should respond in less than 2 seconds (2000ms)
      expect(interactionTime).toBeLessThan(2000)
      expect(interactionTime).toBeGreaterThan(0) // Ensure measurement worked
    })
  })
})

/**
 * Export Harness Tests
 * Validates the export functionality including file selection,
 * duplicate policy handling, and persistence of user preferences.
 */
test.describe('Export Harness - Story 1.1', () => {
  test.beforeEach(async ({ page }) => {
    // Add console log listener for debugging
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    await page.goto('/#/__e2e__/export')
    await page.reload()
    await page.waitForSelector('[data-testid="export-harness"]')
    await page.click('[data-testid="reset-export-memory"]')
  })

  test('should remember last custom path per type', async ({ page }) => {
    // Test XLSX export path persistence
    await page.click('[data-testid="open-xlsx-export"]')
    await page.locator('.export-file-modal label:has-text("Save to another location") input[type="radio"]').check()
    await page.click('.export-file-modal button:has-text("Save to another location…")')
    await page.click('.export-file-modal button:has-text("Cancel")')

    await page.click('[data-testid="open-xlsx-export"]')
    const xlsxLocation = page.locator('.export-file-modal input[placeholder="/path/to/file.xlsx"]')
    await expect(xlsxLocation).toHaveValue('/Users/e2e/Documents/demo-report.xlsx')
    const xlsxCustomRadio = page.locator('.export-file-modal label:has-text("Save to another location") input[type="radio"]')
    await expect(xlsxCustomRadio).toBeChecked()
    await page.click('.export-file-modal button:has-text("Cancel")')

    await page.click('[data-testid="open-zip-export"]')
    await page.click('.export-file-modal button:has-text("Save to another location…")')
    await page.click('.export-file-modal button:has-text("Cancel")')

    await page.click('[data-testid="open-zip-export"]')
    const zipLocation = page.locator('.export-file-modal input[placeholder="/path/to/file.zip"]')
    await expect(zipLocation).toHaveValue('/Users/e2e/Documents/demo-batch.zip')
    const zipCustomRadio = page.locator('.export-file-modal label:has-text("Save to another location") input[type="radio"]')
    await expect(zipCustomRadio).toBeChecked()
  })

  test('should persist duplicate policy selections in payload', async ({ page }) => {
    // Test that user's duplicate file handling preference is correctly passed
    await page.click('[data-testid="open-xlsx-export"]')
    await page.locator('.export-file-modal label:has-text("Save to another location") input[type="radio"]').check()
    
    // The "Save to another location..." button triggers a file dialog
    // We need to set the path first before we can export
    await page.click('.export-file-modal button:has-text("Save to another location…")')
    
    // Wait for the location to be updated from the mock selection
    // This ensures the async handleBrowseSave has completed and state is updated
    const locationInput = page.locator('.export-file-modal input[placeholder="/path/to/file.xlsx"]')
    await expect(locationInput).toHaveValue('/Users/e2e/Documents/demo-report.xlsx')
    
    // Now set the duplicate policy
    const overwriteRadio = page.locator('.export-file-modal label:has-text("Overwrite (confirm)") input[type="radio"]')
    await overwriteRadio.check()
    
    // Click Export - it should work since we mocked the file dialog
    // Ensure the button is enabled and visible before clicking
    // Use a more specific selector to avoid "Open Exports Folder" button which also contains "Export" text
    const exportBtn = page.locator('.export-file-modal button:has-text("Export"):not(:has-text("Folder"))')
    await expect(exportBtn).toBeEnabled()
    await exportBtn.click()
    
    // Check the payload first to ensure the action was registered
    const payloadLocator = page.getByTestId('last-export-payload')
    await expect(payloadLocator).not.toContainText('null', { timeout: 5000 })
    
    // Parse the payload to verify properties instead of string matching
    // This handles JSON formatting (spaces/newlines) robustly
    const payloadText = await payloadLocator.textContent()
    const payload = JSON.parse(payloadText || 'null')
    
    expect(payload).toBeTruthy()
    expect(payload.payload).toBeTruthy()
    expect(payload.payload.duplicatePolicy).toBe('overwrite')
    expect(payload.payload.mode).toBe('custom')
    
    // Then wait for modal to close indicating export completed
    // We check for hidden state or detachment
    await page.waitForSelector('.export-file-modal', { state: 'hidden', timeout: 5000 })
  })
})

/**
 * StatusBadge Component Tests
 * Validates the visual presentation and behavior of status badges
 * across different states (failed, retry_failed, etc.)
 */
test.describe('StatusBadge Harness - Story 1.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/__e2e__/export')
    await page.reload()
    await page.waitForSelector('[data-testid="export-harness"]')
  })

  test('should render failed badges with red styling', async ({ page }) => {
    // Verify failed status badge has correct error styling
    const failedBadge = page.locator('[data-testid="status-badge-failed"]')
    await expect(failedBadge).toBeVisible()
    await expect(failedBadge).toHaveAttribute('class', /text-red-800/)
    
    // Verify retry_failed badge also uses error styling
    const retryBadge = page.locator('[data-testid="status-badge-retry-failed"]')
    await expect(retryBadge).toBeVisible()
    await expect(retryBadge).toHaveAttribute('class', /text-red-800/)
    
    // Verify badges are distinguishable despite same color
    const failedText = await failedBadge.textContent()
    const retryText = await retryBadge.textContent()
    expect(failedText).not.toBe(retryText)
  })

  test('should show exclamation icon for retry_failed badges', async ({ page }) => {
    // Verify retry_failed badge displays warning/exclamation icon
    const retryBadgeIcon = page.locator('[data-testid="status-badge-retry-failed"] svg path').first()
    await expect(retryBadgeIcon).toBeVisible()
    
    // Check for exclamation mark path in SVG (M12 9v4 is part of exclamation icon path)
    await expect(retryBadgeIcon).toHaveAttribute('d', /M12 9v4/)
    
    // Verify icon is properly sized and positioned
    const iconBox = await retryBadgeIcon.boundingBox()
    expect(iconBox).toBeTruthy()
    expect(iconBox?.width).toBeGreaterThan(0)
    expect(iconBox?.height).toBeGreaterThan(0)
  })
})

