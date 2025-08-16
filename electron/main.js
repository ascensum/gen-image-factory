const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Initialize Backend Adapter
const { BackendAdapter } = require('../src/adapter/backendAdapter');

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

// Set up protocol handler for local files BEFORE app is ready
protocol.registerFileProtocol('local-file', (request, callback) => {
  console.log('🔗 Protocol handler called for:', request.url);
  const filePath = request.url.replace('local-file://', '');
  console.log('🔗 Extracted file path:', filePath);
  
  // Security check: only allow access to files in specific directories
  const allowedPaths = [
    path.join(app.getPath('userData'), 'exports'),
    path.join(app.getPath('userData'), 'generated'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', 'Gen_Image_Factory_ToUpload'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', 'Gen_Image_Factory_Generated')
  ];
  
  console.log('🔗 Allowed paths:', allowedPaths);
  
  let isAllowed = false;
  for (const allowedPath of allowedPaths) {
    if (filePath.startsWith(allowedPath)) {
      isAllowed = true;
      console.log('🔗 Path allowed by:', allowedPath);
      break;
    }
  }
  
  if (isAllowed && fs.existsSync(filePath)) {
    console.log('🔗 File exists and allowed, serving:', filePath);
    callback(filePath);
  } else {
    console.warn('🔗 Blocked access to file:', filePath, 'exists:', fs.existsSync(filePath), 'allowed:', isAllowed);
    callback(404);
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Initialize Backend Adapter only once
  backendAdapter = new BackendAdapter();
  
  // Make backendAdapter globally accessible so other modules can use it
  global.backendAdapter = backendAdapter;
  
  createWindow();
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