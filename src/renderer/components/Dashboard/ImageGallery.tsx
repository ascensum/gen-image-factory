import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { GeneratedImage } from './DashboardPanel';
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
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onImageAction,
  onBulkAction,
  isLoading,
  jobStatus = 'idle'
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
  const [filterJob, setFilterJob] = useState<string | number>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Clear selection when job filter changes
  React.useEffect(() => {
    setSelectedImages(new Set());
  }, [filterJob]);

  // Get unique job IDs for filtering
  const uniqueJobIds = Array.from(new Set((images || []).map(img => img.executionId)));

  const filteredAndSortedImages = React.useMemo(() => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
    
    let filtered = images.filter(image => {
      // Job filter
      if (filterJob !== 'all' && image.executionId !== filterJob) {
        return false;
      }
      
      // Search filter - search in generation prompt and metadata prompt
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        const matchesMetadataPrompt = image.metadata?.prompt?.toLowerCase().includes(query);
        if (!matchesPrompt && !matchesMetadataPrompt) {
          return false;
        }
      }
      
      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [images, filterJob, searchQuery, sortBy]);

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
      {/* Header - STATIC (non-scrollable) */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Generated Images</h2>
      </div>

      {/* Image Count Indicators - STATIC (non-scrollable) */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4 flex-shrink-0">
        <div className="text-sm font-medium text-gray-700">
          {images.length} Total Images
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              {images.length} Success Images
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Controls - STATIC (non-scrollable) */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4 flex-shrink-0">
        <div className="flex items-center space-x-4">
          {/* Note: QC Status Filter removed since we only show success images */}

          {/* Job Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Job:</span>
            <select
              aria-label="Job"
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Jobs</option>
              {uniqueJobIds.length > 0 ? uniqueJobIds.map(jobId => (
                <option key={jobId} value={jobId}>
                  Job {String(jobId).slice(0, 8)}...
                </option>
              )) : (
                <option value="all" disabled>No jobs available</option>
              )}
            </select>
          </div>

          {/* Search Field */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Search:</span>
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sort Control */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">By Name</option>
            </select>
          </div>

          {/* View Mode */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid view"
              aria-label="Grid view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="List view"
              aria-label="List view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action Buttons - STATIC (non-scrollable) */}
        <div className="flex items-center space-x-2">
          {/* Select All Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              aria-label="Select all images"
              checked={selectedImages.size === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Select All ({selectedImages.size}/{filteredAndSortedImages.length})
            </span>
          </div>

          {/* Bulk Actions */}
          {selectedImages.size > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          )}

          {/* Clear Button */}
          <button
            onClick={() => {
              setFilterJob('all');
              setSearchQuery('');
              setSortBy('newest');
              setSelectedImages(new Set());
            }}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear
          </button>

          {/* Excel Export Button */}
          <button
            onClick={handleExcelExport}
            disabled={isExporting || filteredAndSortedImages.length === 0}
            className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center space-x-1 ${
              isExporting || filteredAndSortedImages.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            title={selectedImages.size > 0 
              ? `Export ${selectedImages.size} selected images to Excel` 
              : `Export ${filteredAndSortedImages.length} images to Excel`}
            aria-label={selectedImages.size > 0 
              ? `Export ${selectedImages.size} selected images to Excel` 
              : `Export ${filteredAndSortedImages.length} images to Excel`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Error Display */}
      {exportError && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-800">{exportError}</span>
            <button
              onClick={() => setExportError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Image Grid/List - SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No images found matching the current filters.
          </div>
        ) : (
          <>
            {/* Show real images first */}
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-2'}>
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
                    <img
                      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo="
                      alt={image.generationPrompt}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setShowImageModal(image.id)}
                    />
                    
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
                            handleQCStatusChange(image.id, 'approved');
                          }}
                          className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700"
                          title="Approve"
                          aria-label="Approve"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQCStatusChange(image.id, 'rejected');
                          }}
                          className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                          title="Reject"
                          aria-label="Reject"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onImageAction('delete', image.id);
                          }}
                          className="p-2 bg-gray-600 text-white rounded-full hover:bg-gray-700"
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
                    {/* AI-Generated Title (Primary) */}
                    {image.metadata?.title ? (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 truncate" title={image.metadata.title}>
                          {image.metadata.title}
                        </h4>
                        <div className="text-xs text-gray-500 truncate mt-1" title={image.generationPrompt}>
                          {image.generationPrompt}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600 truncate" title={image.generationPrompt}>
                        {image.generationPrompt}
                      </div>
                    )}

                    {/* Processing Settings Indicators */}
                    {image.processingSettings && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {image.processingSettings.imageEnhancement && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Image Enhancement Applied">
                            ✨ Enhanced
                          </span>
                        )}
                        {image.processingSettings.removeBg && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Background Removed">
                            🖼️ No BG
                          </span>
                        )}
                        {image.processingSettings.convertToJpg && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Converted to JPG">
                            📄 JPG
                          </span>
                        )}
                        {image.processingSettings.sharpening && image.processingSettings.sharpening > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title={`Sharpening: ${image.processingSettings.sharpening}`}>
                            🔍 Sharp
                          </span>
                        )}
                      </div>
                    )}

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
                            🎲 {image.seed}
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
