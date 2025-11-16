import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildLocalFileUrl } from '../../utils/urls';
import './FailedImageReviewModal.css';
import StatusBadge from '../Common/StatusBadge';
import type { GeneratedImage } from '../../../types/generatedImage';

type TabType = 'details' | 'metadata' | 'processing';

interface FailedImageReviewModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, imageId: string) => void;
  onApprove?: (imageId: string) => Promise<void>;
  onRetry?: (imageId: string) => Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDelete?: (imageId: string) => Promise<void>;
}

const FailedImageReviewModal: React.FC<FailedImageReviewModalProps> = ({
  image,
  isOpen,
  onClose,
  onAction,
  onApprove,
  onRetry,
  onPrevious,
  onNext,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  // Prefer execution snapshot processing settings when available (as-run)
  const [snapshotProcessing, setSnapshotProcessing] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previousImageIdRef = useRef<string | number | null>(null);

  // Parse metadata safely (string or object) similar to Image Gallery modal
  const parseMetadata = (raw: any): any => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  };

  // No longer used after aligning to date-only format

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
    // Component mounted
    return () => {
      // Component unmounting
    };
  }, []);
  
  // Load execution snapshot for processing display
  useEffect(() => {
    let cancelled = false;
    async function fetchSnap() {
      try {
        const api: any = (window as any).electronAPI;
        if (!api || typeof api.getJobExecutionByImageId !== 'function' || !(image as any)?.id) return;
        const res = await api.getJobExecutionByImageId((image as any).id);
        const exec = (res && res.success && res.execution) ? res.execution : null;
        const proc = exec?.configurationSnapshot?.processing || null;
        if (!cancelled) setSnapshotProcessing(proc);
      } catch {
        // ignore
      }
    }
    if (isOpen && image) {
      fetchSnap();
    } else {
      setSnapshotProcessing(null);
    }
    return () => { cancelled = true; };
  }, [isOpen, (image as any)?.id]);
  
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
    // Default zoom to fit (no upscale)
    const fit = Math.min(maxW / naturalW, maxH / naturalH, 1);
    setScale(fit > 0 ? fit : 1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Only reset zoom/scale when modal first opens or when it's a fresh open (not navigation)
  useEffect(() => {
    if (isOpen && image) {
      const currentImageId = image.id;
      const previousImageId = previousImageIdRef.current;
      
      // Check if this is a new modal session (modal was closed) vs navigation within modal
      const isNewSession = previousImageId === null;
      // Check if the image ID actually changed (not just a re-render with same image)
      const imageChanged = previousImageId !== null && String(previousImageId) !== String(currentImageId);
      
      if (isNewSession) {
        // Fresh modal open - reset everything and fit image
        setActiveTab('details');
        setScale(1);
        setTranslate({ x: 0, y: 0 });
        requestAnimationFrame(fitToContainer);
        previousImageIdRef.current = currentImageId;
      } else if (imageChanged) {
        // Navigating to different image - just update tracker, preserve zoom/pan
        previousImageIdRef.current = currentImageId;
      }
      // else: same image re-rendered (e.g., list refresh) - do nothing
    } else if (!isOpen) {
      // Modal closed - reset tracker for next session
      previousImageIdRef.current = null;
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

  // Guard after hooks to keep hook order stable across renders
  if (!isOpen) return null;

  return (
    <div 
      data-testid="failed-image-review-modal"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header with QC badge, actions, navigation, close */}
        <div data-testid="modal-header" className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
            <div className="inline-flex items-center">
              {
                (() => {
                  try {
                    const { formatQcLabel } = require('../../utils/qc');
                    const label = formatQcLabel((image as any)?.qcStatus, (image as any)?.qcReason);
                    return <StatusBadge variant="qc" status={(image as any)?.qcStatus || 'qc_failed'} labelOverride={label} />;
                  } catch {
                    return <StatusBadge variant="qc" status={(image as any)?.qcStatus || 'qc_failed'} />;
                  }
                })()
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                if (onApprove) {
                  await onApprove(String(image.id));
                } else {
                  handleAction('approve');
                }
              }} 
              className="review-modal-button bg-green-600 text-white hover:bg-green-700" 
              title="Approve image (move to success)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Approve
            </button>
            <button 
              onClick={async () => {
                if (onRetry) {
                  await onRetry(String(image.id));
                } else {
                  handleAction('retry');
                }
              }} 
              className="review-modal-button bg-blue-600 text-white hover:bg-blue-700" 
              title="Add image to retry pool"
            >
              {/* lucide redo-2 */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />
              </svg>
              Add to Retry
            </button>
            <button 
              onClick={async () => {
                if (onDelete) {
                  await onDelete(String(image.id));
                } else {
                  handleAction('delete');
                }
              }} 
              className="review-modal-button bg-red-600 text-white hover:bg-red-700" 
              title="Delete image permanently"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
            {/* Help in header */}
            <button
              type="button"
              onClick={() => setShowHelp(v => !v)}
              className="px-2 py-1 text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded"
              aria-label="Image Control Info"
              title="Image Control Info"
            >
              Image Control Info
            </button>
            <div className="flex items-center space-x-1">
              <button onClick={onPrevious} className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100" aria-label="Previous image">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={onNext} className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100" aria-label="Next image">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Close modal">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Help Popover (anchored under header, inside modal container) */}
        {showHelp && (
          <div className="absolute top-14 right-4 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs text-gray-700 z-20">
            <div className="flex items-start justify-between mb-2">
              <div className="font-medium text-gray-900">Image viewer controls</div>
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-gray-700"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <ul className="space-y-1 list-disc pl-4">
              <li><span className="font-medium">Pan</span>: Click and drag on the image</li>
              <li><span className="font-medium">Zoom</span>: Ctrl (Windows/Linux) or ⌘ Cmd (macOS) + mouse wheel</li>
              <li><span className="font-medium">Fit</span>: Double‑click image</li>
              <li><span className="font-medium">Toolbar (bottom‑right)</span>: Zoom out (−), Zoom in (+), Reset, Fit to screen</li>
            </ul>
          </div>
        )}

        {/* Content */}
        <div 
          data-testid="modal-content"
          className="flex flex-row h-[calc(90vh-80px)] overflow-hidden"
        >
          {/* Left Panel - Image Display with pan/zoom/center */}
          <div className="w-1/2 xl:w-2/3 p-6 bg-gray-50 flex flex-col h-full">
            <div 
              data-testid="image-container"
              className="relative flex-1 h-full min-h-0"
            >
              {(image.finalImagePath || image.tempImagePath) ? (
                <div
                  ref={containerRef}
                  className="relative w-full h-full overflow-hidden rounded"
                  onWheel={handleWheel}
                  onDoubleClick={fitToContainer}
                >
                  <img
                    ref={imgRef}
                    src={buildLocalFileUrl(image.finalImagePath || image.tempImagePath || '')}
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
          <div className="w-1/2 xl:w-1/3 border-l border-gray-200 flex flex-col h-full overflow-hidden xl:min-w-[400px]">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
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

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Details: Job Id, Image Id */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Id</label>
                      <p className="text-sm text-gray-900 font-mono">{image.executionId}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image Id</label>
                      <p className="text-sm text-gray-900 font-mono">{image.id}</p>
                    </div>
                  </div>

                  {/* Failure Analysis */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Failure Analysis</h3>
                    <div className={image.qcReason ? 'bg-red-50 border border-red-200 rounded-lg p-4' : 'bg-yellow-50 border border-yellow-200 rounded-lg p-4'}>
                      <div className="flex items-start">
                        <svg className={`w-5 h-5 mt-0.5 mr-2 ${image.qcReason ? 'text-red-400' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={image.qcReason ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' : 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
                        </svg>
                        <div>
                          <h4 className={`text-sm font-medium ${image.qcReason ? 'text-red-800' : 'text-yellow-800'}`}>{image.qcReason ? 'Failure Reason' : 'No Specific Reason'}</h4>
                          <p className={`${image.qcReason ? 'text-red-700' : 'text-yellow-700'} text-sm mt-1`}>{image.qcReason || 'Image failed quality check but no specific reason provided.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Generation Details */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Generation Details</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{image.generationPrompt}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <p className="text-sm text-gray-900">{image.createdAt ? new Date(image.createdAt as any).toLocaleDateString() : '—'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                        <p className="text-sm text-gray-900 font-mono break-all">{image.finalImagePath || image.tempImagePath || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'metadata' && (
                <div className="space-y-4">
                  {(() => {
                    const meta = parseMetadata((image as any).metadata);
                    const title = typeof meta?.title === 'object' ? (meta.title.en || '') : (meta?.title || '');
                    const description = typeof meta?.description === 'object' ? (meta.description.en || '') : (meta?.description || '');
                    // Build tags array from uploadTags.en, tags[] or comma string
                    let tagsArray: string[] = [];
                    if (meta?.uploadTags?.en) {
                      tagsArray = String(meta.uploadTags.en).split(',').map((t: string) => t.trim()).filter(Boolean);
                    } else if (Array.isArray(meta?.tags)) {
                      tagsArray = meta.tags as string[];
                    } else if (typeof meta?.tags === 'string') {
                      tagsArray = String(meta.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
                    }

                    if (!title && !description && tagsArray.length === 0) {
                      return <p className="text-sm text-gray-500">No AI metadata available.</p>;
                    }

                    return (
                      <>
                        {title && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Title</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">{title}</p>
                          </div>
                        )}
                        {description && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Description</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">{description}</p>
                          </div>
                        )}
                        {tagsArray.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Tags</label>
                            <div className="flex flex-wrap gap-1">
                              {tagsArray.map((tag: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'processing' && (
                <div className="space-y-4">
                  {(() => {
                    // Prefer per-image settings only when they differ from snapshot (custom retry),
                    // otherwise prefer execution snapshot (as-run).
                    const toObject = (val: any) => {
                      if (!val) return null;
                      if (typeof val === 'string') {
                        try { return JSON.parse(val); } catch { return null; }
                      }
                      if (typeof val === 'object') return val;
                      return null;
                    };
                    const pickProcessingKeys = (obj: any) => {
                      if (!obj || typeof obj !== 'object') return null;
                      const keys = [
                        'imageEnhancement','sharpening','saturation','imageConvert','convertToJpg',
                        'jpgQuality','pngQuality','removeBg','trimTransparentBackground','jpgBackground','removeBgSize'
                      ];
                      const out: any = {};
                      keys.forEach(k => { if (k in obj) out[k] = obj[k]; });
                      return out;
                    };
                    const perImageProc = pickProcessingKeys(toObject((image as any)?.processingSettings));
                    const snapshotProc = pickProcessingKeys(snapshotProcessing);
                    const isCustomRetry = !!(perImageProc && snapshotProc && JSON.stringify(perImageProc) !== JSON.stringify(snapshotProc));
                    const ps = isCustomRetry
                      ? (toObject((image as any)?.processingSettings) || snapshotProcessing || {})
                      : (snapshotProcessing || toObject((image as any)?.processingSettings) || {});
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Image Enhancement</label>
                          <p className="text-sm text-gray-900">{ps.imageEnhancement ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sharpening</label>
                          <p className="text-sm text-gray-900">{ps.imageEnhancement ? (ps.sharpening || 0) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Saturation</label>
                          <p className="text-sm text-gray-900">{ps.imageEnhancement ? (ps.saturation || 1.4) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Image Convert</label>
                          <p className="text-sm text-gray-900">{ps.imageConvert ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Convert Format</label>
                          <p className="text-sm text-gray-900">
                            {ps.imageConvert ? (ps.convertToWebp ? 'WEBP' : (ps.convertToJpg ? 'JPG' : 'PNG')) : <span className="text-gray-500 italic">Not applied (Image Convert OFF)</span>}
                          </p>
                        </div>
                        {ps.imageConvert && ps.convertToJpg && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">JPG Quality</label>
                            <p className="text-sm text-gray-900">{ps.jpgQuality || 85}</p>
                          </div>
                        )}
                        {ps.imageConvert && ps.convertToWebp && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">WebP Quality</label>
                            <p className="text-sm text-gray-900">{ps.webpQuality || 85}</p>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Remove Background</label>
                          <p className="text-sm text-gray-900">{ps.removeBg ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Remove.bg Size</label>
                          <p className="text-sm text-gray-900">{ps.removeBg ? (ps.removeBgSize || 'auto') : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Trim Transparent</label>
                          <p className="text-sm text-gray-900">
                            {ps.removeBg
                              ? (ps.trimTransparentBackground ? 'Yes' : 'No')
                              : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">JPG Background Colour</label>
                          <p className="text-sm text-gray-900">{ps.imageConvert && ps.convertToJpg && ps.removeBg ? (ps.jpgBackground || 'white') : <span className="text-gray-500 italic">Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)</span>}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer trimmed - actions are in header */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FailedImageReviewModal;
