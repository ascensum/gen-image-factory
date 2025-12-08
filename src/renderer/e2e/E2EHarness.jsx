import React, { useEffect, useMemo, useState } from 'react'
import ExportFileModal from '../components/Common/ExportFileModal'
import StatusBadge from '../components/Common/StatusBadge'
import { ensureElectronStub } from './ensureElectronStub'

const ExportHarness = () => {
  const [variant, setVariant] = useState(null)
  const [lastExport, setLastExport] = useState(null)

  useEffect(() => {
    ensureElectronStub()
  }, [])

  const defaultFilename = useMemo(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    if (variant === 'zip') return `bulk_${ts}.zip`
    return `job_${ts}.xlsx`
  }, [variant])

  const closeModal = () => setVariant(null)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-start py-10 space-y-6" data-testid="export-harness">
      <div className="space-x-4">
        <button
          type="button"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 transition"
          data-testid="open-xlsx-export"
          onClick={() => setVariant('xlsx')}
        >
          Open XLSX Export
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 transition"
          data-testid="open-zip-export"
          onClick={() => setVariant('zip')}
        >
          Open ZIP Export
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition"
          data-testid="reset-export-memory"
          onClick={() => {
            localStorage.removeItem('lastExportPath:xlsx')
            localStorage.removeItem('lastExportPath:zip')
            setLastExport(null)
          }}
        >
          Reset Export Memory
        </button>
      </div>

      <div className="flex space-x-4" data-testid="status-demo">
        <StatusBadge data-testid="status-badge-failed" variant="job" status="failed" />
        <StatusBadge data-testid="status-badge-retry-failed" variant="qc" status="retry_failed" labelOverride="Retry Failed" />
      </div>

      <pre data-testid="last-export-payload" className="bg-black/40 rounded p-4 min-w-[320px] text-xs overflow-x-auto">
        {lastExport ? JSON.stringify(lastExport, null, 2) : 'null'}
      </pre>

      {variant && (
        <ExportFileModal
          isOpen
          title={variant === 'zip' ? 'Export Selected Jobs' : 'Export Job'}
          fileKind={variant}
          defaultFilename={defaultFilename}
          count={variant === 'zip' ? 3 : 1}
          onClose={closeModal}
          onExport={(payload) => {
            console.log('[E2E] onExport payload', payload)
            setLastExport({ variant, payload })
            closeModal()
          }}
        />
      )}
    </div>
  )
}

export default ExportHarness

