/**
 * Story 3.4 Phase 5c.4: Tabs (Details, AI Metadata, Processing) for FailedImageReviewModal.
 */
import React from 'react';
import { formatQcFailureReason } from '../../../utils/qc';
import type { GeneratedImage } from '../../../../types/generatedImage';

export type FailedImageReviewTabType = 'details' | 'metadata' | 'processing';

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  return {};
}

interface FailedImageReviewModalTabsContentProps {
  image: GeneratedImage;
  activeTab: FailedImageReviewTabType;
  onTabChange: (tab: FailedImageReviewTabType) => void;
  processingSettings: Record<string, unknown>;
}

const FailedImageReviewModalTabsContent: React.FC<FailedImageReviewModalTabsContentProps> = ({
  image,
  activeTab,
  onTabChange,
  processingSettings: ps,
}) => (
  <div className="w-1/2 xl:w-1/3 border-l border-gray-200 flex flex-col h-full overflow-hidden xl:min-w-[400px]">
    <div className="flex border-b border-gray-200">
      {(['details', 'metadata', 'processing'] as FailedImageReviewTabType[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab === 'details' ? 'Details' : tab === 'metadata' ? 'AI Metadata' : 'Processing'}
        </button>
      ))}
    </div>

    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
      {activeTab === 'details' && (
        <div className="space-y-6">
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

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Failure Analysis</h3>
            <div className={image.qcReason ? 'bg-red-50 border border-red-200 rounded-lg p-4' : 'bg-yellow-50 border border-yellow-200 rounded-lg p-4'}>
              <div className="flex items-start">
                <svg className={`w-5 h-5 mt-0.5 mr-2 ${image.qcReason ? 'text-red-400' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={image.qcReason ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' : 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
                </svg>
                <div>
                  <h4 className={`text-sm font-medium ${image.qcReason ? 'text-red-800' : 'text-yellow-800'}`}>{image.qcReason ? 'Failure Reason' : 'No Specific Reason'}</h4>
                  <p className={`${image.qcReason ? 'text-red-700' : 'text-yellow-700'} text-sm mt-1 whitespace-normal break-words`}>
                    {image.qcReason
                      ? (formatQcFailureReason((image as { qcStatus?: string })?.qcStatus, (image as { qcReason?: string })?.qcReason) || (image as { qcReason?: string })?.qcReason)
                      : 'Image failed quality check but no specific reason provided.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Generation Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{image.generationPrompt}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <p className="text-sm text-gray-900">{image.createdAt ? new Date(image.createdAt as Date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                <p className="text-sm text-gray-900 font-mono break-all">{image.finalImagePath || image.tempImagePath || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metadata' && (() => {
        const meta = parseMetadata(image.metadata);
        const title = typeof meta?.title === 'object' ? (meta.title as { en?: string }).en || '' : (meta?.title as string) || '';
        const description = typeof meta?.description === 'object' ? (meta.description as { en?: string }).en || '' : (meta?.description as string) || '';
        let tagsArray: string[] = [];
        if (meta?.uploadTags && typeof meta.uploadTags === 'object' && (meta.uploadTags as { en?: string }).en) {
          tagsArray = String((meta.uploadTags as { en: string }).en).split(',').map((t: string) => t.trim()).filter(Boolean);
        } else if (Array.isArray(meta?.tags)) {
          tagsArray = meta.tags as string[];
        } else if (typeof meta?.tags === 'string') {
          tagsArray = String(meta.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        if (!title && !description && tagsArray.length === 0) {
          return <p className="text-sm text-gray-500">No AI metadata available.</p>;
        }
        return (
          <div className="space-y-4">
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
          </div>
        );
      })()}

      {activeTab === 'processing' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image Enhancement</label>
            <p className="text-sm text-gray-900">{ps.imageEnhancement ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sharpening</label>
            <p className="text-sm text-gray-900">{ps.imageEnhancement ? String(Number(ps.sharpening ?? 0)) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saturation</label>
            <p className="text-sm text-gray-900">{ps.imageEnhancement ? String(Number(ps.saturation ?? 1.4)) : <span className="text-gray-500 italic">Not applied (Image Enhancement OFF)</span>}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image Convert</label>
            <p className="text-sm text-gray-900">{ps.imageConvert ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Convert Format</label>
            <p className="text-sm text-gray-900">
              {ps.imageConvert
                ? (Boolean(ps.convertToWebp) ? 'WEBP' : (Boolean(ps.convertToJpg) ? 'JPG' : 'PNG'))
                : <span className="text-gray-500 italic">Not applied (Image Convert OFF)</span>}
            </p>
          </div>
          {Boolean(ps.imageConvert && ps.convertToJpg) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JPG Quality</label>
              <p className="text-sm text-gray-900">{String(Number(ps.jpgQuality ?? 85))}</p>
            </div>
          )}
          {Boolean(ps.imageConvert && ps.convertToWebp) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WebP Quality</label>
              <p className="text-sm text-gray-900">{String(Number(ps.webpQuality ?? 85))}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remove Background</label>
            <p className="text-sm text-gray-900">{ps.removeBg ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remove.bg Size</label>
            <p className="text-sm text-gray-900">{ps.removeBg ? String(ps.removeBgSize || 'auto') : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trim Transparent</label>
            <p className="text-sm text-gray-900">
              {ps.removeBg ? (ps.trimTransparentBackground ? 'Yes' : 'No') : <span className="text-gray-500 italic">Not applied (Remove Background OFF)</span>}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">JPG Background Colour</label>
            <p className="text-sm text-gray-900">
              {ps.imageConvert && ps.convertToJpg && ps.removeBg ? String(ps.jpgBackground || 'white') : <span className="text-gray-500 italic">Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default FailedImageReviewModalTabsContent;
