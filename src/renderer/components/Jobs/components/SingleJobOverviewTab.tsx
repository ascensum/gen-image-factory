/**
 * Story 3.4 Phase 5b: Overview tab content for SingleJobView.
 * Extracted from SingleJobView.legacy.tsx – job info, stats, read-only settings summary.
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';
import type { JobExecution } from '../../../../../types/job';

export type FormatDateFn = (dateString: string | Date) => string;
export type FormatDurationFn = (startTime: string | Date, endTime?: string | Date) => string;

export interface SingleJobOverviewTabProps {
  job: JobExecution;
  overviewSettings: any;
  jobConfiguration: any;
  isLoading: boolean;
  loadJobData: () => Promise<void>;
  handleSettingsEdit: () => void;
  failedProcessingCount: number;
  formatDate: FormatDateFn;
  formatDuration: FormatDurationFn;
}

const SingleJobOverviewTab: React.FC<SingleJobOverviewTabProps> = ({
  job,
  overviewSettings,
  jobConfiguration,
  isLoading,
  loadJobData,
  handleSettingsEdit,
  failedProcessingCount,
  formatDate,
  formatDuration,
}) => (
  <div className="p-6">
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8">
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-2">Job ID</div>
        <div className="text-lg font-medium text-[var(--foreground)]">JOB-{job.id}</div>
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-2">Status</div>
        <div className="text-lg font-medium text-[var(--foreground)]">
          <StatusBadge variant="job" status={job.status} />
        </div>
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-2">Start Time</div>
        <div className="text-lg font-medium text-[var(--foreground)]">
          {job.startedAt ? formatDate(job.startedAt) : 'Not started'}
        </div>
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-2">Duration</div>
        <div className="text-lg font-medium text-[var(--foreground)]">
          {job.startedAt && job.completedAt ? formatDuration(job.startedAt, job.completedAt) : 'In Progress'}
        </div>
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-2">Success Rate</div>
        <div className="text-lg font-medium text-[var(--foreground)]">
          {job.totalImages
            ? `${Math.round(((job.successfulImages || 0) / job.totalImages) * 100)}% (${job.successfulImages || 0}/${job.totalImages})`
            : 'N/A'}
        </div>
      </div>
    </div>

    <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Generated Images Summary</h2>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)] text-center">
        <div className="text-[0.813rem] text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">Total Images</div>
        <div className="text-[1.375rem] font-bold text-[var(--foreground)]">{job.totalImages || 0}</div>
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)] text-center">
        <div className="text-[0.813rem] text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">Successful</div>
        <div className="text-[1.375rem] font-bold text-[var(--status-completed)]">{job.successfulImages || 0}</div>
        {(job.successfulImages || 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-[var(--muted-foreground)] font-medium">Approved:</span>
              <span className="font-semibold text-[var(--status-completed)]">{(job as any).approvedImages || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-[var(--muted-foreground)] font-medium">Failed Processing:</span>
              <span className="font-semibold text-[var(--status-failed)]">{failedProcessingCount}</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)] text-center">
        <div className="text-[0.813rem] text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">Failed</div>
        <div className="text-[1.375rem] font-bold text-[var(--status-failed)]">{job.failedImages || 0}</div>
        <div className="text-xs text-[var(--muted-foreground)] mt-2 italic">Generation failed</div>
      </div>
    </div>

    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Settings</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-4 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)] rounded-[var(--radius)] text-sm cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:bg-[var(--accent)]"
            onClick={loadJobData}
            title="Refresh job data"
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : (
              <>
                <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeWidth="2.5" />
                  <path d="M21 3v5h-5" strokeWidth="2.5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeWidth="2.5" />
                  <path d="M8 16H3v5" strokeWidth="2.5" />
                </svg>
                Refresh
              </>
            )}
          </button>
          <button
            type="button"
            className="text-sm text-[var(--primary)] bg-transparent border-0 cursor-pointer underline hover:opacity-80"
            onClick={handleSettingsEdit}
            title="Edit job settings"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--secondary)]">
        {jobConfiguration ? (
          <>
            <div className="mb-6 last:mb-0">
              <h3 className="font-medium mb-2 text-[var(--foreground)]">Model Configuration</h3>
              <div className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                <div>• Provider: Runware</div>
                <div>• Runware Model: {overviewSettings?.parameters?.runwareModel || 'Not specified'}</div>
                <div>• Generations: {overviewSettings?.parameters?.count ?? 'Not specified'}</div>
                <div>• Variations: {overviewSettings?.parameters?.variations ?? 'Not specified'}</div>
                {(() => {
                  const loraEnabled = overviewSettings?.parameters?.loraEnabled === true;
                  const list = Array.isArray((overviewSettings?.parameters as any)?.lora)
                    ? ((overviewSettings?.parameters as any).lora as Array<{ model: string; weight?: number }>)
                    : [];
                  const listStr =
                    list.length > 0
                      ? list.map((l) => `${l.model}:${l.weight ?? 1}`).join(', ')
                      : loraEnabled
                        ? 'None'
                        : 'Not Applied as LoRA Models disabled';
                  return (
                    <>
                      <div>• LoRA Models: {loraEnabled ? 'Yes' : 'No'}</div>
                      <div>• LoRA list: {listStr}</div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="mb-6 last:mb-0">
              <h3 className="font-medium mb-2 text-[var(--foreground)]">Image Settings</h3>
              <div className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                <div>• Dimensions: {overviewSettings?.parameters?.runwareDimensionsCsv || 'Not specified'}</div>
                <div>• Format: {(overviewSettings?.parameters?.runwareFormat || 'Not specified')?.toString().toUpperCase()}</div>
              </div>
            </div>
            {(() => {
              const adv = overviewSettings?.parameters?.runwareAdvanced || {};
              const flag = overviewSettings?.parameters?.runwareAdvancedEnabled;
              const enabled =
                flag === false
                  ? false
                  : flag === true
                    ? true
                    : Boolean(
                        adv &&
                          (adv.CFGScale != null ||
                            adv.steps != null ||
                            (adv.scheduler && String(adv.scheduler).trim() !== '') ||
                            adv.checkNSFW === true ||
                            (Array.isArray(adv.lora) && adv.lora.length > 0))
                      );
              if (!enabled) return null;
              return (
                <div className="mb-6 last:mb-0">
                  <h3 className="font-medium mb-2 text-[var(--foreground)]">Runware Advanced</h3>
                  <div className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                    <div>• CFG Scale: {adv.CFGScale ?? 'Not specified'}</div>
                    <div>• Steps: {adv.steps ?? 'Not specified'}</div>
                    <div>• Scheduler: {adv.scheduler || 'Not specified'}</div>
                    <div>• NSFW Check: {adv.checkNSFW ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              );
            })()}
            <div className="mb-6 last:mb-0">
              <h3 className="font-medium mb-2 text-[var(--foreground)]">Processing Options</h3>
              <div className="text-[var(--muted-foreground)] text-sm leading-relaxed">
                <div>• Remove Background: {overviewSettings?.processing?.removeBg ? 'Yes' : 'No'}</div>
                <div>
                  • Remove.bg Size:{' '}
                  {overviewSettings?.processing?.removeBg
                    ? (overviewSettings?.processing?.removeBgSize || 'auto')
                    : 'Not applied (Remove Background OFF)'}
                </div>
                <div>• Image Enhancement: {overviewSettings?.processing?.imageEnhancement ? 'Yes' : 'No'}</div>
                <div>
                  • Sharpening:{' '}
                  {overviewSettings?.processing?.imageEnhancement
                    ? (overviewSettings?.processing?.sharpening || 0)
                    : 'Not applied (Image Enhancement OFF)'}
                </div>
                <div>
                  • Saturation:{' '}
                  {overviewSettings?.processing?.imageEnhancement
                    ? (overviewSettings?.processing?.saturation || 1.4)
                    : 'Not applied (Image Enhancement OFF)'}
                </div>
                <div>• Image Convert: {overviewSettings?.processing?.imageConvert ? 'Yes' : 'No'}</div>
                <div>
                  • Convert Format:{' '}
                  {overviewSettings?.processing?.imageConvert
                    ? (overviewSettings?.processing as any)?.convertToWebp
                      ? 'WEBP'
                      : (overviewSettings?.processing?.convertToJpg ? 'JPG' : 'PNG')
                    : 'Not applied (Image Convert OFF)'}
                </div>
                {overviewSettings?.processing?.imageConvert && overviewSettings?.processing?.convertToJpg && (
                  <div>• JPG Quality: {overviewSettings?.processing?.jpgQuality || 85}</div>
                )}
                {(overviewSettings?.processing as any)?.convertToWebp && overviewSettings?.processing?.imageConvert && (
                  <div>• WEBP Quality: {(overviewSettings?.processing as any)?.webpQuality ?? 85}</div>
                )}
                <div>
                  • Trim Transparent:{' '}
                  {overviewSettings?.processing?.removeBg
                    ? (overviewSettings?.processing?.trimTransparentBackground ? 'Yes' : 'No')
                    : 'Not applied (Remove Background OFF)'}
                </div>
                <div>
                  • JPG Background Colour:{' '}
                  {overviewSettings?.processing?.imageConvert &&
                  overviewSettings?.processing?.convertToJpg &&
                  overviewSettings?.processing?.removeBg
                    ? (overviewSettings?.processing?.jpgBackground || 'white')
                    : 'Not applied (Remove Background, Image Convert are set to OFF and Convert Format is not JPG)'}
                </div>
                <div>• Quality Check: {overviewSettings?.ai?.runQualityCheck ? 'Yes' : 'No'}</div>
                <div>• Metadata Generation: {overviewSettings?.ai?.runMetadataGen ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-[var(--muted-foreground)]">
            <p>No configuration available for this job.</p>
            <p>This job was run with default settings.</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default SingleJobOverviewTab;
