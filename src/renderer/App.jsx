import React, { useState, useEffect } from 'react';
import { SettingsPanel } from './components/Settings';
import { DashboardPanel, FailedImagesReviewPanel } from './components/Dashboard';

/**
 * Main App Component
 * 
 * Security Notes:
 * - IPC communication is secured through contextBridge in preload.js
 * - Only whitelisted channels are allowed for IPC communication
 * - CSP is configured to allow necessary development features
 * - No direct Node.js API access from renderer process
 */
function App() {
  const [ipcStatus, setIpcStatus] = useState('Testing...');
  const [appVersion, setAppVersion] = useState('Loading...');
  const [currentView, setCurrentView] = useState('main'); // 'main', 'settings', 'dashboard', 'failed-review'

  useEffect(() => {
    // Test IPC communication
    const testIPC = async () => {
      try {
        const response = await window.electronAPI.ping();
        setIpcStatus(response === 'pong' ? '✅ IPC Working' : '❌ IPC Failed');
      } catch (error) {
        setIpcStatus('❌ IPC Error: ' + error.message);
      }
    };

    // Get app version
    const getVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      } catch (error) {
        setAppVersion('Error: ' + error.message);
      }
    };

    testIPC();
    getVersion();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {currentView === 'settings' ? (
        <SettingsPanel onBack={() => setCurrentView('main')} />
      ) : currentView === 'dashboard' ? (
        <DashboardPanel
          onBack={() => setCurrentView('main')}
          onOpenFailedImagesReview={() => setCurrentView('failed-review')}
          onOpenSettings={() => setCurrentView('settings')}
          onOpenJobs={() => {/* stub for future jobs page */}}
        />
      ) : currentView === 'failed-review' ? (
        <FailedImagesReviewPanel onBack={() => setCurrentView('dashboard')} />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              Gen Image Factory
            </h1>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h2 className="text-lg font-semibold text-blue-800 mb-2">
                  Electron + React + TypeScript + Tailwind CSS
                </h2>
                <p className="text-blue-600">
                  Basic Electron shell successfully set up with modern frontend tooling.
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-1">IPC Communication</h3>
                <p className="text-green-600">{ipcStatus}</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-1">App Version</h3>
                <p className="text-purple-600">{appVersion}</p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-1">Development Status</h3>
                <p className="text-yellow-600">
                  ✅ Story 1.1 Foundation Setup Complete
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setCurrentView('settings')}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Open Settings
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Open Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 