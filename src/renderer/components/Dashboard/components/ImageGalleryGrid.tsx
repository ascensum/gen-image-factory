/**
 * Story 3.4 Phase 5c.3: Grid view for ImageGallery.
 * When containerWidth/Height are provided, uses react-window Grid for virtualization.
 */
import React, { useCallback, useMemo } from 'react';
import { Grid } from 'react-window';
import { buildLocalFileUrl } from '../../../utils/urls';
import StatusBadge from '../../Common/StatusBadge';
import { parseImageGalleryMetadata } from '../hooks/useImageGalleryFilteredImages';
import type { ImageGalleryImage } from '../hooks/useImageGalleryFilteredImages';

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0Oi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xOSAzSDVDMy45IDMgMyAzLjkgMyA1VjE5QzMgMjAuMSAzLjkgMjEgNSAyMUgxOUMyMC4xIDIxIDIxIDIwLjEgMjEgMTlWNUMxMSAzLjkgMjAuMSAzIDE5IDNaTTE5IDE5SDVWNUgxOVYxOVoiIGZpbGw9IiM5QjlCQTAiLz4KPHBhdGggZD0iTTE0IDEzSDEwVjE3SDE0VjEzWiIgZmlsbD0iI0QxRDVEM0EiLz4KPC9zdmc+Cjwvc3ZnPgo=';

const GAP = 16;
const PADDING = 16;
/** Reserved height for card text block (title + job + date + padding) so it never gets cut. */
const TEXT_BLOCK_HEIGHT = 110;
/** Minimum card width; with max 4 columns we get larger cards and room for square + text. */
const MIN_COLUMN_WIDTH = 260;
/** Max columns so each row has at most 4 images; row height = columnWidth + TEXT_BLOCK_HEIGHT. */
const MAX_COLUMNS = 4;

/** Coerce to number; never return NaN (react-window can pass undefined or strings). */
function toStyleNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Build cell style from react-window: keep position/transform. Never output NaN for any property. */
function buildCellStyle(style: React.CSSProperties): React.CSSProperties {
  const w = Math.max(0, toStyleNum(style.width));
  const h = Math.max(0, toStyleNum(style.height));
  const out: React.CSSProperties = {
    position: style.position ?? 'absolute',
    transform: style.transform,
    width: w > GAP ? w - GAP : w,
    height: h > GAP ? h - GAP : h,
  };
  const left = toStyleNum(style.left);
  const rightVal = toStyleNum(style.right);
  if (style.left !== undefined && style.left !== null) out.left = left;
  if (style.right !== undefined && style.right !== null) out.right = rightVal;
  if ('top' in style) {
    const t = (style as Record<string, unknown>).top;
    const topVal = toStyleNum(t);
    if (Number.isFinite(topVal)) out.top = topVal;
  }
  return out;
}

