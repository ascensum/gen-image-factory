console.log(' MAIN PROCESS: main.js file is being executed!');
console.log(' MAIN PROCESS: Node.js version:', process.version);
console.log(' MAIN PROCESS: Electron version:', process.versions.electron);

const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Initialize Backend Adapter
const { BackendAdapter } = require('../src/adapter/backendAdapter');

// JobConfiguration for dynamic, cross-platform default and saved paths
const { JobConfiguration } = require('../src/database/models/JobConfiguration');
const { GeneratedImage } = require('../src/database/models/GeneratedImage');

let mainWindow;
let allowedRoots = [];
async function refreshAllowedRoots(extraPaths = []) {
  try {
    const jobConfig = new JobConfiguration();
    const defaults = jobConfig.getDefaultSettings();
    const nextRoots = new Set();
    // Defaults
    [defaults?.filePaths?.outputDirectory, defaults?.filePaths?.tempDirectory]
      .filter(Boolean)
      .forEach((p) => nextRoots.add(p));
    // Saved settings
    try {
      const { settings } = await jobConfig.getSettings('default');
      const saved = settings?.filePaths || {};
      [saved.outputDirectory, saved.tempDirectory]
        .filter(Boolean)
        .forEach((p) => nextRoots.add(p));
    } catch {}
    // Extra paths provided from renderer (e.g., newly saved per-job paths)
    (Array.isArray(extraPaths) ? extraPaths : [extraPaths])
      .filter(Boolean)
      .forEach((p) => nextRoots.add(p));
    // Recent image directories
    try {
      const gi = new GeneratedImage();
      const res = await gi.getAllGeneratedImages(500);
      const images = res && res.success ? res.images : Array.isArray(res) ? res : [];
      const pathDirs = new Set();
      images.forEach((img) => {
        try { if (img.finalImagePath) pathDirs.add(path.dirname(img.finalImagePath)); } catch {}
        try { if (img.tempImagePath) pathDirs.add(path.dirname(img.tempImagePath)); } catch {}
      });
      pathDirs.forEach((d) => nextRoots.add(d));
    } catch {}
    allowedRoots = Array.from(nextRoots);
    console.log(' Allowed roots (refreshed):', allowedRoots);
  } catch (e) {
    console.warn(' Failed to refresh allowed roots:', e.message);
  }
}

