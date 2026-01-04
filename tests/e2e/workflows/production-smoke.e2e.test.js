/**
 * Production Smoke Test
 * 
 * This test validates the packaged production build of the Electron application.
 * It monitors the Main Process logs and fails if critical errors are detected.
 */

const { test, expect } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '../../..')

/**
 * Finds the packaged executable based on the platform.
 */
const getExecutablePath = () => {
  const distDir = path.join(projectRoot, 'dist')
  
  if (process.platform === 'darwin') {
    const paths = [
      path.join(distDir, 'mac', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-arm64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-x64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-universal', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory')
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
  } else if (process.platform === 'win32') {
    const winPath = path.join(distDir, 'win-unpacked', 'GenImageFactory.exe')
    if (fs.existsSync(winPath)) return winPath
  } else if (process.platform === 'linux') {
    const paths = [
      path.join(distDir, 'linux-unpacked', 'gen-image-factory'),
      path.join(distDir, 'linux-x64-unpacked', 'gen-image-factory'),
      path.join(distDir, 'linux-unpacked', 'GenImageFactory')
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

test.describe('Production Smoke Test (Main Process Only)', () => {
  test('launches binary and initializes without critical errors', async () => {
    const executablePath = getExecutablePath()
    
    if (!executablePath) {
      const distDir = path.join(projectRoot, 'dist')
      console.error(`ERROR: Packaged executable not found in ${distDir}!`)
      if (fs.existsSync(distDir)) {
        console.log('Contents of dist directory:')
        try {
          const files = fs.readdirSync(distDir, { recursive: true })
          console.log(files.join('\n'))
        } catch (_e) {
          console.log('Failed to list dist directory')
        }
      }
      throw new Error('Packaged executable not found! Smoke test cannot proceed.')
    }
    
    console.log(`Testing production executable at: ${executablePath}`)
    
    const mainProcessErrors = []
    let smokeTestReady = false
    let appProcess = null

    try {
      // Direct spawn bypasses Playwright's requirement for a renderer window.
      // This is the only reliable way to test Main Process startup in CI.
      appProcess = spawn(executablePath, ['--no-sandbox'], {
        env: {
          ...process.env,
          SMOKE_TEST: 'true',
          ELECTRON_ENABLE_LOGGING: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      })

      appProcess.stdout.on('data', (data) => {
        const output = data.toString()
        console.log(`[Main STDOUT]: ${output}`)
        if (output.includes('MAIN PROCESS: Smoke test ready signal')) {
          smokeTestReady = true
        }
        if (output.includes('Uncaught ReferenceError') || output.includes('Error: Cannot find module')) {
          mainProcessErrors.push(output)
        }
      })

      appProcess.stderr.on('data', (data) => {
        const output = data.toString()
        console.error(`[Main STDERR]: ${output}`)
        // Catch common Electron/Node startup failures
        if (output.includes('Uncaught ReferenceError') || output.includes('Error: Cannot find module') || output.includes('FATAL:')) {
          mainProcessErrors.push(output)
        }
      })

      // Wait for the ready signal from main.js with a 60s timeout
      const startTime = Date.now()
      const readyTimeout = 60000 
      
      while (!smokeTestReady && (Date.now() - startTime < readyTimeout)) {
        // Check if process died early
        if (appProcess.killed || appProcess.exitCode !== null) {
          throw new Error(`Process exited early with code ${appProcess.exitCode}`)
        }
        await new Promise(resolve => global.setTimeout(resolve, 1000))
      }

      if (!smokeTestReady) {
        throw new Error('Timed out waiting for "Smoke test ready signal" from main process.')
      }

      console.log('Main process signaled ready state. Observing stability for 10s...')
      await new Promise(resolve => global.setTimeout(resolve, 10000))

      // Final check: ensure no critical errors and process is still alive
      expect(mainProcessErrors, `Critical errors detected: ${mainProcessErrors.join('\\n')}`).toHaveLength(0)
      expect(appProcess.exitCode, 'Process exited unexpectedly').toBeNull()

    } finally {
      if (appProcess) {
        console.log('Terminating smoke test process...')
        appProcess.kill('SIGKILL')
      }
    }
  })
})