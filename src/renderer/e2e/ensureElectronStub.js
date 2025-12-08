export const ensureElectronStub = () => {
  if (typeof window === 'undefined') return
  if (window.electronAPI) return

  const selectFile = async (options = {}) => {
    const filters = options.filters ?? []
    if (filters.some((f) => f.extensions?.includes('xlsx'))) {
      return { success: true, filePath: '/Users/e2e/Documents/demo-report.xlsx' }
    }
    if (filters.some((f) => f.extensions?.includes('zip'))) {
      return { success: true, filePath: '/Users/e2e/Documents/demo-batch.zip' }
    }
    return { success: true, filePath: '/Users/e2e/Documents/custom-folder' }
  }

  const noop = () => {}

  window.electronAPI = {
    ping: async () => 'pong',
    getAppVersion: async () => 'e2e',
    getExportsFolderPath: async () => ({ success: true, path: '/Users/e2e/Exports' }),
    openExportsFolder: async () => ({ success: true }),
    selectFile,
    generatedImages: {
      onZipExportProgress: noop,
      onZipExportCompleted: noop,
      onZipExportError: noop,
      removeZipExportProgress: noop,
      removeZipExportCompleted: noop,
      removeZipExportError: noop,
    },
    jobManagement: {
      rerunJobExecution: async () => ({ success: true }),
      deleteJobExecution: async () => ({ success: true }),
    },
  }
}

