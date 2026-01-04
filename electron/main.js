console.log(' MAIN PROCESS: main.js file is being executed!');
console.log(' MAIN PROCESS: Node.js version:', process.version);
console.log(' MAIN PROCESS: Electron version:', process.versions.electron);

const { app, BrowserWindow, ipcMain, protocol, dialog, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

console.log(' MAIN PROCESS: Basic modules loaded. Path:', path.resolve(__dirname));

// Lazy-load electron-updater to avoid initialization issues in test environments
const isDev = process.env.NODE_ENV === 'development';
console.log(' MAIN PROCESS: isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);

// Register custom protocol as privileged (MUST be done before app.ready)
try {
  console.log(' MAIN PROCESS: Registering privileged schemes...');
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-file',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
        bypassCSP: false
      }
    }
  ]);
} catch (e) {
  console.error(' MAIN PROCESS: Failed to register schemes:', e);
}

// Initialize Backend Adapter
console.log(' MAIN PROCESS: Requiring BackendAdapter...');
const { BackendAdapter } = require(path.join(__dirname, '../src/adapter/backendAdapter'));
console.log(' MAIN PROCESS: BackendAdapter required successfully');

// JobConfiguration for dynamic, cross-platform default and saved paths
console.log(' MAIN PROCESS: Requiring JobConfiguration/GeneratedImage...');
const { JobConfiguration } = require(path.join(__dirname, '../src/database/models/JobConfiguration'));
const { GeneratedImage } = require(path.join(__dirname, '../src/database/models/GeneratedImage'));
console.log(' MAIN PROCESS: Database models required successfully');

let mainWindow;

// In-memory allowlist of directories we can serve files from (normalized absolute paths)
let allowedRoots = new Set();
let promptingRoots = new Set(); // throttle permission prompts by directory

// Runtime environment detection: Microsoft Store vs GitHub Releases
// This is determined at startup and used throughout the app lifecycle
const isWindowsStore = process.windowsStore || false;

function toAbsoluteDir(p) {
  try {
    const stat = fs.statSync(p);
    return stat.isDirectory() ? path.resolve(p) : path.resolve(path.dirname(p));
  } catch {
    return path.resolve(path.dirname(p));
  }
}

function isUnderAllowedRoots(filePath) {
  const abs = path.resolve(filePath);
  for (const root of allowedRoots) {
    // Ensure trailing separator match to avoid prefix tricks
    const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
    if (abs.startsWith(normalizedRoot)) return true;
    // Also allow exact file path when root equals file's parent
    if (abs === root) return true;
  }
  return false;
}

async function refreshAllowedRoots(extraPaths = []) {
  try {
    const initial = new Set();
    // Common user folders that may be used by defaults
    try {
      const desktop = app.getPath('desktop');
      const documents = app.getPath('documents');
      initial.add(path.resolve(desktop));
      initial.add(path.resolve(documents));
    } catch {}

    // Load current configured paths from settings if available
    try {
      const jc = new JobConfiguration();
      const res = await jc.getSettings('default').catch(() => null);
      if (res && res.success && res.settings && res.settings.filePaths) {
        const { outputDirectory, tempDirectory, systemPromptFile, keywordsFile, qualityCheckPromptFile, metadataPromptFile } = res.settings.filePaths;
        [outputDirectory, tempDirectory, systemPromptFile, keywordsFile, qualityCheckPromptFile, metadataPromptFile]
          .filter(Boolean)
          .map(toAbsoluteDir)
          .forEach((dir) => initial.add(dir));
      } else {
        const defaults = (new JobConfiguration()).getDefaultSettings();
        if (defaults && defaults.filePaths) {
          const { outputDirectory, tempDirectory } = defaults.filePaths;
          [outputDirectory, tempDirectory].filter(Boolean).map(toAbsoluteDir).forEach((dir) => initial.add(dir));
        }
      }
    } catch {}

    // Include a few recent image parent directories (best effort)
    try {
      const gi = new GeneratedImage();
      const recent = await gi.getAllGeneratedImages(50).catch(() => null);
      if (recent && recent.success && Array.isArray(recent.images)) {
        recent.images.forEach((img) => {
          const p = img.finalImagePath || img.tempImagePath;
          if (p) initial.add(toAbsoluteDir(p));
        });
      }
    } catch {}

    // Merge caller-provided extra paths
    (extraPaths || []).filter(Boolean).map(toAbsoluteDir).forEach((dir) => initial.add(dir));

    // Commit to global allowlist
    allowedRoots = new Set(Array.from(initial).map((d) => path.resolve(d)));
    console.log(' Allowed protocol roots:', Array.from(allowedRoots));
  } catch (e) {
    console.warn('refreshAllowedRoots failed:', e.message);
  }
}

async function ensureAccessToPath(filePath) {
  const dir = toAbsoluteDir(filePath);
  // If already allowed, no need to prompt
  if (isUnderAllowedRoots(filePath)) {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return true;
    } catch {
      // proceed to prompt if on macOS and access is denied
      if (process.platform !== 'darwin') return false;
    }
  }

  // On macOS, privacy (TCC) may block Desktop/Documents/etc. Prompt once to grant access.
  if (process.platform === 'darwin') {
    const key = path.resolve(dir);
    if (promptingRoots.has(key)) {
      // Another prompt in progress; wait a short moment and recheck access
      await new Promise((r) => setTimeout(r, 500));
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
        allowedRoots.add(key);
        return true;
      } catch {
        return false;
      }
    }
    promptingRoots.add(key);
    try {
      const result = await dialog.showOpenDialog(mainWindow || null, {
        title: 'Grant Folder Access for Images',
        defaultPath: key,
        properties: ['openDirectory', 'dontAddToRecent'],
        message: 'macOS needs your permission to allow the app to read images in this folder.'
      });
      if (!result.canceled && Array.isArray(result.filePaths) && result.filePaths[0]) {
        const selectedDir = path.resolve(result.filePaths[0]);
        allowedRoots.add(selectedDir);
        console.log(' Granted access to directory:', selectedDir);
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          return true;
        } catch {
          // Even after selection, may still fail if different parent; allow parent(s)
          allowedRoots.add(toAbsoluteDir(filePath));
          try {
            fs.accessSync(filePath, fs.constants.R_OK);
            return true;
          } catch {
            return false;
          }
        }
      }
      return false;
    } finally {
      promptingRoots.delete(key);
    }
  }

  // Non-macOS: fall back to standard access check
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
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
        console.log('Attempting to set macOS dock icon from ICNS:', icnsPath, 'empty:', img.isEmpty());
      }
      if (!img || img.isEmpty()) {
        if (fs.existsSync(pngFallbackPath)) {
          img = nativeImage.createFromPath(pngFallbackPath);
          console.log('Fallback: setting macOS dock icon from PNG:', pngFallbackPath, 'empty:', img.isEmpty());
        } else {
          console.warn('No valid icon found at ICNS or PNG fallback paths');
        }
      }
      if (img && !img.isEmpty() && app.dock && typeof app.dock.setIcon === 'function') {
        app.dock.setIcon(img);
        console.log('macOS dock icon applied');
      }
    } catch (e) {
      console.warn('Failed to set macOS dock icon:', e.message);
    }
  }
  
  // Initialize allowed roots before registering protocol
  await refreshAllowedRoots();

  // Register custom protocol for local file access
  // This is required in dev mode where browser security prevents file:// access
  protocol.registerFileProtocol('local-file', (request, callback) => {
    console.log('Protocol handler called:', request.url);
    try {
      // Use URL API to parse properly - this handles cross-platform paths correctly
      const url = new URL(request.url);
      const host = url.hostname;
      
      // Get the pathname and decode it
      let filePath = decodeURIComponent(url.pathname);
      // Windows: strip leading slash from "/C:/..." and normalize
      if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(filePath)) {
        filePath = filePath.slice(1);
      }
      // macOS/Linux: if a host segment exists (e.g., local-file://users/...), prepend it to pathname
      if (process.platform !== 'win32' && host) {
        filePath = `/${host}${filePath}`;
      }
      filePath = path.normalize(filePath);
      // macOS: correct lowercased home root when coming from malformed URLs ("/users/..." -> "/Users/...")
      if (process.platform === 'darwin' && filePath.startsWith('/users/')) {
        filePath = '/Users/' + filePath.slice('/users/'.length);
      }
      
      // On Windows, URL pathname will be like "/C:/Users/..." - keep as is
      // On Unix (macOS/Linux), it will be like "/Users/..." or "/home/..." - keep as is
      
      console.log('   → Parsed pathname:', filePath);
      console.log('   → File exists:', fs.existsSync(filePath));
      console.log('   → Under allowed roots:', isUnderAllowedRoots(filePath));
      if (host) {
        console.log('   → URL host segment:', host);
      }
      
      // Serve only if path is under an allowed root and is readable
      const serveFile = async () => {
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
        } catch (e) {
          // Try to grant access (especially on macOS after privacy reset)
          const granted = await ensureAccessToPath(filePath);
          if (!granted) {
            console.warn('Access denied for file:', filePath, e.code || e.message);
            callback({ error: -10 }); // ACCESS_DENIED
            return;
          }
        }
        console.log('Serving file');
        callback({ path: filePath });
      };

      if (fs.existsSync(filePath)) {
        if (isUnderAllowedRoots(filePath)) {
          serveFile();
        } else {
          // Try to add the parent directory and serve
          const parent = toAbsoluteDir(filePath);
          allowedRoots.add(parent);
          console.log(' Added parent to allowed roots:', parent);
          serveFile();
        }
      } else {
        console.warn('File not found:', filePath);
        console.warn('   Original URL:', request.url);
        console.warn('   Platform:', process.platform);
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    } catch (error) {
      console.error('Protocol handler error:', error);
      callback({ error: -2 }); // FAILED
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
  
  // Ensure database tables exist before reconciliation
  try {
    if (process.env.SMOKE_TEST !== 'true' && backendAdapter && typeof backendAdapter.ensureInitialized === 'function') {
      console.log(' Ensuring BackendAdapter is initialized...');
      await backendAdapter.ensureInitialized();
    } else if (process.env.SMOKE_TEST === 'true') {
      console.log(' Skipping BackendAdapter initialization (SMOKE_TEST active)');
    }
  } catch (initErr) {
    console.warn(' BackendAdapter initialization check failed:', initErr.message);
  }
  
  // Reconcile orphaned "running" job executions from previous sessions
  try {
    if (process.env.SMOKE_TEST !== 'true' && backendAdapter && backendAdapter.jobExecution && typeof backendAdapter.jobExecution.reconcileOrphanedRunningJobs === 'function') {
      console.log(' Reconciling orphaned running jobs on startup...');
      const reconResult = await backendAdapter.jobExecution.reconcileOrphanedRunningJobs();
      console.log(' Reconciliation result:', reconResult);
    }
  } catch (reconErr) {
    console.error(' Failed to reconcile orphaned running jobs:', reconErr);
  }

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

  // Signal that the main process has completed critical initialization for smoke tests
  // We emit this before creating windows or starting updates to ensure reliability in CI
  if (process.env.SMOKE_TEST === 'true') {
    console.log(' MAIN PROCESS: Smoke test ready signal');
  }

  // Hot-refresh protocol roots on demand (no restart required)
  ipcMain.handle('protocol:refresh-roots', async (event, extraPaths = []) => {
    await refreshAllowedRoots(extraPaths);
    return { success: true, roots: Array.from(allowedRoots) };
  });

  // Manually request access to a specific file/folder and add to allowed roots
  ipcMain.handle('protocol:request-access', async (_event, targetPath) => {
    try {
      const granted = await ensureAccessToPath(targetPath);
      return { success: granted, roots: Array.from(allowedRoots) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  createWindow();

  // Implement Tray Icon
  try {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const appPath = app.getAppPath();
    let iconFolder, iconExt;
    
    if (isWin) {
      iconFolder = 'win';
      iconExt = 'ico';
    } else if (isMac) {
      iconFolder = 'mac';
      iconExt = 'icns';
    } else {
      // Standard Linux/Unix path
      iconFolder = 'png';
      iconExt = 'png';
    }

    // In production (ASAR), app.getAppPath() returns the asar path.
    // We need to ensure we point to the build folder which is included in the files list.
    const trayIconPath = path.join(appPath, 'build', 'icons', iconFolder, `icon.${iconExt}`);
    console.log(' MAIN PROCESS: Creating tray with icon:', trayIconPath);
    
    if (fs.existsSync(trayIconPath)) {
      const trayIcon = nativeImage.createFromPath(trayIconPath);
      // Set global variable to prevent garbage collection
      global.tray = new Tray(trayIcon);
      
      const contextMenu = Menu.buildFromTemplate([
        { 
          label: 'Show App', 
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            } else {
              createWindow();
            }
          } 
        },
        { type: 'separator' },
        { 
          label: 'Quit', 
          click: () => {
            app.isQuitting = true;
            app.quit();
          } 
        }
      ]);

      global.tray.setToolTip('Gen Image Factory');
      global.tray.setContextMenu(contextMenu);
      
      global.tray.on('double-click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      });
      console.log(' MAIN PROCESS: Tray icon created successfully');
    } else {
      console.warn(' MAIN PROCESS: Tray icon path does not exist:', trayIconPath);
    }
  } catch (trayErr) {
    console.error(' MAIN PROCESS: Failed to create tray icon:', trayErr);
  }
  
  // Update BackendAdapter with mainWindow reference for event sending
  if (backendAdapter && mainWindow) {
    backendAdapter.setMainWindow(mainWindow);
  }

  // Auto-update initialization
  // Runtime environment detection is done at module level (isWindowsStore constant)
  
  if (!isWindowsStore) {
    // Enable electron-updater for GitHub Releases (Windows/macOS/Linux)
    console.log('Initializing electron-updater for GitHub Releases...');
    
    try {
      // Lazy-load electron-updater only when needed (after app is ready)
      const { autoUpdater } = require('electron-updater');
      
      // Configure auto-updater
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'ShiftlineTools',
        repo: 'gen-image-factory'
      });
      
      // Check for updates on app ready (only in production)
      if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
      }
      
      // Handle update events
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
      if (mainWindow) {
        mainWindow.webContents.send('update-checking');
      }
    });
    
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
      }
    });
    
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available');
      if (mainWindow) {
        mainWindow.webContents.send('update-not-available', info);
      }
    });
    
    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message);
      }
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      console.log(message);
      if (mainWindow) {
        mainWindow.webContents.send('update-download-progress', progressObj);
      }
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded');
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
      }
    });
    } catch (error) {
      console.error('Failed to initialize auto-updater:', error);
      // Continue without auto-updater if initialization fails
      // App will still function, but auto-updates will be unavailable
    }
  } else {
    // Microsoft Store: Disable electron-updater, rely on Windows OS automatic updates
    console.log('Running in Microsoft Store - electron-updater disabled, using Windows OS updates');
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // We keep the app running even if all windows are closed to allow tray interaction
  // unless the user explicitly quits via the tray menu or Cmd+Q
  if (process.platform !== 'darwin' && app.isQuitting) {
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

// Auto-update IPC handlers
ipcMain.handle('update:check', async () => {
  if (isWindowsStore) {
    return { success: false, message: 'Updates are handled by Microsoft Store' };
  }
  try {
    // Lazy-load electron-updater when needed
    const { autoUpdater } = require('electron-updater');
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update:install', () => {
  if (isWindowsStore) {
    return { success: false, message: 'Updates are handled by Microsoft Store' };
  }
  // Lazy-load electron-updater when needed
  const { autoUpdater } = require('electron-updater');
  autoUpdater.quitAndInstall();
  return { success: true };
});

ipcMain.handle('update:get-status', () => {
  return {
    isWindowsStore,
    autoUpdaterEnabled: !isWindowsStore
  };
});



// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 