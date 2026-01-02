/**
 * Production Smoke Test
 * 
 * This test validates the packaged production build of the Electron application.
 * It monitors the Main Process logs and fails if critical errors are detected.
 */

const { test, expect, _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')

const projectRoot = path.resolve(__dirname, '../../..')

/**
 * Finds the packaged executable based on the platform.
 */
const getExecutablePath = () => {
  const distDir = path.join(projectRoot, 'dist')
  
  if (process.platform === 'darwin') {
    // macOS path
    const macPath = path.join(distDir, 'mac', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory')
    if (fs.existsSync(macPath)) return macPath
  } else if (process.platform === 'win32') {
    // Windows path
    const winPath = path.join(distDir, 'win-unpacked', 'GenImageFactory.exe')
    if (fs.existsSync(winPath)) return winPath
  } else if (process.platform === 'linux') {
    // Linux path
    const linuxPath = path.join(distDir, 'linux-unpacked', 'GenImageFactory')
    if (fs.existsSync(linuxPath)) return linuxPath
  }
  
  return null
}

test.describe('Production Smoke Test', () => {
  test('launches without critical main process errors', async () => {
    const executablePath = getExecutablePath()
    
    if (!executablePath) {
      console.warn('Packaged executable not found. Skipping production smoke test.')
      console.warn('Please run "npm run dist" first to build the production package.')
      test.skip()
      return
    }
    
    console.log(`Testing production executable at: ${executablePath}`)
    
    let electronApp
    const mainProcessErrors = []
    
    try {
      // Launch the packaged Electron application
      electronApp = await electron.launch({
        executablePath: executablePath,
        timeout: 30000
      })
      
      // Monitor stdout/stderr for critical errors
      const appProcess = electronApp.process()
      
      appProcess.stdout.on('data', (data) => {
        const output = data.toString()
        console.log(`[Main Process STDOUT]: ${output}`)
        if (output.includes('Uncaught ReferenceError') || output.includes('Module Not Found') || output.includes('Error: Cannot find module')) {
          mainProcessErrors.push(output)
        }
      })
      
      appProcess.stderr.on('data', (data) => {
        const output = data.toString()
        console.error(`[Main Process STDERR]: ${output}`)
        if (output.includes('Uncaught ReferenceError') || output.includes('Module Not Found') || output.includes('Error: Cannot find module')) {
          mainProcessErrors.push(output)
        }
      })
      
      // Wait for the first window to appear
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      
      // Give the app some time to initialize fully and potentially throw lazy-load errors
      await window.waitForTimeout(5000)
      
      // Check if any errors were captured during startup
      expect(mainProcessErrors, `Critical errors detected in Main Process logs: ${mainProcessErrors.join('\n')}`).toHaveLength(0)
      
      // Verify app title as a basic sanity check
      await expect(window).toHaveTitle(/Gen Image Factory/i)
      
    } finally {
      if (electronApp) {
        await electronApp.close()
      }
    }
  })
})