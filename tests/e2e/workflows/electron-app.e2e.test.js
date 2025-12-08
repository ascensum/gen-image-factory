/**
 * Electron Application E2E Tests
 * 
 * This test suite validates the packaged Electron application:
 * - Verifies the Electron main process launches correctly
 * - Confirms the renderer process loads properly
 * - Validates the preload API is exposed to the renderer
 * - Tests Electron-specific functionality that can't be tested in browser
 */

const { test, expect, _electron: electron } = require('@playwright/test')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '../../..')
const rendererIndex = path.resolve(projectRoot, 'electron', 'renderer', 'index.html')

/**
 * Ensures the renderer bundle is built before running Electron tests.
 * Builds the application if the renderer index.html doesn't exist.
 */
const ensureRendererBundle = () => {
  if (!existsSync(rendererIndex)) {
    console.log('Renderer bundle not found. Building application...')
    try {
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' })
      console.log('Build completed successfully')
    } catch (error) {
      console.error('Build failed:', error.message)
      throw new Error('Failed to build renderer bundle for Electron tests')
    }
  }
}

// Set test timeout for Electron tests (they can take longer to start/stop)
test.describe.configure({ timeout: 60000 })

test.describe('Packaged Electron app', () => {
  test('launches renderer and exposes preload API', async () => {
    // Ensure the application is built
    ensureRendererBundle()
    
    let electronApp
    try {
      // Launch the Electron application
      electronApp = await electron.launch({ 
        args: ['.'],
        timeout: 30000 // Allow 30 seconds for app launch
      })
      
      // Get the first window (main window)
      const window = await electronApp.firstWindow()
      
      // Wait for the page to be fully loaded
      await window.waitForLoadState('domcontentloaded')
      
      // Verify the application title
      await expect(window).toHaveTitle(/Gen Image Factory/i)
      
      // Verify the Electron API is exposed via preload script
      const hasElectronApi = await window.evaluate(() => typeof window.electronAPI !== 'undefined')
      expect(hasElectronApi).toBe(true)
      
      // Verify specific API methods are available
      const apiMethods = await window.evaluate(() => {
        if (typeof window.electronAPI === 'undefined') return []
        return Object.keys(window.electronAPI).filter(key => typeof window.electronAPI[key] === 'function')
      })
      
      // Should have essential API methods
      expect(apiMethods).toContain('ping')
      expect(apiMethods).toContain('getAppVersion')
      expect(apiMethods).toContain('getSettings')
      
      // Test ping functionality
      const pingResult = await window.evaluate(async () => {
        if (window.electronAPI && window.electronAPI.ping) {
          return await window.electronAPI.ping()
        }
        return null
      })
      expect(pingResult).toBe('pong')
    } finally {
      // Ensure app is closed even if test fails
      if (electronApp) {
        try {
          await electronApp.close()
        } catch (closeError) {
          console.log('Error closing Electron app:', closeError.message)
          // Force kill if normal close fails
          await electronApp.process().kill()
        }
      }
    }
  })
  
  test('handles multiple windows correctly', async () => {
    ensureRendererBundle()
    
    let electronApp
    try {
      electronApp = await electron.launch({ 
        args: ['.'],
        timeout: 30000 // 30 second launch timeout
      })
      
      const window = await electronApp.firstWindow()
      
      // Get all windows
      const windows = electronApp.windows()
      
      // Should have at least the main window
      expect(windows.length).toBeGreaterThanOrEqual(1)
      
      // Verify each window has the preload API
      for (const win of windows) {
        const hasApi = await win.evaluate(() => typeof window.electronAPI !== 'undefined')
        expect(hasApi).toBe(true)
      }
    } finally {
      // Ensure app is closed even if test fails
      if (electronApp) {
        try {
          await electronApp.close()
        } catch (closeError) {
          console.log('Error closing Electron app:', closeError.message)
          // Force kill if normal close fails
          await electronApp.process().kill()
        }
      }
    }
  })
  
  test.skip('respects Electron security best practices', async () => {
    // This test is skipped by default but documents security requirements
    ensureRendererBundle()
    
    let electronApp
    try {
      electronApp = await electron.launch({ 
        args: ['.'],
        timeout: 30000
      })
      const window = await electronApp.firstWindow()
      
      // Verify security settings
      const securitySettings = await window.evaluate(() => {
        return {
          // These should all be false/restricted for security
          hasNodeIntegration: typeof require !== 'undefined',
          hasRemoteModule: typeof require !== 'undefined' && require('electron') !== undefined,
          // Context isolation should be enabled
          hasContextIsolation: typeof window.electronAPI !== 'undefined' && typeof require === 'undefined'
        }
      })
      
      expect(securitySettings.hasNodeIntegration).toBe(false)
      expect(securitySettings.hasRemoteModule).toBe(false)
      expect(securitySettings.hasContextIsolation).toBe(true)
    } finally {
      if (electronApp) {
        try {
          await electronApp.close()
        } catch (closeError) {
          console.log('Error closing Electron app:', closeError.message)
          await electronApp.process().kill()
        }
      }
    }
  })
})
