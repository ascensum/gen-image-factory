import React from 'react';

// Scoped styles to override global button styles for this modal
const modalStyles = `
  .export-zip-modal-btn {
    line-height: 1 !important;
    height: 2.25rem !important;
    max-height: 2.25rem !important;
  }
  .export-zip-modal-btn.bg-blue-600,
  .export-zip-modal-btn.bg-green-600 {
    padding: 0 1rem !important;
  }
  .export-zip-modal input[type="radio"]:focus,
  .export-zip-modal input[type="checkbox"]:focus {
    outline: none !important;
    box-shadow: none !important;
    border-color: inherit !important;
  }
`;

type DuplicatePolicy = 'append' | 'overwrite';

interface ExportZipModalProps {
  isOpen: boolean;
  count: number;
  defaultFilename: string;
  initialMode?: 'default' | 'custom';
  initialIncludeExcel?: boolean;
  step?: 'gathering-files' | 'creating-excel' | 'zipping' | null;
  isBusy?: boolean;
  onClose: () => void;
  onExport: (opts: { mode: 'default' | 'custom'; outputPath?: string; filename: string; includeExcel: boolean; duplicatePolicy: DuplicatePolicy; }) => void;
}

const ExportZipModal: React.FC<ExportZipModalProps> = ({ isOpen, count, defaultFilename, initialMode = 'default', initialIncludeExcel = true, step = null, isBusy = false, onClose, onExport }) => {
  const [mode, setMode] = React.useState<'default' | 'custom'>(initialMode);
  const [locationPath, setLocationPath] = React.useState<string>('');
  const [filename, setFilename] = React.useState<string>(defaultFilename);
  const [includeExcel, setIncludeExcel] = React.useState<boolean>(initialIncludeExcel);
  const [duplicatePolicy, setDuplicatePolicy] = React.useState<DuplicatePolicy>('append');
  const [error, setError] = React.useState<string | null>(null);
  const [defaultExportsPath, setDefaultExportsPath] = React.useState<string>('');

  // Initialize state only when the modal is opened; do not reset due to prop churn
  const openedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (isOpen && !openedRef.current) {
      openedRef.current = true;
      setMode(initialMode);
      setFilename(defaultFilename);
      setIncludeExcel(initialIncludeExcel);
      setDuplicatePolicy('append');
      setError(null);
      try {
        const api: any = (window as any).electronAPI;
        api?.getExportsFolderPath?.().then((res: any) => {
          if (res && res.success) setDefaultExportsPath(res.path);
        }).catch(() => {});
      } catch {}
    }
    if (!isOpen && openedRef.current) {
      openedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');
  const ensureZipExt = (name: string) => name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;

  const handleBrowseSave = async () => {
    setError(null);
    try {
      const api: any = (window as any).electronAPI;
      const res = await api.selectFile?.({ mode: 'save', title: 'Save ZIP As', defaultPath: filename, filters: [{ name: 'ZIP Archive', extensions: ['zip'] }] });
      if (res && res.success && res.filePath) {
        setMode('custom');
        setLocationPath(res.filePath);
        const base = res.filePath.split(/\\|\//).pop() || filename;
        setFilename(base);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to open Save dialog');
    }
  };

  const handleExport = () => {
    const safeName = ensureZipExt(sanitize(filename.trim() || defaultFilename));
    const outputPath = mode === 'custom' ? (locationPath || safeName) : undefined;
    onExport({ mode, outputPath, filename: safeName, includeExcel, duplicatePolicy });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <style>{modalStyles}</style>
      <div className="export-zip-modal bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-3xl">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">Export Selected Images ({count})</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 text-xl leading-none p-2 -m-2">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[84vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Destination</div>
            <label className="grid grid-cols-[auto_1fr] items-start gap-2 rounded hover:bg-gray-50 p-0 cursor-pointer">
              <input type="radio" className="mt-0.5 focus:ring-0" checked={mode === 'default'} onChange={() => setMode('default')} />
                <div>
                  <div className="text-sm text-gray-900">Default app Exports folder</div>
                  <input className="mt-2 w-full h-9 border rounded px-2 text-sm text-gray-600 bg-gray-50" value={defaultExportsPath || 'App data exports folder (recommended)'} disabled />
                <button
                  type="button"
                  onClick={async () => { try { await (window as any).electronAPI.openExportsFolder(); } catch {} }}
                  className="export-zip-modal-btn mt-2 h-9 max-h-9 px-4 text-sm leading-none rounded border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200 min-w-[140px] inline-flex items-center justify-center shrink-0 self-start"
                >Open Exports Folder</button>
              </div>
            </label>

            <label className="grid grid-cols-[auto_1fr] items-start gap-2 rounded hover:bg-gray-50 p-0 cursor-pointer">
              <input type="radio" className="mt-0.5 focus:ring-0" checked={mode === 'custom'} onChange={() => setMode('custom')} />
              <div className="w-full">
                  <div className="text-sm text-gray-900">Save to another location</div>
                  <div className="mt-2 grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-2 text-sm text-gray-900">Location:</span>
                    <input
                      className="col-span-7 h-9 border rounded px-2 text-sm disabled:bg-gray-50"
                      placeholder="/path/to/file.zip"
                      value={locationPath}
                      onChange={(e) => setLocationPath(e.target.value)}
                      disabled={mode !== 'custom'}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        // choose directory for Location
                        try {
                          const api: any = (window as any).electronAPI;
                          const res = await api?.selectFile?.({ type: 'directory', title: 'Select Folder' });
                          if (res && res.success && res.filePath) setLocationPath(res.filePath);
                        } catch {}
                      }}
                      className="export-zip-modal-btn col-span-2 h-9 max-h-9 px-4 text-sm leading-none rounded border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap justify-self-start self-center min-w-[100px] inline-flex items-center justify-center shrink-0"
                      disabled={mode !== 'custom'}
                    >Browse…</button>
                    <span className="col-span-2 text-sm text-gray-900">Filename:</span>
                    <input
                      className="col-span-10 h-9 border rounded px-2 text-sm disabled:bg-gray-50"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      disabled={mode !== 'custom'}
                    />
                  </div>
                </div>
            </label>
          </div>

          {/* Package Options */}
          <div className="pt-1 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Package options</div>
            <label className="grid grid-cols-[auto_1fr] items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 focus:ring-0" checked={includeExcel} onChange={(e) => setIncludeExcel(e.target.checked)} />
              <span className="text-sm text-gray-700">Include Excel metadata (metadata.xlsx)</span>
            </label>
            {/* Folder layout inside ZIP (monospace block) */}
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Folder layout inside ZIP:</div>
              <div className="text-xs text-gray-700 font-mono leading-5">
                <div>images/ <span className="text-gray-500">(image files)</span></div>
                <div>metadata.xlsx</div>
              </div>
            </div>
          </div>

          {/* Conflicts & Naming */}
          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Conflicts & naming</div>
            <div className="text-[11px] text-gray-500 -mt-0.5 mb-2">(applies only for custom locations)</div>
            <div className="flex items-center space-x-6">
              <label className="inline-flex items-center space-x-1">
                <input type="radio" checked={duplicatePolicy === 'append'} onChange={() => setDuplicatePolicy('append')} />
                <span className="text-sm text-gray-700">Auto-append number</span>
              </label>
              <label className="inline-flex items-center space-x-1">
                <input type="radio" checked={duplicatePolicy === 'overwrite'} onChange={() => setDuplicatePolicy('overwrite')} />
                <span className="text-sm text-gray-700">Overwrite (confirm)</span>
              </label>
            </div>
            {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
          </div>

          {/* Status */}
          <div className="pt-1 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Status</div>
            <div className="flex items-center space-x-6 text-sm text-gray-700">
              <div className={`flex items-center space-x-2 ${step === 'gathering-files' ? 'text-gray-900 font-medium' : ''}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${step === 'gathering-files' ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                <span>Gathering files…</span>
              </div>
              <div className={`flex items-center space-x-2 ${step === 'creating-excel' ? 'text-gray-900 font-medium' : ''}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${step === 'creating-excel' ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                <span>Creating Excel…</span>
              </div>
              <div className={`flex items-center space-x-2 ${step === 'zipping' ? 'text-gray-900 font-medium' : ''}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${step === 'zipping' ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                <span>Zipping…</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between space-x-2">
          <button type="button" disabled={isBusy} onClick={onClose} className={`export-zip-modal-btn h-9 max-h-9 px-4 text-sm leading-none rounded border border-gray-300 min-w-[100px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>Cancel</button>
          <div className="flex items-center space-x-2">
            <button type="button" disabled={isBusy} onClick={async () => { setMode('custom'); await handleBrowseSave(); }} className={`export-zip-modal-btn h-9 max-h-9 px-4 whitespace-nowrap text-sm leading-none rounded border border-blue-600 text-white min-w-[180px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save to another location…</button>
            <button type="button" disabled={isBusy} onClick={handleExport} className={`export-zip-modal-btn h-9 max-h-9 px-4 whitespace-nowrap text-sm leading-none rounded border border-green-600 text-white min-w-[100px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>Export</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportZipModal;


