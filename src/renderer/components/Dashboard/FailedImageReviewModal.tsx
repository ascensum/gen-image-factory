import React, { useState, useEffect, useRef, useCallback } from 'react';
import StatusBadge from '../Common/StatusBadge';
import type { GeneratedImage } from '../../../types/generatedImage';

type TabType = 'details' | 'metadata' | 'processing';

interface FailedImageReviewModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, imageId: string) => void;
}

const FailedImageReviewModal: React.FC<FailedImageReviewModalProps> = ({
  image,
  isOpen,
  onClose,
  onAction
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<TabType>('details');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const formatDate = (date: Date | string) => {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return String(date);
    }
  };

  const handleAction = (action: string) => {
    onAction(action, String(image.id));
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const closeButton = document.querySelector('[aria-label="Close modal"]') as HTMLButtonElement;
      if (closeButton) {
        closeButton.focus();
      }
    }
  }, [isOpen]);

  // Fit image to container (no upscale beyond natural size)
  const fitToContainer = useCallback(() => {
    const imgEl = imgRef.current;
    const contEl = containerRef.current;
    if (!imgEl || !contEl) return;
    const naturalW = imgEl.naturalWidth || imgEl.width;
    const naturalH = imgEl.naturalHeight || imgEl.height;
    const rect = contEl.getBoundingClientRect();
    const maxW = rect.width - 32;
    const maxH = rect.height - 32;
    if (naturalW <= 0 || naturalH <= 0 || maxW <= 0 || maxH <= 0) return;
    const s = Math.min(maxW / naturalW, maxH / naturalH, 1);
    setScale(s);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(fitToContainer);
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, image, fitToContainer]);

  const zoomBy = (delta: number, center?: { x: number; y: number }) => {
    setScale(prev => {
      const next = Math.min(Math.max(prev + delta, 0.2), 5);
      if (center && containerRef.current) {
        const contRect = containerRef.current.getBoundingClientRect();
        const cx = center.x - contRect.left - contRect.width / 2;
        const cy = center.y - contRect.top - contRect.height / 2;
        const ratio = next / prev - 1;
        setTranslate(t => ({ x: t.x - cx * ratio, y: t.y - cy * ratio }));
      }
      return next;
    });
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -0.1 : 0.1;
      zoomBy(direction, { x: e.clientX, y: e.clientY });
    }
  };

  const startPan: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  };

  const onPanMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTranslate({ x: translateStart.current.x + dx, y: translateStart.current.y + dy });
  };

  const endPan = () => setIsPanning(false);

  return (
    <div 
      data-testid="failed-image-review-modal"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div 
          data-testid="modal-header"
          className="flex items-center justify-between p-6 border-b border-gray-200"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Failed Image Review</h2>
            <StatusBadge variant="qc" status={(image as any)?.qcStatus || 'qc_failed'} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div 
          data-testid="modal-content"
          className="flex flex-col lg:flex-row h-full overflow-hidden"
        >
          {/* Left Panel - Image Display with pan/zoom/center */}
          <div className="lg:w-2/3 p-6 bg-gray-50">
            <div 
              data-testid="image-container"
              className="relative"
            >
              {(image.finalImagePath || image.tempImagePath) ? (
                <div
                  ref={containerRef}
                  className="relative w-full h-[28rem] lg:h-[36rem] overflow-hidden rounded bg-white border"
                  onWheel={handleWheel}
                  onDoubleClick={fitToContainer}
                >
                  <img
                    ref={imgRef}
                    src={`local-file://${image.finalImagePath || image.tempImagePath || ''}`}
                    alt="Failed image"
                    className={`${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                      transformOrigin: 'center center',
                      transition: isPanning ? 'none' : 'transform 80ms ease-out',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      userSelect: 'none',
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={startPan}
                    onMouseMove={onPanMove}
                    onMouseUp={endPan}
                    onMouseLeave={endPan}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo=';
                    }}
                  />
                  {/* Toolbar */}
                  <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-white/90 border border-gray-200 rounded-md shadow px-2 py-1 z-10">
                    <button
                      className="p-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded"
                      onClick={() => zoomBy(-0.1)}
                      title="Zoom out"
                      aria-label="Zoom out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/></svg>
                    </button>
                    <div className="text-xs text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</div>
                    <button
                      className="p-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded"
                      onClick={() => zoomBy(0.1)}
                      title="Zoom in"
                      aria-label="Zoom in"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    </button>
                    <button
                      className="p-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded"
                      onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
                      title="Reset"
                      aria-label="Reset zoom"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 12A8.001 8.001 0 004.582 9m0 0H9"/></svg>
                    </button>
                    <button
                      className="p-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded"
                      onClick={fitToContainer}
                      title="Fit to screen"
                      aria-label="Fit to screen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h7M3 3v7M21 21h-7M21 21v-7"/></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="sr-only">No Image Available</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Tabs and Actions */}
          <div className="w-full lg:w-1/3 p-6 overflow-y-auto border-l border-gray-200">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              {(['details','metadata','processing'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'details' ? 'Details' : tab === 'metadata' ? 'AI Metadata' : 'Processing'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Failure Analysis */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Failure Analysis</h3>
                    {image.qcReason ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <h4 className="text-sm font-medium text-red-800">Failure Reason</h4>
                            <p className="text-sm text-red-700 mt-1">{image.qcReason}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h4 className="text-sm font-medium text-yellow-800">No Specific Reason</h4>
                            <p className="text-sm text-yellow-700 mt-1">Image failed quality check but no specific reason provided.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generation Details */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Generation Details</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Prompt</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">{image.generationPrompt}</p>
                      </div>
                      {image.seed && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Seed</label>
                          <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border mt-1">{image.seed}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-700">Created</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">{image.createdAt ? formatDate(image.createdAt as any) : '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Job ID</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">{image.executionId}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'metadata' && image.metadata && (
                <div className="space-y-3">
                  {image.metadata.title && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Title</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">{image.metadata.title as any}</p>
                    </div>
                  )}
                  {image.metadata.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">{image.metadata.description as any}</p>
                    </div>
                  )}
                  {image.metadata.tags && (image.metadata.tags as any[]).length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tags</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(image.metadata.tags as any[]).map((tag: any, index: number) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{String(tag)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'processing' && image.processingSettings && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded border"><span className="font-medium">Enhancement:</span> {image.processingSettings.imageEnhancement ? 'Yes' : 'No'}</div>
                  <div className="bg-gray-50 p-2 rounded border"><span className="font-medium">Sharpening:</span> {image.processingSettings.sharpening || 0}</div>
                  <div className="bg-gray-50 p-2 rounded border"><span className="font-medium">Saturation:</span> {image.processingSettings.saturation || 1}</div>
                  <div className="bg-gray-50 p-2 rounded border"><span className="font-medium">Remove BG:</span> {image.processingSettings.removeBg ? 'Yes' : 'No'}</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div data-testid="modal-footer" className="mt-6 flex justify-between items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleAction('approve')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Approve image (move to success)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Approve Image
                </button>
                <button
                  onClick={() => handleAction('retry')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Add image to retry pool"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Add to Retry Pool
                </button>
                <button
                  onClick={() => handleAction('delete')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Delete image permanently"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete Image
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FailedImageReviewModal;
