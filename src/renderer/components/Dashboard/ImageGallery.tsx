import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';
import ImageModal from './ImageModal';

// Excel export configuration
const EXCEL_COLUMN_WIDTHS = [
  { wch: 5 },   // Row
  { wch: 15 },  // Image ID
  { wch: 15 },  // Job Execution ID
  { wch: 25 },  // File Name
  { wch: 40 },  // File Path
  { wch: 12 },  // QC Status
  { wch: 30 },  // QC Reason
  { wch: 50 },  // Generation Prompt
  { wch: 12 },  // Seed
  { wch: 20 },  // Created At
  { wch: 30 },  // AI Title
  { wch: 50 },  // AI Description
  { wch: 40 },  // AI Tags
  { wch: 15 },  // Image Enhancement
  { wch: 15 },  // Sharpening Level
  { wch: 15 },  // Saturation Level
  { wch: 12 },  // Image Convert
  { wch: 12 },  // Convert to JPG
  { wch: 12 },  // JPG Quality
  { wch: 12 },  // PNG Quality
  { wch: 15 },  // Remove Background
  { wch: 15 },  // Remove BG Size
  { wch: 15 },  // Trim Transparent
  { wch: 15 }   // JPG Background
];

interface ImageGalleryProps {
  images: GeneratedImage[];
  onImageAction: (action: string, imageId: string, data?: any) => void;
  onBulkAction?: (action: string, imageIds: string[]) => void;
  isLoading: boolean;
  jobStatus?: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  jobFilter?: string;
  searchQuery?: string;
  sortBy?: 'newest' | 'oldest' | 'name';
  jobIdToLabel?: Record<string, string>;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onImageAction,
  onBulkAction,
  isLoading,
  jobStatus = 'idle',
  viewMode = 'grid',
  onViewModeChange,
  jobFilter = 'all',
  searchQuery = '',
  sortBy = 'newest',
  jobIdToLabel = {}
}) => {
  // Safety check for images prop
  if (!images || !Array.isArray(images)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          {isLoading ? 'Loading images...' : 'No images available'}
        </div>
      </div>
    );
  }
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Safely parse metadata which may be stored as a JSON string
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

  // Clear selection when job filter changes
  React.useEffect(() => {
    setSelectedImages(new Set());
  }, [jobFilter]);

  // Get unique job IDs for filtering
  const uniqueJobIds = Array.from(new Set((images || []).map(img => img.executionId)));

  const filteredAndSortedImages = React.useMemo(() => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
    

    
    let filtered = images.filter(image => {
      // Job filter
      if (jobFilter !== 'all' && image.executionId != jobFilter) {
        return false;
      }
      
      // Search filter - search in generation prompt, metadata prompt, title, description, and tags
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const meta = parseMetadata(image.metadata);
        
        // Search in generation prompt
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        
        // Search in metadata prompt
        const metaPrompt = typeof meta?.prompt === 'string' ? meta.prompt.toLowerCase() : '';
        const matchesMetadataPrompt = metaPrompt.includes(query);
        
        // Search in metadata title (supports both string and object with 'en' property)
        const title = typeof meta?.title === 'string' ? meta.title : meta?.title?.en || '';
        const matchesTitle = title.toLowerCase().includes(query);
        
        // Search in metadata description (supports both string and object with 'en' property)
        const description = typeof meta?.description === 'string' ? meta.description : meta?.description?.en || '';
        const matchesDescription = description.toLowerCase().includes(query);
        
        // Search in metadata tags (array of strings)
        const tags = Array.isArray(meta?.tags) ? meta.tags.join(' ').toLowerCase() : '';
        const matchesTags = tags.includes(query);
        
        if (!matchesPrompt && !matchesMetadataPrompt && !matchesTitle && !matchesDescription && !matchesTags) {
          return false;
        }
      }
      
      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.createdAt ? new Date(b.createdAt as any).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        case 'oldest':
          return (a.createdAt ? new Date(a.createdAt as any).getTime() : 0) - (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [images, jobFilter, searchQuery, sortBy]);

  // Note: QC status functions removed since we only show success images in main dashboard

  const handleImageSelect = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === filteredAndSortedImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredAndSortedImages.map(img => img.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedImages.size === 0) return;
    
    // Handle actions for success images (only delete supported)
    selectedImages.forEach(imageId => {
      onImageAction(action, imageId);
    });
    setSelectedImages(new Set());
  };

  // Note: QC status changes are handled in the separate Failed Images Review page

  // Handle QC status changes for individual images
  const handleQCStatusChange = (imageId: string, newStatus: string) => {
    onImageAction('update-qc-status', imageId, newStatus);
  };

  // Helper function to transform image data for Excel export
  const transformImageForExport = (image: GeneratedImage, index: number) => {
    const processingSettings = image.processingSettings || {};
    const metadata = image.metadata || {};
    
    return {
      'Row': index + 1,
      'Image ID': image.id,
      'Job Execution ID': image.executionId,
      'File Name': image.finalImagePath ? image.finalImagePath.split('/').pop() : 'N/A',
      'File Path': image.finalImagePath || 'N/A',
      'QC Status': image.qcStatus || 'pending',
      'QC Reason': image.qcReason || '',
      'Generation Prompt': image.generationPrompt || '',
      'Seed': image.seed || 'N/A',
      'Created At': image.createdAt ? new Date(image.createdAt).toLocaleString() : 'N/A',
      
      // AI-Generated Metadata
      'AI Title': metadata.title || '',
      'AI Description': metadata.description || '',
      'AI Tags': Array.isArray(metadata.tags) ? metadata.tags.join(', ') : (metadata.tags || ''),
      
      // Processing Settings
      'Image Enhancement': processingSettings.imageEnhancement ? 'Yes' : 'No',
      'Sharpening Level': processingSettings.sharpening || 0,
      'Saturation Level': processingSettings.saturation || 1,
      'Image Convert': processingSettings.imageConvert ? 'Yes' : 'No',
      'Convert to JPG': processingSettings.convertToJpg ? 'Yes' : 'No',
      'JPG Quality': processingSettings.jpgQuality || 'N/A',
      'PNG Quality': processingSettings.pngQuality || 'N/A',
      'Remove Background': processingSettings.removeBg ? 'Yes' : 'No',
      'Remove BG Size': processingSettings.removeBgSize || 'N/A',
      'Trim Transparent': processingSettings.trimTransparentBackground ? 'Yes' : 'No',
      'JPG Background': processingSettings.jpgBackground || 'N/A'
    };
  };

  const handleExcelExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Determine which images to export
      const imagesToExport = selectedImages.size === 0 
        ? filteredAndSortedImages 
        : Array.from(selectedImages)
            .map(id => images.find(img => img.id === id))
            .filter((img): img is GeneratedImage => img !== undefined);

      if (imagesToExport.length === 0) {
        setExportError('No images to export');
        return;
      }

      // Prepare Excel data with comprehensive metadata
      const excelData = imagesToExport.map(transformImageForExport);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      const columnWidths = EXCEL_COLUMN_WIDTHS;
      ws['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Generated Images');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `generated-images-export-${timestamp}.xlsx`;

      // Write and download file
      XLSX.writeFile(wb, filename);

      // Show success feedback (following the pattern from other components)
      console.log(`Excel export completed: ${imagesToExport.length} images exported to ${filename}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Excel export failed:', error);
      setExportError(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  // Modal navigation functions
  const handleModalNavigation = (direction: 'next' | 'previous') => {
    if (!showImageModal) return;
    
    const currentIndex = filteredAndSortedImages.findIndex(img => img.id === showImageModal);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex + 1 < filteredAndSortedImages.length ? currentIndex + 1 : currentIndex;
    } else {
      newIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : currentIndex;
    }
    
    setShowImageModal(filteredAndSortedImages[newIndex].id);
  };

  const getModalNavigationProps = () => {
    if (!showImageModal) return { hasPrevious: false, hasNext: false };
    
    const currentIndex = filteredAndSortedImages.findIndex(img => img.id === showImageModal);
    return {
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < filteredAndSortedImages.length - 1
    };
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Image Grid/List - SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No images found matching the current filters.
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-4">
                {filteredAndSortedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative bg-white border rounded-lg overflow-hidden transition-colors ${
                      selectedImages.has(image.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                  {/* Selection Checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedImages.has(image.id)}
                      onChange={() => handleImageSelect(image.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Select ${image.generationPrompt}`}
                    />
                  </div>

                  {/* Image */}
                  <div className="relative aspect-square">
                    {(image.finalImagePath || image.tempImagePath) ? (
                      <img
                        src={`local-file://${image.finalImagePath || image.tempImagePath}`}
                        alt={image.generationPrompt}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setShowImageModal(image.id)}
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0Oi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xOSAzSDVDMy45IDMgMyAzLjkgMyA1VjE5QzMgMjAuMSAzLjkgMjEgNSAyMUgxOUMyMC4xIDIxIDIxIDIwLjEgMjEgMTlWNUMxMSAzLjkgMjAuMSAzIDE5IDNaTTE5IDE5SDVWNUgxOVYxOVoiIGZpbGw9IiM5QjlCQTAiLz4KPHBhdGggZD0iTTE0IDEzSDEwVjE3SDE0VjEzWiIgZmlsbD0iI0QxRDVEM0EiLz4KPC9zdmc+Cjwvc3ZnPgo=';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Note: QC status badge removed in dashboard success-only view */}

                    {/* Quick Actions Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowImageModal(image.id);
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

                  {/* Enhanced Image Info */}
                  <div className="p-3 space-y-2">
                    {(() => {
                      const meta = parseMetadata(image.metadata);
                      const titleVal = (meta?.title && typeof meta.title === 'object' ? meta.title.en : meta?.title) || '';
                      const displayTitle = (typeof titleVal === 'string' && titleVal.trim()) ? titleVal : (image.generationPrompt || 'Untitled');
                      const jobLabel = (jobIdToLabel && jobIdToLabel[String(image.executionId)]) || `Job ${String(image.executionId)}`;
                      return (
                        <div>
                          <div className="text-sm font-medium text-gray-900 line-clamp-2" title={displayTitle}>
                            {displayTitle}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-1" title={jobLabel}>
                            {jobLabel}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1" title={image.createdAt ? formatDate(image.createdAt as any) : ''}>
                            {image.createdAt ? new Date(image.createdAt as any).toLocaleDateString() : ''}
                          </div>
                        </div>
                      );
                    })()}



                    {/* AI Tags (if available) */}
                    {image.metadata?.tags && Array.isArray(image.metadata.tags) && image.metadata.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {image.metadata.tags.slice(0, 3).map((tag: string, index: number) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            title={tag}
                          >
                            {tag.length > 8 ? `${tag.slice(0, 8)}...` : tag}
                          </span>
                        ))}
                        {image.metadata.tags.length > 3 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            +{image.metadata.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Seed and Creation Date */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                      <div className="flex items-center space-x-2">
                        {image.seed && (
                          <span className="font-mono" title={`Seed: ${image.seed}`}>
                            Seed: {image.seed}
                          </span>
                        )}
                      </div>
                      <div title={formatDate(image.createdAt)}>
                        {new Date(image.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Note: QC Status controls removed since we only show success images */}
                  </div>
                </div>
              ))}

              {/* Note: Sample images removed since they're not needed for production */}
            </div>
            ) : (
              /* List View */
              <div className="p-4">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Table Header */}
                  <div className="bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={selectedImages.size === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedImages(new Set(filteredAndSortedImages.map(img => img.id)));
                            } else {
                              setSelectedImages(new Set());
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </div>
                      <div className="col-span-2">Image</div>
                      <div className="col-span-2">Title</div>
                      <div className="col-span-3">Prompt</div>
                      <div className="col-span-1">Seed</div>
                      <div className="col-span-1">Date</div>
                      <div className="col-span-2">Actions</div>
                    </div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="divide-y divide-gray-200">
                    {filteredAndSortedImages.map((image) => (
                      <div
                        key={image.id}
                        className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                          selectedImages.has(image.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="col-span-1 flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedImages.has(image.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedImages);
                              if (e.target.checked) {
                                newSelected.add(image.id);
                              } else {
                                newSelected.delete(image.id);
                              }
                              setSelectedImages(newSelected);
                            }}
                            className="rounded border-gray-300"
                          />
                        </div>
                        
                        {/* Image Thumbnail */}
                        <div className="col-span-2">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={(image.finalImagePath || image.tempImagePath) ? `local-file://${image.finalImagePath || image.tempImagePath}` : ''}
                              alt={() => {
                                const meta = parseMetadata(image.metadata);
                                const t = (meta?.title && typeof meta.title === 'object' ? meta.title.en : meta?.title) || 'Generated Image';
                                return typeof t === 'string' ? t : 'Generated Image';
                              }}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setShowImageModal(image.id)}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+';
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Title (prefer metadata.title (object or string), fallback to prompt) */}
                        <div className="col-span-2 flex items-center">
                          <div className="truncate">
                            {(() => {
                              const meta = parseMetadata(image.metadata);
                              const title = (meta?.title && typeof meta.title === 'object' ? meta.title.en : meta?.title) || '';
                              const safeTitle = typeof title === 'string' && title.trim() ? title : '';
                              const displayTitle = safeTitle || image.generationPrompt || 'Untitled';
                              return (
                                <div className="text-sm font-medium text-gray-900 truncate" title={displayTitle}>
                                  {displayTitle}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        
                        {/* Job */}
                        <div className="col-span-3 flex items-center">
                          {(() => {
                            const jobLabel = (jobIdToLabel && jobIdToLabel[String(image.executionId)]) || `Job ${String(image.executionId)}`;
                            return (
                              <div className="text-sm text-gray-700 truncate" title={jobLabel}>
                                {jobLabel}
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Seed */}
                        <div className="col-span-1 flex items-center">
                          <div className="text-sm font-mono text-gray-500" title={`Seed: ${image.seed}`}>
                            {image.seed}
                          </div>
                        </div>
                        
                        {/* Date */}
                        <div className="col-span-1 flex items-center">
                          <div className="text-sm text-gray-500" title={image.createdAt ? formatDate(image.createdAt as any) : ''}>
                            {image.createdAt ? new Date(image.createdAt as any).toLocaleDateString() : ''}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="col-span-2 flex items-center space-x-2">
                          <button
                            onClick={() => setShowImageModal(image.id)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="View full size"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onImageAction('delete', image.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Note: Retry settings modal removed since it's not needed for success images */}

      {/* Image Modal */}
      <ImageModal
        image={showImageModal ? images.find(img => img.id === showImageModal) || null : null}
        isOpen={!!showImageModal}
        onClose={() => setShowImageModal(null)}
        onNext={() => handleModalNavigation('next')}
        onPrevious={() => handleModalNavigation('previous')}
        {...getModalNavigationProps()}
      />
    </div>
  );
};

export default ImageGallery;
