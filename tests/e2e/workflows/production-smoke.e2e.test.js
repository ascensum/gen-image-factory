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
    // macOS paths
    const paths = [
      path.join(distDir, 'mac', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-x64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-arm64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-universal', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory')
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
  } else if (process.platform === 'win32') {
    // Windows path
    const winPath = path.join(distDir, 'win-unpacked', 'GenImageFactory.exe')
    if (fs.existsSync(winPath)) return winPath
  } else if (process.platform === 'linux') {
    // Linux paths
    const paths = [
      path.join(distDir, 'linux-unpacked', 'GenImageFactory'),
      path.join(distDir, 'linux-x64-unpacked', 'GenImageFactory')
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
  }
  
  return null
}

test.describe('Production Smoke Test', () => {
  test('launches without critical main process errors', async () => {
    const executablePath = getExecutablePath()
    
    if (!executablePath) {
      console.error('ERROR: Packaged executable not found in any of the expected locations!')
      console.error(`Current directory: ${process.cwd()}`)
      const distDir = path.join(projectRoot, 'dist')
      if (fs.existsSync(distDir)) {
        console.log(`Contents of ${distDir}:`)
        try {
          const files = fs.readdirSync(distDir, { recursive: true })
          console.log(files.join('\n'))
        } catch (e) {
          console.log('Failed to list dist directory recursively')
        }
      } else {
        console.error(`Dist directory does not exist: ${distDir}`)
      }
      test.skip()
      return
    }
    
    console.log(`Testing production executable at: ${executablePath}`)
    console.log(`Executable exists: ${fs.existsSync(executablePath)}`)
    
    let electronApp
    const mainProcessErrors = []
    
    try {
      // Launch the packaged Electron application
      electronApp = await electron.launch({
        executablePath: executablePath,
        args: [
          '--no-sandbox', 
          '--disable-gpu', 
          '--disable-software-rasterizer',
          '--disable-dev-shm-usage'
        ],
        env: {
          ...process.env,
          SMOKE_TEST: 'true'
        },
        timeout: 120000 // Bump to 120s for the slow integrity check
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