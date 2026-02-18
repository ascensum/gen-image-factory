/**
 * Story 3.4 Phase 5c.4: Image view with zoom/pan and toolbar for FailedImageReviewModal.
 */
import React from 'react';
import { buildLocalFileUrl } from '../../../utils/urls';
import type { GeneratedImage } from '../../../../types/generatedImage';

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo=';

interface FailedImageReviewModalImageViewProps {
  image: GeneratedImage;
  containerRef: React.RefObject<HTMLDivElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  scale: number;
  translate: { x: number; y: number };
  isPanning: boolean;
  fitToContainer: () => void;
  zoomBy: (delta: number, center?: { x: number; y: number }) => void;
  handleWheel: React.WheelEventHandler<HTMLDivElement>;
  startPan: React.MouseEventHandler<HTMLDivElement>;
  onPanMove: React.MouseEventHandler<HTMLDivElement>;
  endPan: () => void;
  setScale: (v: number | ((prev: number) => number)) => void;
  setTranslate: (v: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
}

const FailedImageReviewModalImageView: React.FC<FailedImageReviewModalImageViewProps> = ({
  image,
  containerRef,
  imgRef,
  scale,
  translate,
  isPanning,
  fitToContainer,
  zoomBy,
  handleWheel,
  startPan,
  onPanMove,
  endPan,
  setScale,
  setTranslate,
}) => {
  const hasPath = image.finalImagePath || image.tempImagePath;
  return (
    <div className="w-1/2 xl:w-2/3 p-6 bg-gray-50 flex flex-col h-full">
      <div data-testid="image-container" className="relative flex-1 h-full min-h-0">
        {hasPath ? (
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
              className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
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
                pointerEvents: 'auto',
              }}
              onMouseDown={startPan}
              onMouseMove={onPanMove}
              onMouseUp={endPan}
              onMouseLeave={endPan}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_SVG;
              }}
            />
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
  );
};

export default FailedImageReviewModalImageView;