interface ImageGalleryGridProps {
  images: ImageGalleryImage[];
  selectedImages: Set<string>;
  onImageSelect: (imageId: string) => void;
  jobIdToLabel: Record<string, string>;
  onOpenModal: (image: ImageGalleryImage) => void;
  onImageAction: (action: string, imageId: string, data?: unknown) => void;
  formatDate: (date: Date) => string;
  containerWidth?: number;
  containerHeight?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function GalleryCard({
  image,
  selectedImages,
  onImageSelect,
  jobIdToLabel,
  onOpenModal,
  onImageAction,
  formatDate,
}: {
  image: ImageGalleryImage;
  selectedImages: Set<string>;
  onImageSelect: (imageId: string) => void;
  jobIdToLabel: Record<string, string>;
  onOpenModal: (image: ImageGalleryImage) => void;
  onImageAction: (action: string, imageId: string, data?: unknown) => void;
  formatDate: (date: Date) => string;
}) {
  const meta = parseImageGalleryMetadata(image.metadata);
  const titleVal = (meta?.title && typeof meta.title === 'object' ? (meta.title as { en?: string }).en : meta?.title) || '';
  const displayTitle = (typeof titleVal === 'string' && titleVal.trim()) ? titleVal : (image.generationPrompt || 'Untitled');
  const jobLabel = jobIdToLabel[String(image.executionId)] || `Job ${String(image.executionId)}`;
  const tags = (image.metadata && typeof image.metadata === 'object' && 'tags' in image.metadata && Array.isArray((image.metadata as { tags?: string[] }).tags))
    ? (image.metadata as { tags: string[] }).tags
    : [];

  return (
    <div
      className={`relative flex flex-col bg-white border rounded-lg overflow-hidden transition-colors h-full ${
        selectedImages.has(image.id)
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="absolute top-2 right-2 z-10">
        <input
          type="checkbox"
          checked={selectedImages.has(image.id)}
          onChange={() => onImageSelect(image.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          aria-label={`Select ${image.generationPrompt}`}
        />
      </div>

      <div className="relative w-full aspect-square overflow-hidden bg-gray-100 flex-shrink-0">
        <div className="absolute top-2 left-2 z-10">
          <StatusBadge variant="qc" status="approved" />
        </div>
        {(image.finalImagePath || image.tempImagePath) ? (
          <img
            src={buildLocalFileUrl(image.finalImagePath || image.tempImagePath!)}
            alt={image.generationPrompt}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => onOpenModal(image)}
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_SVG;
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal(image);
              }}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              title="View full size"
              aria-label="View full size"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onImageAction('delete', image.id);
              }}
              className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
              title="Delete"
              aria-label="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 p-3 gap-1.5">
        <div className="text-sm font-medium text-gray-900 line-clamp-1 min-h-0 flex-shrink" title={displayTitle}>
          {displayTitle}
        </div>
        <div className="text-xs text-gray-500 truncate flex-shrink-0" title={jobLabel}>
          {jobLabel}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 flex-shrink-0">
            {tags.slice(0, 2).map((tag: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 truncate max-w-[80px]"
                title={tag}
              >
                {tag.length > 6 ? `${tag.slice(0, 6)}…` : tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500 flex-shrink-0 mt-auto">
          <div className="flex items-center space-x-2 min-w-0">
            {image.seed != null && (
              <span className="font-mono truncate" title={`Seed: ${image.seed}`}>
                Seed: {image.seed}
              </span>
            )}
          </div>
          <div className="truncate flex-shrink-0" title={image.createdAt ? formatDate(new Date(image.createdAt as string | Date)) : ''}>
            {image.createdAt ? new Date(image.createdAt as string | Date).toLocaleDateString() : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

const ImageGalleryGrid: React.FC<ImageGalleryGridProps> = ({
  images,
  selectedImages,
  onImageSelect,
  jobIdToLabel,
  onOpenModal,
  onImageAction,
  formatDate,
  containerWidth = 0,
  containerHeight = 0,
  onLoadMore,
  hasMore = false,
}) => {
  const gridLayout = useMemo(() => {
    if (containerWidth <= 0 || containerHeight <= 0) return null;
    const contentWidth = containerWidth - 2 * PADDING;
    const columnCount = Math.min(
      MAX_COLUMNS,
      Math.max(1, Math.floor((contentWidth + GAP) / (MIN_COLUMN_WIDTH + GAP)))
    );
    const columnWidth = (contentWidth - (columnCount - 1) * GAP) / columnCount;
    const rowCount = Math.ceil(images.length / columnCount) || 1;
    const rowHeight = columnWidth + TEXT_BLOCK_HEIGHT;
    return { columnCount, columnWidth, rowCount, rowHeight };
  }, [containerWidth, containerHeight, images.length]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || !onLoadMore || !gridLayout) return;
      const { scrollTop, clientHeight } = e.currentTarget;
      const total = gridLayout.rowCount * (gridLayout.rowHeight + GAP);
      if (scrollTop + clientHeight >= total - 200) onLoadMore();
    },
    [hasMore, onLoadMore, gridLayout]
  );

  type CellProps = {
    images: ImageGalleryImage[];
    columnCount: number;
    selectedImages: Set<string>;
    onImageSelect: (imageId: string) => void;
    jobIdToLabel: Record<string, string>;
    onOpenModal: (image: ImageGalleryImage) => void;
    onImageAction: (action: string, imageId: string, data?: unknown) => void;
    formatDate: (date: Date) => string;
  };

  const cellProps: CellProps = useMemo(
    () => ({
      images,
      columnCount: gridLayout?.columnCount ?? 0,
      selectedImages,
      onImageSelect,
      jobIdToLabel,
      onOpenModal,
      onImageAction,
      formatDate,
    }),
    [images, gridLayout?.columnCount, selectedImages, onImageSelect, jobIdToLabel, onOpenModal, onImageAction, formatDate]
  );

  const CellComponent = useCallback(
    (props: {
      ariaAttributes: { 'aria-colindex': number; role: 'gridcell' };
      columnIndex: number;
      rowIndex: number;
      style: React.CSSProperties;
    } & CellProps) => {
      const { columnIndex, rowIndex, style, ariaAttributes, images: imgs, columnCount: cols, ...rest } = props;
      const index = rowIndex * cols + columnIndex;
      const image = imgs[index];
      const cellStyle = buildCellStyle(style);
      if (!image) return <div style={cellStyle} {...ariaAttributes} />;
      return (
        <div style={cellStyle} {...ariaAttributes}>
          <GalleryCard image={image} {...rest} selectedImages={rest.selectedImages} />
        </div>
      );
    },
    []
  );

  if (gridLayout && containerWidth > 0 && containerHeight > 0) {
    const colW = gridLayout.columnWidth + GAP;
    const rowH = gridLayout.rowHeight + GAP;
    const safeColW = Number.isNaN(colW) || colW <= 0 ? 200 : colW;
    const safeRowH = Number.isNaN(rowH) || rowH <= 0 ? 336 : rowH;
    return (
      <Grid<CellProps>
        cellComponent={CellComponent}
        cellProps={cellProps}
        columnCount={gridLayout.columnCount}
        columnWidth={safeColW}
        rowCount={gridLayout.rowCount}
        rowHeight={safeRowH}
        style={{ width: containerWidth, height: containerHeight, overflowX: 'hidden' }}
        onScroll={handleScroll}
      />
    );
  }

  if (containerWidth === 0 && containerHeight === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 min-h-[200px]" aria-live="polite">
        Loading gallery…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-4">
      {images.map((image) => (
        <GalleryCard
          key={image.id}
          image={image}
          selectedImages={selectedImages}
          onImageSelect={onImageSelect}
          jobIdToLabel={jobIdToLabel}
          onOpenModal={onOpenModal}
          onImageAction={onImageAction}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
};

export default ImageGalleryGrid;
