/**
 * Standalone Production Smoke Test
 * 
 * This script validates the packaged production build of the Electron application.
 * It uses child_process.spawn to avoid Playwright's requirement for a renderer window.
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

const getExecutablePath = () => {
  const distDir = path.join(projectRoot, 'dist');
  console.log(`Checking for dist directory at: ${distDir}`);
  
  if (process.platform === 'darwin') {
    const paths = [
      path.join(distDir, 'mac', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-arm64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-x64', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      path.join(distDir, 'mac-universal', 'GenImageFactory.app', 'Contents', 'MacOS', 'GenImageFactory'),
      // Lowercase variants (electron-builder --dir may use package.json name)
      path.join(distDir, 'mac', 'gen-image-factory.app', 'Contents', 'MacOS', 'gen-image-factory'),
      path.join(distDir, 'mac-arm64', 'gen-image-factory.app', 'Contents', 'MacOS', 'gen-image-factory'),
      path.join(distDir, 'mac-x64', 'gen-image-factory.app', 'Contents', 'MacOS', 'gen-image-factory'),
      path.join(distDir, 'mac-universal', 'gen-image-factory.app', 'Contents', 'MacOS', 'gen-image-factory')
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
  } else if (process.platform === 'win32') {
    const winPath = path.join(distDir, 'win-unpacked', 'GenImageFactory.exe');
    if (fs.existsSync(winPath)) return winPath;
  } else if (process.platform === 'linux') {
    const paths = [
      path.join(distDir, 'linux-unpacked', 'GenImageFactory'),
      path.join(distDir, 'linux-x64-unpacked', 'GenImageFactory'),
      path.join(distDir, 'linux-unpacked', 'gen-image-factory'),
      path.join(distDir, 'linux-x64-unpacked', 'gen-image-factory')
    ];
    for (const p of paths) {
      console.log(`Checking Linux path: ${p}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
};

async function runSmokeTest() {
  const executablePath = getExecutablePath();
  if (!executablePath) {
    console.error('ERROR: Packaged executable not found!');
    process.exit(1);
  }

  console.log(`Testing production executable at: ${executablePath}`);
  
  let smokeTestReady = false;
  let errorDetected = false;
  let dbRoundTripConfirmed = false;
  const errors = [];

  // --no-sandbox is required on Linux CI but causes exit code 9 on macOS
  const spawnArgs = process.platform === 'linux' ? ['--no-sandbox'] : [];
  const appProcess = spawn(executablePath, spawnArgs, {
    env: { ...process.env, SMOKE_TEST: 'true', ELECTRON_ENABLE_LOGGING: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const handleOutput = (data, source) => {
    const output = data.toString();
    console.log(`[Main ${source}]: ${output}`);
    if (output.includes('MAIN PROCESS: Smoke test ready signal')) smokeTestReady = true;
    if (output.includes('MAIN PROCESS: Database round-trip OK')) dbRoundTripConfirmed = true;
    if (output.includes('MAIN PROCESS: Database round-trip FAILED')) {
      errorDetected = true;
      errors.push(output);
    }
    if (output.includes('Uncaught ReferenceError') || output.includes('Error: Cannot find module') || output.includes('FATAL:')) {
      errorDetected = true;
      errors.push(output);
    }
  };

  appProcess.stdout.on('data', (d) => handleOutput(d, 'STDOUT'));
  appProcess.stderr.on('data', (d) => handleOutput(d, 'STDERR'));

  const startTime = Date.now();
  const timeout = 120000;
  let lastStatusSec = 0;

  while (!smokeTestReady && (Date.now() - startTime < timeout)) {
    if (appProcess.exitCode !== null) {
      console.error(`Process exited early with code ${appProcess.exitCode}`);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 500));
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    if (elapsedSec !== lastStatusSec && elapsedSec % 5 === 0) {
      lastStatusSec = elapsedSec;
      console.log(`[Smoke test] Waiting for ready signal... (${elapsedSec}s)`);
    }
  }

  if (!smokeTestReady) {
    console.error('FAILED: Timed out waiting for ready signal.');
    appProcess.kill('SIGKILL');
    process.exit(1);
  }

  if (!dbRoundTripConfirmed) {
    console.error('FAILED: Database round-trip confirmation not received before ready signal.');
    appProcess.kill('SIGKILL');
    process.exit(1);
  }

  console.log('Main process ready. Observing stability for 10s...');
  await new Promise(r => setTimeout(r, 10000));

  appProcess.kill('SIGKILL');

  if (errorDetected) {
    console.error('FAILED: Critical errors detected in logs:', errors.join('\n'));
    process.exit(1);
  }

  console.log('SUCCESS: Production smoke test passed.');
  process.exit(0);
}

runSmokeTest().catch(err => {
  console.error('Smoke test script failed:', err);
  process.exit(1);
});
