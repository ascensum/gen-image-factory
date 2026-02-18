/**
 * Virtualized grid for Failed Images Review (same pattern as ImageGalleryGrid).
 * Uses react-window Grid when containerWidth/Height are provided.
 */
import React, { useCallback, useMemo } from 'react';
import { Grid } from 'react-window';
import FailedImageCard from '../FailedImageCard';
import type { GeneratedImage } from '../../../../types/generatedImage';

const GAP = 16;
const PADDING = 16;
const TEXT_BLOCK_HEIGHT = 120;
const MIN_COLUMN_WIDTH = 260;
const MAX_COLUMNS = 4;

function toStyleNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

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
  if (style.left !== undefined && style.left !== null) out.left = left;
  if ('top' in style) {
    const t = (style as Record<string, unknown>).top;
    const topVal = toStyleNum(t);
    if (Number.isFinite(topVal)) out.top = topVal;
  }
  return out;
}

export interface FailedImageGridProps {
  images: GeneratedImage[];
  selectedIds: Set<string>;
  onSelect: (imageId: string) => void;
  onAction: (action: string, imageId: string) => void;
  jobIdToLabel: Record<string, string>;
  containerWidth?: number;
  containerHeight?: number;
}

const FailedImageGrid: React.FC<FailedImageGridProps> = ({
  images,
  selectedIds,
  onSelect,
  onAction,
  jobIdToLabel,
  containerWidth = 0,
  containerHeight = 0,
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

  type CellProps = {
    images: GeneratedImage[];
    columnCount: number;
    selectedIds: Set<string>;
    onSelect: (imageId: string) => void;
    onAction: (action: string, imageId: string) => void;
    jobIdToLabel: Record<string, string>;
  };

  const cellProps: CellProps = useMemo(
    () => ({
      images,
      columnCount: gridLayout?.columnCount ?? 0,
      selectedIds,
      onSelect,
      onAction,
      jobIdToLabel,
    }),
    [images, gridLayout?.columnCount, selectedIds, onSelect, onAction, jobIdToLabel]
  );

  const CellComponent = useCallback(
    (props: {
      ariaAttributes: { 'aria-colindex': number; role: 'gridcell' };
      columnIndex: number;
      rowIndex: number;
      style: React.CSSProperties;
    } & CellProps) => {
      const { columnIndex, rowIndex, style, ariaAttributes, images: imgs, columnCount: cols, selectedIds: sel, onSelect: selFn, onAction: actFn, jobIdToLabel: j2l } = props;
      const index = rowIndex * cols + columnIndex;
      const image = imgs[index];
      const cellStyle = buildCellStyle(style);
      if (!image) return <div style={cellStyle} {...ariaAttributes} />;
      const jobLabel = j2l[String(image.executionId)] || `Job ${image.executionId}`;
      return (
        <div style={{ ...cellStyle, overflow: 'hidden' }} {...ariaAttributes}>
          <FailedImageCard
            image={image}
            isSelected={sel.has(String(image.id))}
            onSelect={() => selFn(String(image.id))}
            onAction={actFn}
            jobLabel={jobLabel}
          />
        </div>
      );
    },
    []
  );

  if (gridLayout && containerWidth > 0 && containerHeight > 0) {
    const colW = gridLayout.columnWidth + GAP;
    const rowH = gridLayout.rowHeight + GAP;
    const safeColW = Number.isNaN(colW) || colW <= 0 ? 200 : colW;
    const safeRowH = Number.isNaN(rowH) || rowH <= 0 ? 340 : rowH;
    const height =
      typeof window !== 'undefined'
        ? Math.min(containerHeight, window.innerHeight * 0.75)
        : containerHeight;
    return (
      <Grid<CellProps>
        cellComponent={CellComponent}
        cellProps={cellProps}
        columnCount={gridLayout.columnCount}
        columnWidth={safeColW}
        rowCount={gridLayout.rowCount}
        rowHeight={safeRowH}
        className="overflow-x-hidden overflow-y-scroll"
        style={{
          width: containerWidth,
          height,
          maxHeight: height,
          overflowX: 'hidden',
          overflowY: 'scroll',
        }}
      />
    );
  }

  if (containerWidth === 0 && containerHeight === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 min-h-[200px]" aria-live="polite">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <FailedImageCard
          key={image.id}
          image={image}
          isSelected={selectedIds.has(String(image.id))}
          onSelect={() => onSelect(String(image.id))}
          onAction={onAction}
          jobLabel={jobIdToLabel[String(image.executionId)] || `Job ${image.executionId}`}
        />
      ))}
    </div>
  );
};

export default FailedImageGrid;
