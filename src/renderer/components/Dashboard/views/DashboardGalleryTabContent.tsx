/**
 * Image Gallery tab content: filters + scrollable gallery. Extracted to keep DashboardView < 400 lines.
 * Filter UI lives only in DashboardGalleryFilters; this component just composes it with the gallery.
 */
import React from 'react';
import type { JobExecution } from '../hooks/useDashboardState';
import type { GeneratedImageWithStringId } from '../../../../types/generatedImage';
import DashboardGalleryFilters from '../components/DashboardGalleryFilters';
import ImageGalleryDefault from '../ImageGallery';

export interface DashboardGalleryTabContentProps {
  GalleryComponent?: React.ComponentType<React.ComponentProps<typeof ImageGalleryDefault>>;
  galleryScrollRef: React.RefObject<HTMLDivElement | null>;
  galleryContainerSize: { width: number; height: number };
  galleryLoadMoreRef: React.RefObject<HTMLDivElement | null>;
  filteredImageIds: string[];
  imageViewMode: 'grid' | 'list';
  setImageViewMode: (mode: 'grid' | 'list') => void;
  imageJobFilter: string;
  setImageJobFilter: (v: string) => void;
  imageSearchQuery: string;
  setImageSearchQuery: (v: string) => void;
  imageSortBy: 'newest' | 'oldest' | 'name';
  setImageSortBy: (v: 'newest' | 'oldest' | 'name') => void;
  imageDateFrom: string | null;
  setImageDateFrom: (v: string | null) => void;
  imageDateTo: string | null;
  setImageDateTo: (v: string | null) => void;
  selectedImages: Set<string>;
  setSelectedImages: (ids: Set<string>) => void;
  jobHistory: JobExecution[];
  generatedImages: GeneratedImageWithStringId[];
  setShowExportZipModal: (show: boolean) => void;
  onBulkDelete: (ids: string[]) => void;
  generatedImagesFiltered: GeneratedImageWithStringId[];
  onImageAction: (action: string, imageId: string, data?: unknown) => void;
  onBulkAction: (action: string, imageIds: string[]) => void;
  isLoading: boolean;
  galleryHasMore: boolean;
  onLoadMore?: () => void;
}

export const DashboardGalleryTabContent: React.FC<DashboardGalleryTabContentProps> = (props) => (
  <div className="flex flex-col h-full min-h-0">
    <div className="flex-shrink-0">
      <DashboardGalleryFilters
        imageViewMode={props.imageViewMode}
        setImageViewMode={props.setImageViewMode}
        imageJobFilter={props.imageJobFilter}
        setImageJobFilter={props.setImageJobFilter}
        imageSearchQuery={props.imageSearchQuery}
        setImageSearchQuery={props.setImageSearchQuery}
        imageSortBy={props.imageSortBy}
        setImageSortBy={props.setImageSortBy}
        imageDateFrom={props.imageDateFrom}
        setImageDateFrom={props.setImageDateFrom}
        imageDateTo={props.imageDateTo}
        setImageDateTo={props.setImageDateTo}
        selectedImages={props.selectedImages}
        setSelectedImages={props.setSelectedImages}
        filteredImagesCount={props.filteredImageIds.length}
        filteredImageIds={() => props.filteredImageIds}
        jobHistory={props.jobHistory}
        generatedImages={props.generatedImages}
        setShowExportModal={props.setShowExportZipModal}
        onDeleteSelected={props.onBulkDelete}
      />
    </div>
    <div
      ref={props.galleryScrollRef}
      className="overflow-y-auto overflow-x-hidden px-6 pb-6"
      style={{ height: '60vh', minHeight: 320 }}
    >
      {(() => {
        const Gallery = props.GalleryComponent ?? ImageGalleryDefault;
        const jobIdToLabel: Record<string, string> = Object.fromEntries(
          (props.jobHistory ?? []).map((j) => {
            const label =
              (j as { displayLabel?: string }).displayLabel ??
              (j as { label?: string }).label ??
              (j as JobExecution & { configurationName?: string }).configurationName ??
              `Job ${j.id}`;
            return [String(j.id), String(label).trim() || `Job ${j.id}`];
          })
        );
        return (
          <Gallery
            images={props.generatedImagesFiltered}
            onImageAction={props.onImageAction}
            onBulkAction={props.onBulkAction}
            viewMode={props.imageViewMode}
            onViewModeChange={props.setImageViewMode}
            isLoading={props.isLoading}
            selectedIds={props.selectedImages}
            onSelectionChange={props.setSelectedImages}
            jobIdToLabel={jobIdToLabel}
            containerWidth={props.galleryContainerSize.width}
            containerHeight={props.galleryContainerSize.height}
            onLoadMore={props.galleryHasMore ? props.onLoadMore : undefined}
            hasMore={props.galleryHasMore}
          />
        );
      })()}
      {props.galleryHasMore && (
        <div ref={props.galleryLoadMoreRef} className="h-4 flex-shrink-0" aria-hidden="true" />
      )}
    </div>
  </div>
);
