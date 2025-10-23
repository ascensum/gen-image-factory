import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';
import StatusBadge from '../Common/StatusBadge';

// Modal tab configuration
type TabType = 'details' | 'metadata' | 'processing';

const TAB_CONFIG: Record<TabType, { label: string; id: TabType }> = {
  details: { label: 'Details', id: 'details' },
  metadata: { label: 'AI Metadata', id: 'metadata' },
  processing: { label: 'Processing', id: 'processing' }
};

interface ImageModalProps {
  image: GeneratedImage | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset to details tab when new image opens
  useEffect(() => {
    if (isOpen && image) {
      setActiveTab('details');
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [isOpen, image]);

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
    // Do not upscale beyond natural size to avoid layout jumps
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

  if (!isOpen || !image) {
    return null;
  }

  const getQCStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const processingSettings = image.processingSettings || {} as NonNullable<GeneratedImage['processingSettings']>;
  
  // Handle metadata - it might be a JSON string that needs parsing
  type Meta = NonNullable<GeneratedImage['metadata']> & {
    title?: string | { en?: string; [key: string]: string | undefined };
    description?: string | { en?: string; [key: string]: string | undefined };
    uploadTags?: { en?: string };
    tags?: string[] | string;
  };
  let metadata: Meta = {} as Meta;
  if (typeof image.metadata === 'string') {
    try {
      metadata = JSON.parse(image.metadata);
      console.log('🔍 Parsed metadata from string:', metadata);
    } catch (error) {
      console.error('❌ Failed to parse metadata string:', error);
      metadata = {};
    }
  } else if (image.metadata) {
    metadata = image.metadata;
    console.log('🔍 Metadata is already an object:', metadata);
  }
  
  // Debug logging for metadata (only in development)
  if (process.env.NODE_ENV === 'development') {
    try { console.log('ImageModal - Final metadata object:', metadata); } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
              <StatusBadge variant="qc" status={image.qcStatus || 'approved'} />
            </div>
            
            {/* Navigation and Close */}
            <div className="flex items-center space-x-2">
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
              {/* Previous/Next Navigation */}
              {(hasPrevious || hasNext) && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onPrevious}
                    disabled={!hasPrevious}
                    className={`p-2 rounded-md transition-colors ${
                      hasPrevious 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                    aria-label="Previous image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={onNext}
                    disabled={!hasNext}
                    className={`p-2 rounded-md transition-colors ${
                      hasNext 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                    aria-label="Next image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

          {/* Modal Content */}
          <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
            
            {/* Image Display - Left Side */}
            <div
              ref={containerRef}
              className="relative flex-1 flex items-center justify-center bg-gray-50 p-4"
              onWheel={handleWheel}
              onDoubleClick={fitToContainer}
            >
              <div className="relative w-full h-full overflow-hidden rounded">
                <img
                  ref={imgRef}
                  src={`local-file://${image.finalImagePath || image.tempImagePath || ''}`}
                  alt="Generated image"
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
              </div>
              {/* Toolbar: bottom-right controls */}
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
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

            {/* Metadata Panel - Right Side */}
            <div className="w-full lg:w-96 border-l border-gray-200 flex flex-col">
              
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200">
                {Object.values(TAB_CONFIG).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image ID</label>
                      <p className="text-sm text-gray-900 font-mono">{image.id}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Execution</label>
                      <p className="text-sm text-gray-900 font-mono">{image.executionId}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Generation Prompt</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">{image.generationPrompt}</p>
                    </div>
                    
                    {image.seed && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
                        <p className="text-sm text-gray-900 font-mono">{image.seed}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">QC Status</label>
                      <div className="flex items-center space-x-2 whitespace-nowrap">
                        <StatusBadge variant="qc" status={image.qcStatus || 'approved'} />
                        {image.qcReason && (
                          <span className="text-sm text-gray-600">- {image.qcReason}</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                      <p className="text-sm text-gray-900">{image.createdAt ? formatDate(image.createdAt as unknown as string | Date) : '—'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                      <p className="text-sm text-gray-900 font-mono break-all">{image.finalImagePath}</p>
                    </div>
                  </div>
                )}

                {/* AI Metadata Tab */}
                {activeTab === 'metadata' && (
                  <div className="space-y-4">
                    {/* Refresh Button */}
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">AI-Generated Metadata</h3>
                      <button
                        onClick={async () => {
                          try {
                            // Guard electronAPI type at runtime
                            const api: any = (window as any).electronAPI;
                            if (!api || !api.generatedImages || typeof api.generatedImages.getGeneratedImage !== 'function') {
                              return;
                            }
                            const refreshedImage = await api.generatedImages.getGeneratedImage(image.id);
                            if (refreshedImage && refreshedImage.success) {
                              console.log('✅ Metadata refreshed. Close and reopen the modal to see changes.');
                            }
                          } catch (error) {
                            console.error('❌ Failed to refresh metadata:', error);
                          }
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                          <path d="M8 16H3v5" />
                        </svg>
                        Refresh Metadata
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Title</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">
                        {typeof metadata.title === 'object' ? (metadata.title.en || '') : (metadata.title || 'No title generated')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Description</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">
                        {typeof metadata.description === 'object' ? (metadata.description.en || '') : (metadata.description || 'No description generated')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Tags</label>
                      <div className="bg-gray-50 p-3 rounded-md border">
                        {(() => {
                          // Handle both array and comma-separated string formats
                          let tagsArray: string[] = [];
                          // Check for uploadTags first (the actual field name from metadata)
                          if (metadata.uploadTags?.en) {
                            tagsArray = String(metadata.uploadTags.en)
                              .split(',')
                              .map((tag: string) => tag.trim())
                              .filter((tag: string) => Boolean(tag));
                          } else if (Array.isArray(metadata.tags)) {
                            tagsArray = metadata.tags as string[];
                          } else if (typeof metadata.tags === 'string' && (metadata.tags as string).trim()) {
                            tagsArray = (metadata.tags as string)
                              .split(',')
                              .map((tag: string) => tag.trim())
                              .filter((tag: string) => Boolean(tag));
                          }
                          
                          if (tagsArray.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-2">
                                {tagsArray.map((tag: string, index: number) => (
                                  <span 
                                    key={index}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            );
                          } else {
                            return <p className="text-sm text-gray-500">No tags generated</p>;
                          }
                        })()}
                      </div>
                    </div>
                    
                    {/* Metadata Prompt hidden - internal reference only */}
                  </div>
                )}

                {/* Processing Settings Tab */}
                {activeTab === 'processing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image Enhancement</label>
                        <p className="text-sm text-gray-900">{processingSettings.imageEnhancement ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sharpening</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageEnhancement ? 
                            (processingSettings.sharpening || 0) : 
                            <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Saturation</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageEnhancement ? 
                            (processingSettings.saturation || 1.4) : 
                            <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image Convert</label>
                        <p className="text-sm text-gray-900">{processingSettings.imageConvert ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Convert Format</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageConvert ? 
                            (processingSettings.convertToJpg ? 'JPG' : 'PNG') : 
                            <span className="text-gray-500 italic">Not applied (Image Convert OFF)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">JPG Quality</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageConvert && processingSettings.convertToJpg ? 
                            (processingSettings.jpgQuality || 100) : 
                            <span className="text-gray-500 italic">Not applied (Convert Format is not JPG)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PNG Quality</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageConvert && !processingSettings.convertToJpg ? 
                            (processingSettings.pngQuality || 100) : 
                            <span className="text-gray-500 italic">Not applied (Convert Format is not PNG)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remove Background</label>
                        <p className="text-sm text-gray-900">{processingSettings.removeBg ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remove.bg Size</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.removeBg ? 
                            (processingSettings.removeBgSize || 'auto') : 
                            <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>
                          }
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trim Transparent</label>
                        <p className="text-sm text-gray-900">{processingSettings.trimTransparentBackground ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">JPG Background Colour</label>
                        <p className="text-sm text-gray-900">
                          {processingSettings.imageConvert && processingSettings.convertToJpg && processingSettings.removeBg ? 
                            (processingSettings.jpgBackground || 'white') : 
                            <span className="text-gray-500 italic">Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)</span>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
