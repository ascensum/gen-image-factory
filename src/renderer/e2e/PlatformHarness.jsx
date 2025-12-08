import React, { useEffect, useMemo, useState } from 'react'
import { ensureElectronStub } from './ensureElectronStub'

const PLATFORM_CONFIGS = {
  darwin: {
    label: 'macOS',
    icon: 'build/icons/mac/icon.icns',
    pathExample: '/Users/e2e/Documents/demo-report.xlsx',
    defaultRoots: ['~/Desktop', '~/Documents'],
    keyboardShortcuts: {
      save: '⌘ + S',
      preferences: '⌘ + ,',
    },
    localFileUrl: 'local-file://users/e2e/Documents/demo-report.xlsx',
  },
  win32: {
    label: 'Windows',
    icon: 'build/icons/win/icon.ico',
    pathExample: 'C:\\Users\\e2e\\Documents\\demo-report.xlsx',
    defaultRoots: ['C:\\Users\\e2e\\Desktop', 'C:\\Users\\e2e\\Documents'],
    keyboardShortcuts: {
      save: 'Ctrl + S',
      preferences: 'Ctrl + ,',
    },
    localFileUrl: 'local-file://localhost/C:/Users/e2e/Documents/demo-report.xlsx',
  },
  linux: {
    label: 'Linux',
    icon: 'build/icons/png/512x512.png',
    pathExample: '/home/e2e/Documents/demo-report.xlsx',
    defaultRoots: ['~/Desktop', '~/Documents'],
    keyboardShortcuts: {
      save: 'Ctrl + S',
      preferences: 'Ctrl + ,',
    },
    localFileUrl: 'local-file://home/e2e/Documents/demo-report.xlsx',
  },
}

const normalizeLocalFileUrl = (platform, sampleUrl) => {
  try {
    const url = new URL(sampleUrl)
    let filePath = decodeURIComponent(url.pathname)

    if (platform === 'win32' && /^\/[a-zA-Z]:\//.test(filePath)) {
      filePath = filePath.slice(1)
    }

    if (platform !== 'win32' && url.hostname) {
      filePath = `/${url.hostname}${filePath}`
    }

    filePath = filePath.replace(/\\/g, '/')

    if (platform === 'darwin' && filePath.startsWith('/users/')) {
      filePath = '/Users/' + filePath.slice('/users/'.length)
    }

    if (platform === 'win32') {
      return filePath.replace(/\//g, '\\')
    }
    return filePath
  } catch {
    return sampleUrl
  }
}

const getInitialPlatform = () => {
  if (typeof window === 'undefined') return 'darwin'
  const hash = window.location.hash || ''
  const [, search = ''] = hash.split('?')
  const params = new URLSearchParams(search)
  const requested = params.get('platform')
  if (requested && requested in PLATFORM_CONFIGS) {
    return requested
  }
  return 'darwin'
}

const PlatformHarness = () => {
  const [platform, setPlatform] = useState(getInitialPlatform)
  const config = PLATFORM_CONFIGS[platform]

  useEffect(() => {
    ensureElectronStub()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const desiredHash = `#/__e2e__/platform?platform=${platform}`
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash
    }
  }, [platform])

  const protocolPath = useMemo(
    () => normalizeLocalFileUrl(platform, config.localFileUrl),
    [platform, config.localFileUrl]
  )

  return (
    <div
      data-testid="platform-harness"
      className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-10 px-4 space-y-6"
    >
      <div className="space-x-4" data-testid="platform-selector">
        {Object.entries(PLATFORM_CONFIGS).map(([key, value]) => (
          <button
            key={key}
            type="button"
            className={`px-4 py-2 rounded ${
              key === platform ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
            }`}
            data-testid={`platform-toggle-${key}`}
            onClick={() => setPlatform(key)}
          >
            {value.label}
          </button>
        ))}
      </div>

      <div
        className="w-full max-w-3xl bg-slate-800 rounded-xl p-6 space-y-4 shadow-lg"
        data-testid="platform-details"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-400">Active Platform</p>
            <p className="text-2xl font-semibold" data-testid="platform-current">
              {config.label}
            </p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-400">Window Icon</p>
            <p className="font-mono" data-testid="platform-icon-path">
              {config.icon}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Preferred Save Location</p>
            <p className="font-mono text-sm" data-testid="platform-path">
              {config.pathExample}
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Normalized local-file URL</p>
            <p className="font-mono text-sm" data-testid="platform-protocol-path">
              {protocolPath}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-400">Keyboard Shortcuts</p>
            <div className="text-sm">
              <p data-testid="platform-shortcut-save">Save: {config.keyboardShortcuts.save}</p>
              <p data-testid="platform-shortcut-preferences">
                Preferences: {config.keyboardShortcuts.preferences}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Security Toggles</p>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between">
                <dt>Context Isolation</dt>
                <dd data-testid="platform-security-contextIsolation">Enabled</dd>
              </div>
              <div className="flex justify-between">
                <dt>Node Integration</dt>
                <dd data-testid="platform-security-nodeIntegration">Disabled</dd>
              </div>
              <div className="flex justify-between">
                <dt>Secure Context</dt>
                <dd data-testid="platform-security-context">True</dd>
              </div>
            </dl>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Default Allowed Roots</p>
            <ul className="text-sm space-y-1" data-testid="platform-default-roots">
              {config.defaultRoots.map((root) => (
                <li key={root}>{root}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlatformHarness

