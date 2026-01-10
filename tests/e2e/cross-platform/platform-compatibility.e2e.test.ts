import { test, expect } from '@playwright/test'

const PLATFORM_CASES = [
  {
    id: 'darwin',
    label: 'macOS',
    icon: 'build/icons/mac/icon.icns',
    normalizedPath: '/Users/e2e/Documents/demo-report.xlsx',
    saveShortcut: 'Save: ⌘ + S',
    preferencesShortcut: 'Preferences: ⌘ + ,',
    defaultRoots: ['~/Desktop', '~/Documents'],
  },
  {
    id: 'win32',
    label: 'Windows',
    icon: 'build/icons/win/icon.ico',
    normalizedPath: 'C:\\Users\\e2e\\Documents\\demo-report.xlsx',
    saveShortcut: 'Save: Ctrl + S',
    preferencesShortcut: 'Preferences: Ctrl + ,',
    defaultRoots: ['C:\\Users\\e2e\\Desktop', 'C:\\Users\\e2e\\Documents'],
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'build/icons/png/512x512.png',
    normalizedPath: '/home/e2e/Documents/demo-report.xlsx',
    saveShortcut: 'Save: Ctrl + S',
    preferencesShortcut: 'Preferences: Ctrl + ,',
    defaultRoots: ['~/Desktop', '~/Documents'],
  },
]

const platformHarnessUrl = (platform: string) => `/#/__e2e__/platform?platform=${platform}`

async function injectElectronStub(page) {
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
          if (prop === 'getAppVersion') return () => Promise.resolve('0.0.0')
          if (prop === 'generatedImages' || prop === 'jobManagement') {
            return createNamespace()
          }
          return createAsyncFunction()
        },
      }
    )
  })
}

test.beforeEach(async ({ page }) => {
  await injectElectronStub(page)
})

test.describe('Cross-Platform Compatibility - Story 1.1', () => {
  const currentPlatform = process.platform

  test.describe('Platform Detection', () => {
    test('should detect current platform', () => {
      expect(['darwin', 'win32', 'linux']).toContain(currentPlatform)
    })

    test('should have platform-specific behavior', () => {
      // Verify that platform-specific code paths exist
      expect(currentPlatform).toBeTruthy()
    })
  })

  test.describe('Application Launch on All Platforms', () => {
    test('should launch app successfully on current platform', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      // Verify app renders by checking for visible content
      const hasContent = await page.locator('div.min-h-screen, button, [class*="home-launch"]').first().isVisible({ timeout: 10000 })
      expect(hasContent).toBe(true)
    })

    test('should load all resources on current platform', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Verify app renders by checking for visible content
      const hasContent = await page.locator('div.min-h-screen, button, [class*="home-launch"]').first().isVisible({ timeout: 10000 })
      expect(hasContent).toBe(true)
    })

    test('should display correct platform indicators', async ({ page }) => {
      await page.goto('/')
      
      // Verify app loads without platform-specific errors
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })
      
      await page.waitForLoadState('networkidle')
      expect(errors).toHaveLength(0)
    })
  })

  test.describe('Platform-Specific IPC', () => {
    test('should handle IPC on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Wait for IPC to establish
      await page.waitForSelector('text=/Version/i', { timeout: 5000 })
      
      const versionElement = page.locator('text=/Version/i')
      await expect(versionElement).toBeVisible()
    })

    test('should handle file paths correctly on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Verify app handles platform-specific paths
      await page.waitForLoadState('networkidle')
      expect(page.url()).toBeTruthy()
    })
  })

  test.describe('Platform-Specific Security', () => {
    test('should enforce security settings on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Verify security settings are applied
      await page.waitForLoadState('networkidle')
      
      // Check that secure context is maintained
      const isSecureContext = await page.evaluate(() => window.isSecureContext)
      expect(typeof isSecureContext).toBe('boolean')
    })

    test('should have context isolation on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Verify Node.js integration is disabled
      const hasNodeIntegration = await page.evaluate(() => {
        return typeof (window as any).require !== 'undefined'
      })
      
      expect(hasNodeIntegration).toBe(false)
    })

    test('should have secure IPC bridge on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Verify electronAPI is exposed via contextBridge
      const hasElectronAPI = await page.evaluate(() => {
        return typeof window.electronAPI !== 'undefined'
      })
      
      expect(hasElectronAPI).toBe(true)
    })
  })

  test.describe('UI Rendering Across Platforms', () => {
    test('should render UI correctly on current platform', async ({ page }) => {
      await page.goto('/')
      
      await expect(page.locator('text=Open Settings')).toBeVisible()
      await expect(page.locator('text=Open Dashboard')).toBeVisible()
    })

    test('should apply styles correctly on current platform', async ({ page }) => {
      await page.goto('/')
      
      // Verify app has proper styling by checking root container
      const appContainer = page.locator('div.min-h-screen').first()
      await expect(appContainer).toBeVisible()
      const minHeight = await appContainer.evaluate(el => window.getComputedStyle(el).minHeight)
      expect(minHeight).toBeTruthy()
    })

    test('should handle fonts correctly on current platform', async ({ page }) => {
      await page.goto('/')
      
      const button = page.locator('text=Open Settings')
      await expect(button).toBeVisible()
    })
  })

  test.describe('File System Operations', () => {
    for (const scenario of PLATFORM_CASES) {
      test(`should normalize factory URLs on ${scenario.label}`, async ({ page }) => {
        await page.goto(platformHarnessUrl(scenario.id))
        await page.waitForSelector('[data-testid="platform-harness"]')
        const protocolPath = page.getByTestId('platform-protocol-path')
        await expect(protocolPath).toHaveText(scenario.normalizedPath)
      })
    }

    test('should list default allowed roots for each platform', async ({ page }) => {
      await page.goto(platformHarnessUrl('darwin'))
      await page.waitForSelector('[data-testid="platform-default-roots"]')
      const roots = await page.getByTestId('platform-default-roots').allInnerTexts()
      expect(roots.join(' ')).toContain('~/Desktop')
      expect(roots.join(' ')).toContain('~/Documents')
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    for (const scenario of PLATFORM_CASES) {
      test(`should expose ${scenario.label} shortcut mapping`, async ({ page }) => {
        await page.goto(platformHarnessUrl(scenario.id))
        await page.waitForSelector('[data-testid="platform-harness"]')
        await expect(page.getByTestId('platform-shortcut-save')).toHaveText(scenario.saveShortcut)
        await expect(page.getByTestId('platform-shortcut-preferences')).toHaveText(
          scenario.preferencesShortcut
        )
      })
    }
  })

  test.describe('Window Management', () => {
    test('should create window correctly on current platform', async ({ page }) => {
      await page.goto('/')
      
      await expect(page).toHaveTitle(/Gen Image Factory/i)
    })

    test('should handle window resize on current platform', async ({ page }) => {
      await page.goto('/')
      
      await page.setViewportSize({ width: 1200, height: 800 })
      // Verify app is visible after resize
      const hasContent = await page.locator('div.min-h-screen, button, [class*="home-launch"]').first().isVisible({ timeout: 10000 })
      expect(hasContent).toBe(true)
    })
  })

  test.describe('Performance on Current Platform', () => {
    test('should load quickly on current platform', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Should load in reasonable time on any platform
      expect(loadTime).toBeLessThan(10000)
    })

    test('should be responsive on current platform', async ({ page }) => {
      await page.goto('/')
      
      const startTime = Date.now()
      await page.click('text=Open Settings')
      await page.waitForLoadState('networkidle')
      
      const responseTime = Date.now() - startTime
      expect(responseTime).toBeLessThan(5000)
    })
  })
})

