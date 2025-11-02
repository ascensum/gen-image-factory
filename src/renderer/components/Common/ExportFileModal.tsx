import React from 'react';

// Scoped styles to match ExportZipModal button sizing
const modalStyles = `
  .export-file-modal-btn {
    line-height: 1 !important;
    height: 2.25rem !important;
    max-height: 2.25rem !important;
  }
  .export-file-modal-btn.bg-blue-600,
  .export-file-modal-btn.bg-green-600 {
    padding: 0 1rem !important;
  }
  .export-file-modal input[type="radio"]:focus,
  .export-file-modal input[type="checkbox"]:focus {
    outline: none !important;
    box-shadow: none !important;
    border-color: inherit !important;
  }
`;

type DuplicatePolicy = 'append' | 'overwrite';

type FileKind = 'xlsx' | 'zip';

interface ExportFileModalProps {
  isOpen: boolean;
  count?: number; // optional informational count
  title?: string;
  defaultFilename: string;
  fileKind: FileKind; // controls extension and filter
  initialMode?: 'default' | 'custom';
  isBusy?: boolean;
  onClose: () => void;
  onExport: (opts: { mode: 'default' | 'custom'; outputPath?: string; filename: string; duplicatePolicy: DuplicatePolicy; }) => void;
}

const ExportFileModal: React.FC<ExportFileModalProps> = ({ isOpen, count = 0, title = 'Export', defaultFilename, fileKind, initialMode = 'default', isBusy = false, onClose, onExport }) => {
  const [mode, setMode] = React.useState<'default' | 'custom'>(initialMode);
  const [locationPath, setLocationPath] = React.useState<string>('');
  const [filename, setFilename] = React.useState<string>(defaultFilename);
  const [duplicatePolicy, setDuplicatePolicy] = React.useState<DuplicatePolicy>('append');
  const [error, setError] = React.useState<string | null>(null);
  const [defaultExportsPath, setDefaultExportsPath] = React.useState<string>('');

  const openedRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (isOpen && !openedRef.current) {
      openedRef.current = true;
      setMode(initialMode);
      setFilename(defaultFilename);
      setDuplicatePolicy('append');
      setError(null);
      try {
        const api: any = (window as any).electronAPI;
        api?.getExportsFolderPath?.().then((res: any) => {
          if (res && res.success) setDefaultExportsPath(res.path);
        }).catch(() => {});
      } catch {}
      // Load last used custom location per file kind
      try {
        const key = fileKind === 'xlsx' ? 'lastExportPath:xlsx' : 'lastExportPath:zip';
        const last = localStorage.getItem(key);
        if (last && typeof last === 'string' && last.trim() !== '') {
          setLocationPath(last);
          setMode('custom');
        }
      } catch {}
    }
    if (!isOpen && openedRef.current) {
      openedRef.current = false;
    }
  }, [isOpen, initialMode, defaultFilename]);

  if (!isOpen) return null;

  const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');
  const ensureExt = (name: string) => {
    const lower = name.toLowerCase();
    if (fileKind === 'xlsx') return lower.endsWith('.xlsx') ? name : `${name}.xlsx`;
    return lower.endsWith('.zip') ? name : `${name}.zip`;
  };

  const handleBrowseSave = async () => {
    setError(null);
    try {
      const api: any = (window as any).electronAPI;
      const filters = fileKind === 'xlsx'
        ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
        : [{ name: 'ZIP Archive', extensions: ['zip'] }];
      const res = await api.selectFile?.({ mode: 'save', title: 'Save As', defaultPath: filename, filters });
      if (res && res.success && res.filePath) {
        setMode('custom');
        setLocationPath(res.filePath);
        const base = res.filePath.split(/\\|\//).pop() || filename;
        setFilename(base);
        // Persist last chosen path (directory or file path)
        try {
          const key = fileKind === 'xlsx' ? 'lastExportPath:xlsx' : 'lastExportPath:zip';
          localStorage.setItem(key, res.filePath);
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to open Save dialog');
    }
  };

  const handleExport = () => {
    const safeName = ensureExt(sanitize(filename.trim() || defaultFilename));
    const outputPath = mode === 'custom' ? (locationPath || safeName) : undefined;
    onExport({ mode, outputPath, filename: safeName, duplicatePolicy });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <style>{modalStyles}</style>
      <div className="export-file-modal bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-3xl">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">{title}{count ? ` (${count})` : ''}</h2>
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
                  className="export-file-modal-btn mt-2 h-9 max-h-9 px-4 text-sm leading-none rounded border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200 min-w-[140px] inline-flex items-center justify-center shrink-0 self-start"
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
                    placeholder={fileKind === 'xlsx' ? '/path/to/file.xlsx' : '/path/to/file.zip'}
                    value={locationPath}
                    onChange={(e) => setLocationPath(e.target.value)}
                    disabled={mode !== 'custom'}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const api: any = (window as any).electronAPI;
                        const res = await api?.selectFile?.({ type: 'directory', title: 'Select Folder' });
                        if (res && res.success && res.filePath) {
                          setLocationPath(res.filePath);
                          try {
                            const key = fileKind === 'xlsx' ? 'lastExportPath:xlsx' : 'lastExportPath:zip';
                            localStorage.setItem(key, res.filePath);
                          } catch {}
                        }
                      } catch {}
                    }}
                    className="export-file-modal-btn col-span-2 h-9 max-h-9 px-4 text-sm leading-none rounded border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap justify-self-start self-center min-w-[100px] inline-flex items-center justify-center shrink-0"
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
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between space-x-2">
          <button type="button" disabled={isBusy} onClick={onClose} className={`export-file-modal-btn h-9 max-h-9 px-4 text-sm leading-none rounded border border-gray-300 min-w-[100px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>Cancel</button>
          <div className="flex items-center space-x-2">
            <button type="button" disabled={isBusy} onClick={async () => { setMode('custom'); await handleBrowseSave(); }} className={`export-file-modal-btn h-9 max-h-9 px-4 whitespace-nowrap text-sm leading-none rounded border border-blue-600 text-white min-w-[180px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save to another location…</button>
            <button type="button" disabled={isBusy} onClick={handleExport} className={`export-file-modal-btn h-9 max-h-9 px-4 whitespace-nowrap text-sm leading-none rounded border border-green-600 text-white min-w-[100px] inline-flex items-center justify-center shrink-0 self-center ${isBusy ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>Export</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportFileModal;