function createWindow() {
  // Determine icon path based on platform
  let iconPath;
  if (process.platform === 'darwin') {
    // macOS
    iconPath = path.join(__dirname, '../build/icons/mac/icon.icns');
  } else if (process.platform === 'win32') {
    // Windows
    iconPath = path.join(__dirname, '../build/icons/win/icon.ico');
  } else {
    // Linux
    iconPath = path.join(__dirname, '../build/icons/png/512x512.png');
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    icon: iconPath, // Custom application icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    title: 'Gen Image Factory',
    show: false, // Don't show until ready
    // Additional security settings
    webSecurity: true,
    allowRunningInsecureContent: false
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    console.log('Loading from Vite dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
    
    // Add error handling for page load
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load URL:', validatedURL, 'Error:', errorDescription);
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Successfully loaded page');
    });
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize Backend Adapter once
let backendAdapter;

// This method will be called when Electron has finished initialization
console.log(' MAIN PROCESS: About to call app.whenReady()...');
app.whenReady().then(async () => {
  console.log(' MAIN PROCESS: app.whenReady() resolved successfully!');
  // Set macOS Dock icon explicitly in dev/prod; BrowserWindow.icon is ignored on macOS
  if (process.platform === 'darwin') {
    try {
      const { nativeImage } = require('electron');
      const icnsPath = path.resolve(__dirname, '../build/icons/mac/icon.icns');
      const pngFallbackPath = path.resolve(__dirname, '../build/icons/png/512x512.png');

      let img = null;
      if (fs.existsSync(icnsPath)) {
        img = nativeImage.createFromPath(icnsPath);
        console.log('️ Attempting to set macOS dock icon from ICNS:', icnsPath, 'empty:', img.isEmpty());
      }
      if (!img || img.isEmpty()) {
        if (fs.existsSync(pngFallbackPath)) {
          img = nativeImage.createFromPath(pngFallbackPath);
          console.log('️ Fallback: setting macOS dock icon from PNG:', pngFallbackPath, 'empty:', img.isEmpty());
        } else {
          console.warn('️ No valid icon found at ICNS or PNG fallback paths');
        }
      }
      if (img && !img.isEmpty() && app.dock && typeof app.dock.setIcon === 'function') {
        app.dock.setIcon(img);
        console.log('️ macOS dock icon applied');
      }
    } catch (e) {
      console.warn('️ Failed to set macOS dock icon:', e.message);
    }
  }
  // Precompute dynamic allowed roots from defaults and saved settings
  try {
    const jobConfig = new JobConfiguration();
    const defaults = jobConfig.getDefaultSettings();
    const defaultRoots = [
      defaults?.filePaths?.outputDirectory,
      defaults?.filePaths?.tempDirectory
    ].filter(Boolean);

    allowedRoots = [
      // app userData child folders we may use
      path.join(app.getPath('userData'), 'exports'),
      path.join(app.getPath('userData'), 'generated'),
      ...defaultRoots
    ];

    // Pull current saved settings synchronously before protocol registration
    try {
      const { settings } = await jobConfig.getSettings('default');
      const saved = settings?.filePaths || {};
      [saved.outputDirectory, saved.tempDirectory]
        .filter(Boolean)
        .forEach((p) => allowedRoots.push(p));
      console.log(' Allowed roots (with saved):', allowedRoots);
    } catch (_e) {
      console.log(' Using default allowed roots only');
    }

    console.log(' Allowed roots (initial):', allowedRoots);

    // Add dynamic roots from recent generated images (final and temp directories)
    try {
      const gi = new GeneratedImage();
      const res = await gi.getAllGeneratedImages(500);
      const images = res && res.success ? res.images : Array.isArray(res) ? res : [];
      const dirs = new Set();
      images.forEach((img) => {
        try { if (img.finalImagePath) dirs.add(path.dirname(img.finalImagePath)); } catch {}
        try { if (img.tempImagePath) dirs.add(path.dirname(img.tempImagePath)); } catch {}
      });
      dirs.forEach((d) => allowedRoots.push(d));
      console.log(' Allowed roots (with image dirs):', allowedRoots);
    } catch (e2) {
      console.warn(' Could not load dynamic roots from images:', e2.message);
    }
  } catch (e) {
    console.warn(' Failed to initialize JobConfiguration for allowed roots:', e.message);
  }

  // Set up protocol handler for local files AFTER app is ready
  protocol.registerFileProtocol('local-file', (request, callback) => {
    try {
      const rawUrl = request.url || '';
      console.log(' Protocol handler called for:', rawUrl);
      const stripped = rawUrl.replace('local-file://', '');
      const decodedPath = decodeURI(stripped);
      const filePath = path.normalize(decodedPath);
      console.log(' Normalized file path:', filePath);

      const isAllowed = allowedRoots.some((root) => {
        try {
          if (!root) return false;
          const normRoot = path.normalize(root + path.sep);
          return filePath.startsWith(normRoot);
        } catch { return false; }
      });

      if (isAllowed && fs.existsSync(filePath)) {
        console.log(' File exists and allowed, serving:', filePath);
        callback(filePath);
      } else {
        console.warn(' Blocked access to file:', filePath, 'exists:', fs.existsSync(filePath), 'allowed:', isAllowed, 'roots:', allowedRoots);
        callback(404);
      }
    } catch (err) {
      console.error(' Protocol handler error:', err);
      callback(500);
    }
  });
  
  // Initialize Backend Adapter only once
  console.log(' MAIN PROCESS: About to create BackendAdapter...');
  console.log(' About to create BackendAdapter with ipcMain...');
  console.log(' ipcMain type:', typeof ipcMain);
  console.log(' ipcMain available:', ipcMain !== undefined);
  
  try {
    console.log(' MAIN PROCESS: Calling BackendAdapter constructor...');
    backendAdapter = new BackendAdapter({ ipc: ipcMain, mainWindow: null, skipIpcSetup: true });
    console.log(' BackendAdapter created successfully');
    console.log(' backendAdapter object:', backendAdapter);
  } catch (error) {
    console.error(' Failed to create BackendAdapter:', error);
    console.error(' Error stack:', error.stack);
    throw error;
  }
  
  // Make backendAdapter globally accessible so other modules can use it
  global.backendAdapter = backendAdapter;
  
  // Register all IPC handlers from the backend adapter
  console.log(' Setting up IPC handlers from BackendAdapter...');
  console.log(' backendAdapter type:', typeof backendAdapter);
  console.log(' backendAdapter.setupIpcHandlers type:', typeof backendAdapter.setupIpcHandlers);
  
  try {
    backendAdapter.setupIpcHandlers();
    console.log(' IPC handlers registered successfully');
  } catch (error) {
    console.error(' Failed to setup IPC handlers:', error);
    console.error(' Error stack:', error.stack);
  }

  // Hot-refresh protocol roots on demand (no restart required)
  ipcMain.handle('protocol:refresh-roots', async (event, extraPaths = []) => {
    await refreshAllowedRoots(extraPaths);
    return { success: true, roots: allowedRoots };
  });
  
  createWindow();
  
  // Update BackendAdapter with mainWindow reference for event sending
  if (backendAdapter && mainWindow) {
    backendAdapter.setMainWindow(mainWindow);
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Communication Setup
ipcMain.handle('ping', () => {
  return 'pong';
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});



// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 