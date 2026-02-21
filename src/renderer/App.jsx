import React, { useState, useEffect } from 'react';
import { SettingsPanel } from './components/Settings';
import { DashboardPanel, FailedImagesReviewPanel } from './components/Dashboard';
import { JobManagementPanel, SingleJobView } from './components/Jobs';
import { AppLogo } from './components/Common/AppLogo';

/**
 * Main App Component - Full Navigation
 */
function App() {
  const [ipcStatus, setIpcStatus] = useState('Testing...');
  const [appVersion, setAppVersion] = useState('Loading...');
  const [currentView, setCurrentView] = useState('main'); // 'main', 'settings', 'dashboard', 'failed-review', 'job-management', 'single-job'
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [singleJobRefreshKey, setSingleJobRefreshKey] = useState(0);

  useEffect(() => {
    // Test IPC communication
    const testIPC = async () => {
      try {
        const response = await window.electronAPI.ping();
        setIpcStatus(response === 'pong' ? ' IPC Working' : ' IPC Failed');
      } catch (error) {
        console.error('IPC Error:', error);
        setIpcStatus(' IPC Error: ' + error.message);
      }
    };

    // Get app version
    const getVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('Version Error:', error);
        setAppVersion('Error: ' + error.message);
      }
    };

    testIPC();
    getVersion();
  }, []);

  const homeBtnStyle = {
    height: 44,
    lineHeight: '44px',
    padding: 0,
    border: 0,
    outline: 'none',
    boxShadow: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none'
  };
  const homeBtnClass = 'block w-full p-0 m-0 text-center select-none rounded-md';

  return (
    <div className="min-h-screen bg-gray-100">
      {currentView === 'settings' ? (
        <SettingsPanel 
          onBack={() => setCurrentView('main')}
          onOpenDashboard={() => setCurrentView('dashboard')}
        />
      ) : currentView === 'dashboard' ? (
        <DashboardPanel
          key={dashboardRefreshKey}
          onBack={() => setCurrentView('main')}
          onOpenFailedImagesReview={() => setCurrentView('failed-review')}
          onOpenSettings={() => setCurrentView('settings')}
          onOpenJobs={() => setCurrentView('job-management')}
          onOpenSingleJobView={(jobId) => {
            setSelectedJobId(jobId);
            setCurrentView('single-job');
          }}
        />
      ) : currentView === 'failed-review' ? (
        <FailedImagesReviewPanel 
          onBack={() => {
            setCurrentView('dashboard');
            setDashboardRefreshKey(prev => prev + 1);
          }}
          onBackToSingleJob={() => {
            setCurrentView('single-job');
            setSingleJobRefreshKey(prev => prev + 1);
          }}
        />
      ) : currentView === 'job-management' ? (
        <JobManagementPanel
          onOpenSingleJob={(jobId) => {
            setSelectedJobId(jobId.toString());
            setCurrentView('single-job');
          }}
          onBack={() => {
            setCurrentView('dashboard');
            setDashboardRefreshKey(prev => prev + 1);
          }}
        />
      ) : currentView === 'single-job' ? (
        <SingleJobView
          key={singleJobRefreshKey}
          jobId={selectedJobId || ''}
          onBack={() => setCurrentView('job-management')}
          onExport={(jobId) => {
            console.log(`Export job ${jobId}`);
            // TODO: Implement export functionality
          }}
          onRerun={(jobId) => {
            console.log(` APP: Rerun job ${jobId} - calling backend rerun function`);
            window.electronAPI.jobManagement.rerunJobExecution(jobId);
          }}
          onDelete={async (jobId) => {
            try {
              console.log(`Deleting job ${jobId}`);
              const result = await window.electronAPI.jobManagement.deleteJobExecution(jobId);
              if (result.success) {
                console.log(`Job ${jobId} deleted successfully`);
                // Redirect back to Job Management after successful deletion
                setCurrentView('job-management');
              } else {
                console.error(`Failed to delete job ${jobId}:`, result.error);
                // TODO: Show error message to user
              }
            } catch (error) {
              console.error(`Error deleting job ${jobId}:`, error);
              // TODO: Show error message to user
            }
          }}
        />
      ) : (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg px-6 py-5 text-center home-launch">
            <div className="mb-2 mx-auto">
              <AppLogo variant="square" className="h-28 md:h-32 lg:h-36 mx-auto" />
            </div>
            <div className="text-sm uppercase text-slate-500 tracking-wide font-medium mb-1">
              GEN IMAGE FACTORY
            </div>
            <div className="text-xs uppercase text-slate-500 tracking-widest mb-4">
              VERSION {appVersion}
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setCurrentView('settings')}
                className={`${homeBtnClass} bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium`}
                style={homeBtnStyle}
              >
                Open Settings
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className={`${homeBtnClass} bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium`}
                style={homeBtnStyle}
              >
                Open Dashboard
              </button>
            </div>
            <div className="mt-4 text-xs uppercase text-slate-500 tracking-wide">
              FROM SHIFTLINE TOOLS™
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 