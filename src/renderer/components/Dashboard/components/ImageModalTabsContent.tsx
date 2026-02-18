/**
 * Story 3.4 Phase 5c: ImageModal right panel – tab nav + Details / Metadata / Processing content.
 * Extracted from ImageModal.tsx.
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../types/generatedImage';

export type ImageModalTabType = 'details' | 'metadata' | 'processing';

const TAB_CONFIG: Record<ImageModalTabType, { label: string; id: ImageModalTabType }> = {
  details: { label: 'Details', id: 'details' },
  metadata: { label: 'AI Metadata', id: 'metadata' },
  processing: { label: 'Processing', id: 'processing' },
};

export interface ImageModalMetadataMeta {
  title?: string | { en?: string; [key: string]: string | undefined };
  description?: string | { en?: string; [key: string]: string | undefined };
  uploadTags?: { en?: string };
  tags?: string[] | string;
}

export interface ImageModalTabsContentProps {
  image: GeneratedImage;
  metadata: ImageModalMetadataMeta;
  processingSettings: Record<string, unknown>;
  activeTab: ImageModalTabType;
  onTabChange: (tab: ImageModalTabType) => void;
  formatDate: (date: string | Date) => string;
}

const ImageModalTabsContent: React.FC<ImageModalTabsContentProps> = ({
  image,
  metadata,
  processingSettings,
  activeTab,
  onTabChange,
  formatDate,
}) => (
  <div className="w-1/2 xl:w-96 border-l border-gray-200 flex flex-col h-full overflow-hidden xl:min-w-[384px]">
    <div className="flex border-b border-gray-200">
      {(Object.values(TAB_CONFIG) as { label: string; id: ImageModalTabType }[]).map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
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
            <div className="flex flex-wrap items-start gap-2 whitespace-normal">
              <StatusBadge variant="qc" status={image.qcStatus || 'approved'} />
              {image.qcReason && (
                <span className="text-sm text-gray-600 break-words whitespace-pre-wrap flex-1 min-w-0">- {image.qcReason}</span>
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

      {activeTab === 'metadata' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">AI-Generated Metadata</h3>
            <button
              onClick={async () => {
                try {
                  const api = (window as { electronAPI?: { generatedImages?: { getGeneratedImage?: (id: string) => Promise<{ success?: boolean }> } } }).electronAPI;
                  if (!api?.generatedImages?.getGeneratedImage) return;
                  const refreshedImage = await api.generatedImages.getGeneratedImage(image.id);
                  if (refreshedImage?.success) console.log(' Metadata refreshed. Close and reopen the modal to see changes.');
                } catch (error) {
                  console.error(' Failed to refresh metadata:', error);
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
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
                let tagsArray: string[] = [];
                if (metadata.uploadTags?.en) {
                  tagsArray = String(metadata.uploadTags.en).split(',').map((tag: string) => tag.trim()).filter(Boolean);
                } else if (Array.isArray(metadata.tags)) {
                  tagsArray = metadata.tags as string[];
                } else if (typeof metadata.tags === 'string' && (metadata.tags as string).trim()) {
                  tagsArray = (metadata.tags as string).split(',').map((tag: string) => tag.trim()).filter(Boolean);
                }
                if (tagsArray.length > 0) {
                  return (
                    <div className="flex flex-wrap gap-2">
                      {tagsArray.map((tag: string, index: number) => (
                        <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{tag}</span>
                      ))}
                    </div>
                  );
                }
                return <p className="text-sm text-gray-500">No tags generated</p>;
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'processing' && (
        <div className="space-y-4">
          <div className="text-base font-medium text-gray-900">As‑run settings</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image Enhancement</label>
              <p className="text-sm text-gray-900">{processingSettings.imageEnhancement ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sharpening</label>
              <p className="text-sm text-gray-900">
                {processingSettings.imageEnhancement ? String(Number(processingSettings.sharpening ?? 0)) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saturation</label>
              <p className="text-sm text-gray-900">
                {processingSettings.imageEnhancement ? String(Number(processingSettings.saturation ?? 1.4)) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image Convert</label>
              <p className="text-sm text-gray-900">{processingSettings.imageConvert ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Convert Format</label>
              <p className="text-sm text-gray-900">
                {processingSettings.imageConvert
                  ? (Boolean(processingSettings.convertToWebp) ? 'WEBP' : (Boolean(processingSettings.convertToJpg) ? 'JPG' : 'PNG'))
                  : <span className="text-gray-500 italic">Not applied (Image Convert OFF)</span>}
              </p>
            </div>
            {Boolean(processingSettings.imageConvert && processingSettings.convertToJpg) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JPG Quality</label>
                <p className="text-sm text-gray-900">{String(Number(processingSettings.jpgQuality ?? 85))}</p>
              </div>
            )}
            {Boolean(processingSettings.imageConvert && processingSettings.convertToWebp) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WebP Quality</label>
                <p className="text-sm text-gray-900">{String(Number(processingSettings.webpQuality ?? 85))}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remove Background</label>
              <p className="text-sm text-gray-900">{processingSettings.removeBg ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remove.bg Size</label>
              <p className="text-sm text-gray-900">
                {processingSettings.removeBg ? String(processingSettings.removeBgSize || 'auto') : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trim Transparent</label>
              <p className="text-sm text-gray-900">
                {processingSettings.removeBg ? (processingSettings.trimTransparentBackground ? 'Yes' : 'No') : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JPG Background Colour</label>
              <p className="text-sm text-gray-900">
                {processingSettings.imageConvert && processingSettings.convertToJpg && processingSettings.removeBg ? String(processingSettings.jpgBackground || 'white') : <span className="text-gray-500 italic">Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)</span>}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default ImageModalTabsContent;
