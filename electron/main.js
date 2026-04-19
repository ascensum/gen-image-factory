/* global Response */
require('dotenv').config();

console.log(' MAIN PROCESS: main.js file is being executed!');
console.log(' MAIN PROCESS: Node.js version:', process.version);
console.log(' MAIN PROCESS: Electron version:', process.versions.electron);

const { app, BrowserWindow, ipcMain, protocol, dialog, Menu, Tray, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

console.log(' MAIN PROCESS: Basic modules loaded. Path:', path.resolve(__dirname));

const isDev = process.env.NODE_ENV === 'development';
console.log(' MAIN PROCESS: isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);

// Register custom protocol as privileged (MUST be done before app.ready)
try {
  console.log(' MAIN PROCESS: Registering privileged schemes...');
  protocol.registerSchemesAsPrivileged([{
    scheme: 'factory',
    privileges: {
      standard: true, secure: true, supportFetchAPI: true,
      corsEnabled: false, bypassCSP: true, stream: true
    }
  }]);
} catch (e) {
  console.error(' MAIN PROCESS: Failed to register schemes:', e);
}

// IPC Controllers (ADR-002, ADR-003 — pure DI, no feature flags)
const JobController = require(path.join(__dirname, '../src/controllers/JobController'));
const SettingsController = require(path.join(__dirname, '../src/controllers/SettingsController'));
const ExportController = require(path.join(__dirname, '../src/controllers/ExportController'));
const SecurityController = require(path.join(__dirname, '../src/controllers/SecurityController'));

// Service composition (ADR-003 — DI wiring)
const { createServices } = require(path.join(__dirname, '../src/composition/createServices'));

// For refreshAllowedRoots (protocol security)
const { JobConfiguration } = require(path.join(__dirname, '../src/database/models/JobConfiguration'));
const { GeneratedImage } = require(path.join(__dirname, '../src/database/models/GeneratedImage'));
const { ImageRepository } = require(path.join(__dirname, '../src/repositories/ImageRepository'));

let mainWindow;
let allowedRoots = new Set();
let promptingRoots = new Set();

const isWindowsStore = process.windowsStore || false;

function toAbsoluteDir(p) {
  try {
    const stat = fs.statSync(p);
    return stat.isDirectory() ? path.resolve(p) : path.resolve(path.dirname(p));
  } catch { return path.resolve(path.dirname(p)); }
}

function isUnderAllowedRoots(filePath) {
  const abs = path.resolve(filePath);
  for (const root of allowedRoots) {
    const nr = root.endsWith(path.sep) ? root : root + path.sep;
    if (abs.startsWith(nr) || abs === root) return true;
  }
  return false;
}

async function refreshAllowedRoots(extraPaths = []) {
  try {
    const initial = new Set();
    try {
      initial.add(path.resolve(app.getPath('desktop')));
      initial.add(path.resolve(app.getPath('documents')));
    } catch {}
    try {
      const jc = new JobConfiguration();
      const res = await jc.getSettings('default').catch(() => null);
      if (res?.success && res.settings?.filePaths) {
        const fp = res.settings.filePaths;
        [fp.outputDirectory, fp.tempDirectory, fp.systemPromptFile, fp.keywordsFile, fp.qualityCheckPromptFile, fp.metadataPromptFile]
          .filter(Boolean).map(toAbsoluteDir).forEach(d => initial.add(d));
      } else {
        const defaults = (new JobConfiguration()).getDefaultSettings();
        if (defaults?.filePaths) {
          [defaults.filePaths.outputDirectory, defaults.filePaths.tempDirectory]
            .filter(Boolean).map(toAbsoluteDir).forEach(d => initial.add(d));
        }
      }
    } catch {}
    try {
      const gi = new GeneratedImage();
      await gi.init().catch(() => {});
      const imageRepo = new ImageRepository(gi);
      const recent = await imageRepo.getAllGeneratedImages(50).catch(() => null);
      if (recent?.success && Array.isArray(recent.images)) {
        recent.images.forEach(img => {
          const p = img.finalImagePath || img.tempImagePath;
          if (p) initial.add(toAbsoluteDir(p));
        });
      }
    } catch {}
    (extraPaths || []).filter(Boolean).map(toAbsoluteDir).forEach(d => initial.add(d));
    allowedRoots = new Set(Array.from(initial).map(d => path.resolve(d)));
    console.log(' Allowed protocol roots:', Array.from(allowedRoots));
  } catch (e) { console.warn('refreshAllowedRoots failed:', e.message); }
}

async function ensureAccessToPath(filePath) {
  const dir = toAbsoluteDir(filePath);
  if (isUnderAllowedRoots(filePath)) {
    try { fs.accessSync(filePath, fs.constants.R_OK); return true; }
    catch { if (process.platform !== 'darwin') return false; }
  }
  if (process.platform === 'darwin') {
    const key = path.resolve(dir);
    if (promptingRoots.has(key)) {
      await new Promise(r => setTimeout(r, 500));
      try { fs.accessSync(filePath, fs.constants.R_OK); allowedRoots.add(key); return true; }
      catch { return false; }
    }
    promptingRoots.add(key);
    try {
      const result = await dialog.showOpenDialog(mainWindow || null, {
        title: 'Grant Folder Access for Images', defaultPath: key,
        properties: ['openDirectory', 'dontAddToRecent'],
        message: 'macOS needs your permission to allow the app to read images in this folder.'
      });
      if (!result.canceled && result.filePaths?.[0]) {
        allowedRoots.add(path.resolve(result.filePaths[0]));
        try { fs.accessSync(filePath, fs.constants.R_OK); return true; }
        catch { allowedRoots.add(toAbsoluteDir(filePath)); try { fs.accessSync(filePath, fs.constants.R_OK); return true; } catch { return false; } }
      }
      return false;
    } finally { promptingRoots.delete(key); }
  }
  try { fs.accessSync(filePath, fs.constants.R_OK); return true; } catch { return false; }
}

function createWindow() {
  let iconPath;
  if (process.platform === 'darwin') iconPath = path.join(__dirname, '../build/icons/mac/icon.icns');
  else if (process.platform === 'win32') iconPath = path.join(__dirname, '../build/icons/win/icon.ico');
  else iconPath = path.join(__dirname, '../build/icons/png/512x512.png');

  mainWindow = new BrowserWindow({
    width: 960, height: 640, icon: iconPath,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'), webSecurity: true, allowRunningInsecureContent: false
    },
    title: 'Gen Image Factory', show: false,
    titleBarOverlay: { color: '#FFFFFF', symbolColor: '#000000', height: 30 },
    webSecurity: true, allowRunningInsecureContent: false
  });

  if (isDev) {
    console.log('Loading from Vite dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on('did-fail-load', (_e, _c, desc, url) => console.error('Failed to load:', url, desc));
    mainWindow.webContents.on('did-finish-load', () => console.log('Successfully loaded page'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Ready ───────────────────────────────────────────────────────────

console.log(' MAIN PROCESS: About to call app.whenReady()...');
app.whenReady().then(async () => {
  console.log(' MAIN PROCESS: app.whenReady() resolved successfully!');

  // macOS Dock icon
  if (process.platform === 'darwin') {
    try {
      const icnsPath = path.resolve(__dirname, '../build/icons/mac/icon.icns');
      const pngFallback = path.resolve(__dirname, '../build/icons/png/512x512.png');
      let img = fs.existsSync(icnsPath) ? nativeImage.createFromPath(icnsPath) : null;
      if (!img || img.isEmpty()) img = fs.existsSync(pngFallback) ? nativeImage.createFromPath(pngFallback) : null;
      if (img && !img.isEmpty() && app.dock?.setIcon) app.dock.setIcon(img);
    } catch (e) { console.warn('Failed to set macOS dock icon:', e.message); }
  }

  await refreshAllowedRoots();

  // Factory protocol handler
  protocol.handle('factory', (request) => {
    let urlPath = request.url.replace('factory://', '');
    if (process.platform !== 'win32' && !urlPath.startsWith('/')) urlPath = '/' + urlPath;
    const drivePath = urlPath.startsWith('c/') ? 'c:/' + urlPath.substring(2) : urlPath;
    try {
      const normalizedPath = path.normalize(decodeURIComponent(drivePath));
      return net.fetch(url.pathToFileURL(normalizedPath).toString());
    } catch (error) {
      console.error('Failed to serve file:', error);
      return new Response('File not found', { status: 404 });
    }
  });

  // ─── Modular DI Service Initialization (ADR-003) ──────────────────────

  const webContentsSender = (channel, data) => {
    try { if (mainWindow?.webContents) mainWindow.webContents.send(channel, data); }
    catch (e) { console.warn('webContentsSender failed:', e.message); }
  };

  let services;
  try {
    console.log(' MAIN PROCESS: Initializing modular services...');
    services = await createServices({ webContentsSender });
    console.log(' MAIN PROCESS: Services initialized successfully');
  } catch (error) {
    console.error(' MAIN PROCESS: Failed to initialize services:', error);
    throw error;
  }

  // Reconcile orphaned "running" job executions from previous sessions
  try {
    if (process.env.SMOKE_TEST !== 'true' && services.jobExecution?.reconcileOrphanedRunningJobs) {
      console.log(' Reconciling orphaned running jobs on startup...');
      const reconResult = await services.jobExecution.reconcileOrphanedRunningJobs();
      console.log(' Reconciliation result:', reconResult);
    }
  } catch (reconErr) { console.error(' Failed to reconcile orphaned running jobs:', reconErr.message); }

  // ─── Register IPC Controllers (ADR-002) ───────────────────────────────

  console.log(' Setting up IPC handlers...');
  try {
    const deps = {
      jobService: services.jobService,
      jobRepository: services.jobRepository,
      imageRepository: services.imageRepository,
      settingsComposer: services.settingsComposer,
      bulkRerunService: services.bulkRerunService,
      singleRerunService: services.singleRerunService,
      retryQueueService: services.retryQueueService,
      jobListService: services.jobListService,
      errorTranslation: services.errorTranslation,
      exportService: services.exportService,
      securityService: services.securityService
    };

    JobController.registerJobHandlers(ipcMain, deps);
    SettingsController.registerSettingsHandlers(ipcMain, deps);
    ExportController.registerExportHandlers(ipcMain, deps);
    SecurityController.registerSecurityHandlers(ipcMain, deps);
    console.log(' IPC controllers registered successfully');
  } catch (error) { console.error(' Failed to setup IPC handlers:', error); }

  // Smoke test DB round-trip
  if (process.env.SMOKE_TEST === 'true') {
    try {
      const sqlite3 = require('sqlite3').verbose();
      await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(':memory:', (err) => {
          if (err) return reject(err);
          db.run('CREATE TABLE smoke_check (id INTEGER PRIMARY KEY, val TEXT)', (e2) => {
            if (e2) return reject(e2);
            db.run("INSERT INTO smoke_check VALUES (1, 'ok')", (e3) => {
              if (e3) return reject(e3);
              db.get('SELECT val FROM smoke_check WHERE id = 1', (e4, row) => {
                db.close();
                (e4 || !row || row.val !== 'ok') ? reject(e4 || new Error('mismatch')) : resolve();
              });
            });
          });
        });
      });
      console.log(' MAIN PROCESS: Database round-trip OK');
    } catch (dbErr) { console.log(' MAIN PROCESS: Database round-trip FAILED:', dbErr.message); }
    console.log(' MAIN PROCESS: Smoke test ready signal');
  }

  // Protocol roots refresh
  ipcMain.handle('protocol:refresh-roots', async (_e, extraPaths = []) => {
    await refreshAllowedRoots(extraPaths);
    return { success: true, roots: Array.from(allowedRoots) };
  });
  ipcMain.handle('protocol:request-access', async (_e, targetPath) => {
    try { return { success: await ensureAccessToPath(targetPath), roots: Array.from(allowedRoots) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  createWindow();

  // Tray Icon
  _setupTray();

  // Auto-updater
  _setupAutoUpdater();
});

// ─── App lifecycle ───────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && app.isQuitting) app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Generic IPC
ipcMain.handle('ping', () => 'pong');
ipcMain.handle('get-app-version', () => app.getVersion());

// Auto-update IPC
ipcMain.handle('update:check', async () => {
  if (isWindowsStore) return { success: false, message: 'Updates handled by Microsoft Store' };
  try { const { autoUpdater } = require('electron-updater'); return { success: true, result: await autoUpdater.checkForUpdates() }; }
  catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('update:install', () => {
  if (isWindowsStore) return { success: false, message: 'Updates handled by Microsoft Store' };
  const { autoUpdater } = require('electron-updater'); autoUpdater.quitAndInstall(); return { success: true };
});
ipcMain.handle('update:get-status', () => ({ isWindowsStore, autoUpdaterEnabled: !isWindowsStore }));

// Error handlers
process.on('uncaughtException', (error) => console.error('Uncaught Exception:', error));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason));

// ─── Private setup helpers ───────────────────────────────────────────────

function _setupTray() {
  try {
    const appPath = app.getAppPath();
    let trayIconPath;
    if (process.platform === 'darwin') {
      trayIconPath = path.join(appPath, 'build', 'icons', 'mac', 'iconTemplate@2x.png');
    } else if (process.platform === 'win32') {
      trayIconPath = path.join(appPath, 'build', 'icons', 'win', 'icon.ico');
    } else {
      trayIconPath = path.join(appPath, 'build', 'icons', 'png', 'icon.png');
    }
    if (!fs.existsSync(trayIconPath)) { console.warn(' Tray icon not found:', trayIconPath); return; }
    const trayIcon = nativeImage.createFromPath(trayIconPath);
    global.tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    global.tray.setToolTip('Gen Image Factory');
    global.tray.setContextMenu(contextMenu);
    global.tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
  } catch (err) { console.error(' Failed to create tray icon:', err); }
}

function _setupAutoUpdater() {
  if (isWindowsStore) { console.log('Microsoft Store - electron-updater disabled'); return; }
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.setFeedURL({ provider: 'github', owner: 'ShiftlineTools', repo: 'gen-image-factory' });
    if (!isDev) autoUpdater.checkForUpdatesAndNotify();
    const send = (ch, d) => { if (mainWindow) mainWindow.webContents.send(ch, d); };
    autoUpdater.on('checking-for-update', () => send('update-checking'));
    autoUpdater.on('update-available', (info) => send('update-available', info));
    autoUpdater.on('update-not-available', (info) => send('update-not-available', info));
    autoUpdater.on('error', (err) => send('update-error', err.message));
    autoUpdater.on('download-progress', (p) => send('update-download-progress', p));
    autoUpdater.on('update-downloaded', (info) => send('update-downloaded', info));
  } catch (error) { console.error('Failed to initialize auto-updater:', error); }
}
