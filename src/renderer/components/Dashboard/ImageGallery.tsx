import React, { useState } from 'react';
import { GeneratedImage } from './DashboardPanel';
import QuickActions from './QuickActions';

interface ImageGalleryProps {
  images: GeneratedImage[];
  onImageAction: (action: string, imageId: string, data?: any) => void;
  onBulkAction?: (action: string, imageIds: string[]) => void;
  onQCStatusChange?: (imageId: string, status: string) => void;
  isLoading: boolean;
  jobStatus?: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onImageAction,
  onBulkAction,
  onQCStatusChange,
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
  const [filterQC, setFilterQC] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterJob, setFilterJob] = useState<string | number>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'status'>('newest');
  const [showImageModal, setShowImageModal] = useState<string | null>(null);

  // Get unique job IDs for filtering
  const uniqueJobIds = Array.from(new Set((images || []).map(img => img.executionId)));

  const filteredAndSortedImages = React.useMemo(() => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
    
    let filtered = images.filter(image => {
      // QC Status filter
      if (filterQC !== 'all' && image.qcStatus !== filterQC) {
        return false;
      }
      
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
        case 'status':
          return a.qcStatus.localeCompare(b.qcStatus);
        default:
          return 0;
      }
    });

    return sorted;
  }, [images, filterQC, filterJob, searchQuery, sortBy]);

  const getQCStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getQCStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'pending':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

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
    
    if (action === 'reject') {
      // Handle reject action by updating QC status
      selectedImages.forEach(imageId => {
        if (onQCStatusChange) {
          onQCStatusChange(imageId, 'rejected');
        } else {
          onImageAction('updateQC', imageId, { status: 'rejected' });
        }
      });
    } else {
      // Handle other actions normally
      selectedImages.forEach(imageId => {
        onImageAction(action, imageId);
      });
    }
    setSelectedImages(new Set());
  };

  const handleQCStatusChange = (imageId: string, newStatus: string) => {
    if (onQCStatusChange) {
      onQCStatusChange(imageId, newStatus);
    } else {
      onImageAction('updateQC', imageId, { status: newStatus });
    }
  };

  const handleExport = () => {
    if (selectedImages.size === 0) {
      // Export all filtered images
      const imagesToExport = filteredAndSortedImages;
      onImageAction('export', 'bulk', { 
        images: imagesToExport, 
        includeMetadata: true,
        format: 'zip' 
      });
    } else {
      // Export selected images
      const imagesToExport = Array.from(selectedImages).map(id => 
        images.find(img => img.id === id)
      ).filter(Boolean);
      onImageAction('export', 'selected', { 
        images: imagesToExport, 
        includeMetadata: true,
        format: 'zip' 
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with Quick Actions - STATIC (non-scrollable) */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Generated Images</h2>
        <QuickActions
          jobStatus={jobStatus}
          onJobAction={(action, jobId) => onImageAction(action, jobId)}
          onImageAction={onImageAction}
          isLoading={isLoading}
        />
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
              {images.filter(img => img.qcStatus === 'approved').length} Pass
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              {images.filter(img => img.qcStatus === 'rejected').length} Fail
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-700">
              {images.filter(img => img.qcStatus === 'pending').length} Pending
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Controls - STATIC (non-scrollable) */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4 flex-shrink-0">
        <div className="flex items-center space-x-4">
          {/* QC Status Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">QC Status:</span>
            <select
              value={filterQC}
              onChange={(e) => setFilterQC(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending ({images.filter(img => img.qcStatus === 'pending').length})</option>
              <option value="approved">Approved ({images.filter(img => img.qcStatus === 'approved').length})</option>
              <option value="rejected">Rejected ({images.filter(img => img.qcStatus === 'rejected').length})</option>
            </select>
          </div>

          {/* Job Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Job:</span>
            <select
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
              <option value="status">By Status</option>
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
              <button
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Reject Selected
              </button>
            </div>
          )}

          {/* Clear Button */}
          <button
            onClick={() => {
              setFilterQC('all');
              setFilterJob('all');
              setSearchQuery('');
              setSortBy('newest');
              setSelectedImages(new Set());
            }}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Export
          </button>
        </div>
      </div>

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
                    
                    {/* QC Status Badge */}
                    <div className="absolute top-2 right-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getQCStatusColor(image.qcStatus)}`}>
                        {getQCStatusIcon(image.qcStatus)}
                        <span className="ml-1">{image.qcStatus}</span>
                      </span>
                    </div>

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

                  {/* Image Info */}
                  <div className="p-3">
                    <div className="text-xs text-gray-600 truncate">{image.generationPrompt}</div>
                    <div className="text-xs text-gray-500">{formatDate(image.createdAt)}</div>
                    
                    {/* QC Status Dropdown */}
                    <select
                      value={image.qcStatus}
                      onChange={(e) => handleQCStatusChange(image.id, e.target.value)}
                      className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              ))}

              {/* Add sample images if we have fewer than 10 real images to demonstrate scrolling */}
              {filteredAndSortedImages.length < 10 && (
                <>
                  <div className="text-xs text-gray-500 text-center py-2 border-b border-gray-200 mb-4 col-span-full">
                    📜 Sample images to demonstrate scrolling behavior
                  </div>
                  {Array.from({ length: 20 }, (_, index) => (
                    <div
                      key={`sample-${index}`}
                      className="relative bg-white border rounded-lg overflow-hidden transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    >
                      {/* Sample Image */}
                      <div className="relative aspect-square">
                        <img
                          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo="
                          alt={`Sample image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Sample QC Status Badge */}
                        <div className="absolute top-2 right-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            pending
                          </span>
                        </div>
                      </div>

                      {/* Sample Image Info */}
                      <div className="p-3">
                        <div className="text-xs text-gray-600 truncate">Sample AI generated image {index + 1}</div>
                        <div className="text-xs text-gray-500">Aug 9, 2025</div>
                        
                        {/* Sample QC Status Dropdown */}
                        <select
                          defaultValue="pending"
                          className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowImageModal(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {showImageModal && (
              <div className="bg-white rounded-lg overflow-hidden">
                <img
                  src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo="
                  alt="Full size image"
                  className="max-w-full max-h-[80vh] object-contain"
                />
                <div className="p-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Image Details</h2>
                  <h3 className="text-lg font-medium text-gray-900">
                    {images.find(img => img.id === showImageModal)?.generationPrompt}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Created: {images.find(img => img.id === showImageModal) && formatDate(images.find(img => img.id === showImageModal)!.createdAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
