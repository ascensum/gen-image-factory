/**
 * Story 3.4 Phase 5b: Settings edit modal for SingleJobView.
 * Extracted from SingleJobView.legacy.tsx (Edit Job Settings form).
 */
import React from 'react';
import { Toggle } from '../../Settings/Toggle';
import styles from '../SingleJobView.module.css';
import type { SettingsObject } from '../../../../../types/settings';
import type { JobExecution } from '../../../../../types/job';

export interface SingleJobSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editedSettings: DeepPartial<SettingsObject> | null;
  onSettingChange: (section: string, key: string, value: unknown) => void;
  onToggleChange: (section: string, key: string) => (checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isLoading: boolean;
  saveError: string | null;
  job: JobExecution | null;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const SingleJobSettingsModal: React.FC<SingleJobSettingsModalProps> = ({
  isOpen,
  onClose,
  editedSettings,
  onSettingChange,
  onToggleChange,
  onSave,
  onCancel,
  isSaving,
  isLoading,
  saveError,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] max-w-[700px] w-[90%] max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center py-6 px-6 pb-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-medium text-[var(--foreground)] m-0">Edit Job Settings</h3>
          <button onClick={onClose} className="bg-transparent border-0 text-[var(--muted-foreground)] cursor-pointer p-2 rounded-[var(--radius)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
            <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--ring)] rounded-full animate-spin" />
            <p>Loading current settings...</p>
          </div>
        ) : editedSettings ? (
          <div className={`flex-1 overflow-y-auto p-6 ${styles.settingsForm}`}>
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">API Keys</h4>
              <p className="text-xs text-[var(--muted-foreground)] -mt-1.5 mb-2">API keys are managed in Settings. For security, edit them there.</p>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">File Paths</h4>
              <p className="text-xs text-[var(--muted-foreground)] -mt-1.5 mb-2">Edit file contents on disk; paths are reference-only here. Files are re-read at run/rerun. To change paths, use Settings.</p>
              <div className="flex flex-col mb-4">
                <label>Output Directory</label>
                <input type="text" value={editedSettings.filePaths?.outputDirectory || ''} onChange={() => {}} disabled placeholder="Output directory path" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Temp Directory</label>
                <input type="text" value={editedSettings.filePaths?.tempDirectory || ''} onChange={() => {}} disabled placeholder="Temporary directory path" />
              </div>
              <div className="flex flex-col mb-4">
                <label>System Prompt File</label>
                <input type="text" value={editedSettings.filePaths?.systemPromptFile || ''} onChange={() => {}} disabled placeholder="Path to system prompt file" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Keywords File</label>
                <input type="text" value={editedSettings.filePaths?.keywordsFile || ''} onChange={() => {}} disabled placeholder="Path to keywords file" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Quality Check Prompt File</label>
                <input type="text" value={editedSettings.filePaths?.qualityCheckPromptFile || ''} onChange={() => {}} disabled placeholder="Path to QC prompt file" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Metadata Prompt File</label>
                <input type="text" value={editedSettings.filePaths?.metadataPromptFile || ''} onChange={() => {}} disabled placeholder="Path to metadata prompt file" />
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">Parameters</h4>
              <div className="flex flex-col mb-4">
                <label>Job Name / Label</label>
                <input type="text" value={editedSettings.parameters?.label || ''} onChange={(e) => onSettingChange('parameters', 'label', e.target.value)} placeholder="Optional label for this job" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Runware Model</label>
                <input type="text" value={editedSettings.parameters?.runwareModel || ''} onChange={(e) => onSettingChange('parameters', 'runwareModel', e.target.value)} placeholder="e.g., runware:101@1" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Dimensions (W×H or CSV)</label>
                <input type="text" value={editedSettings.parameters?.runwareDimensionsCsv || ''} onChange={(e) => onSettingChange('parameters', 'runwareDimensionsCsv', e.target.value)} placeholder="e.g., 1024x1024 or 1024x1024,768x1024" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Output Format</label>
                <select className="w-full box-border py-2 px-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20" value={editedSettings.parameters?.runwareFormat || 'png'} onChange={(e) => onSettingChange('parameters', 'runwareFormat', e.target.value)}>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WEBP</option>
                </select>
              </div>
              <div className="flex flex-col mb-4">
                <label>Generations count</label>
                <input type="number" value={editedSettings.parameters?.count || 1} onChange={(e) => onSettingChange('parameters', 'count', parseInt(e.target.value))} min="1" max="2500" />
                <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Number of generations (up to 2500 generations).</p>
              </div>
              <div className="flex flex-col mb-4">
                <label>Variations</label>
                <input type="number" min="1" max="20" value={Number(editedSettings.parameters?.variations ?? 1)} onChange={(e) => onSettingChange('parameters', 'variations', Math.max(1, Math.min(20, Number(e.target.value || 1))))} />
              </div>
              <div className="flex flex-col mb-4">
                <label>Enable Generation Timeout</label>
                <Toggle checked={editedSettings.parameters?.enablePollingTimeout || false} onChange={(checked) => onSettingChange('parameters', 'enablePollingTimeout', checked)} />
              </div>
              {editedSettings.parameters?.enablePollingTimeout && (
                <div className="flex flex-col mb-4">
                  <label>Generation Timeout (minutes)</label>
                  <input type="number" value={editedSettings.parameters?.pollingTimeout || 0} onChange={(e) => onSettingChange('parameters', 'pollingTimeout', parseInt(e.target.value))} min="0" />
                </div>
              )}
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>LoRA Models</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Note: Check Runware model list for valid LoRA AIR ID:LoRA weight and valid weight ranges. LoRA weight defaults to 1 if no other valid number set. Not all models support LoRAs!</p>
                </div>
                <Toggle checked={!!editedSettings.parameters?.loraEnabled} onChange={(checked) => onSettingChange('parameters', 'loraEnabled', checked)} />
              </div>
              {editedSettings.parameters?.loraEnabled && (
                <div className="flex flex-col mb-4">
                  <label>LoRA list (model:weight per line)</label>
                  <textarea
                    value={Array.isArray((editedSettings.parameters as { lora?: Array<{ model: string; weight?: number }> })?.lora) ? ((editedSettings.parameters as { lora: Array<{ model: string; weight?: number }> }).lora).map(l => `${l.model}:${l.weight ?? 1}`).join('\n') : (Array.isArray(editedSettings.parameters?.runwareAdvanced?.lora) ? editedSettings.parameters!.runwareAdvanced!.lora!.map(l => `${l.model}:${l.weight ?? 1}`).join('\n') : '')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                      const lora = lines.map(line => {
                        const [model, weightStr] = line.split(':').map(s => s.trim());
                        return model ? { model, weight: Number(weightStr) || 1 } : null;
                      }).filter(Boolean) as Array<{ model: string; weight?: number }>;
                      onSettingChange('parameters', 'lora', lora);
                    }}
                    rows={4}
                    placeholder={'flux-lora:0.8\nartist-style:0.5'}
                  />
                </div>
              )}
              <div className="flex flex-col mb-4">
                <label htmlFor="gen-retry-attempts-modal">Generation Retry Attempts</label>
                <input id="gen-retry-attempts-modal" type="number" value={(editedSettings.parameters as { generationRetryAttempts?: number })?.generationRetryAttempts ?? 1} onChange={(e) => onSettingChange('parameters', 'generationRetryAttempts', Math.max(0, Math.min(5, parseInt(e.target.value))))} min="0" max="5" />
              </div>
              <div className="flex flex-col mb-4">
                <label htmlFor="gen-retry-backoff-modal">Retry Backoff (ms)</label>
                <input id="gen-retry-backoff-modal" type="number" value={(editedSettings.parameters as { generationRetryBackoffMs?: number })?.generationRetryBackoffMs ?? 0} onChange={(e) => onSettingChange('parameters', 'generationRetryBackoffMs', Math.max(0, Math.min(60000, parseInt(e.target.value))))} min="0" max="60000" step="100" />
              </div>
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>Runware Advanced Controls</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Show advanced Runware generation controls</p>
                </div>
                <Toggle checked={!!editedSettings.parameters?.runwareAdvancedEnabled} onChange={(checked) => onSettingChange('parameters', 'runwareAdvancedEnabled', checked)} />
              </div>
              {editedSettings.parameters?.runwareAdvancedEnabled && (
                <>
                  <div className="flex flex-col mb-4">
                    <label>Runware Advanced: CFG Scale</label>
                    <input type="number" value={Number(editedSettings.parameters?.runwareAdvanced?.CFGScale ?? '')} onChange={(e) => onSettingChange('parameters', 'runwareAdvanced', { ...(editedSettings.parameters?.runwareAdvanced || {}), CFGScale: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="flex flex-col mb-4">
                    <label>Runware Advanced: Steps</label>
                    <input type="number" value={Number(editedSettings.parameters?.runwareAdvanced?.steps ?? '')} onChange={(e) => onSettingChange('parameters', 'runwareAdvanced', { ...(editedSettings.parameters?.runwareAdvanced || {}), steps: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="flex flex-col mb-4">
                    <label>Runware Advanced: Scheduler</label>
                    <input type="text" value={editedSettings.parameters?.runwareAdvanced?.scheduler || ''} onChange={(e) => onSettingChange('parameters', 'runwareAdvanced', { ...(editedSettings.parameters?.runwareAdvanced || {}), scheduler: e.target.value || undefined })} />
                  </div>
                </>
              )}
              <div className="flex flex-col mb-4">
                <label>OpenAI Model</label>
                <input type="text" value={editedSettings.parameters?.openaiModel || ''} onChange={(e) => onSettingChange('parameters', 'openaiModel', e.target.value)} placeholder="e.g., gpt-4o-mini" />
              </div>
              <div className="flex flex-col mb-4">
                <label>Random Keywords</label>
                <Toggle checked={editedSettings.parameters?.keywordRandom || false} onChange={(checked) => onSettingChange('parameters', 'keywordRandom', checked)} />
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">Image Processing</h4>
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>Remove Background</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Remove background from generated images</p>
                </div>
                <Toggle checked={editedSettings.processing?.removeBg || false} onChange={onToggleChange('processing', 'removeBg')} />
              </div>
              {editedSettings.processing?.removeBg && (
                <>
                  <div className="flex flex-col mb-4">
                    <label>Remove.bg Size</label>
                    <select value={editedSettings.processing?.removeBgSize || 'auto'} onChange={(e) => onSettingChange('processing', 'removeBgSize', e.target.value)} className="w-full box-border py-2 px-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20">
                      <option value="auto">Auto</option>
                      <option value="preview">Preview</option>
                      <option value="full">Full</option>
                      <option value="50MP">50MP</option>
                    </select>
                  </div>
                  <div className="flex flex-col mb-4">
                    <label>On remove.bg failure</label>
                    <select value={String((editedSettings.processing as { removeBgFailureMode?: string })?.removeBgFailureMode || 'approve')} onChange={(e) => onSettingChange('processing', 'removeBgFailureMode', e.target.value)} className="w-full box-border py-2 px-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20">
                      <option value="mark_failed">Mark Failed (technical fail)</option>
                      <option value="approve">Approve (soft fail)</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>Image Convert</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Enable image conversion and processing</p>
                </div>
                <Toggle checked={editedSettings.processing?.imageConvert || false} onChange={onToggleChange('processing', 'imageConvert')} />
              </div>
              {editedSettings.processing?.imageConvert && (
                <div className="flex flex-col mb-4">
                  <label>Convert Format</label>
                  <select value={(editedSettings.processing as { convertToWebp?: boolean })?.convertToWebp ? 'webp' : (editedSettings.processing?.convertToJpg ? 'jpg' : 'png')} onChange={(e) => { const val = e.target.value; onSettingChange('processing', 'convertToWebp', val === 'webp'); onSettingChange('processing', 'convertToJpg', val === 'jpg'); }} className="w-full box-border py-2 px-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20">
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </div>
              )}
              {editedSettings.processing?.imageConvert && (
                <>
                  {editedSettings.processing?.convertToJpg && (
                    <div className="flex flex-col mb-4">
                      <label>JPG Quality (1-100)</label>
                      <input type="number" value={editedSettings.processing?.jpgQuality || 85} onChange={(e) => onSettingChange('processing', 'jpgQuality', parseInt(e.target.value))} min="1" max="100" />
                    </div>
                  )}
                  {(editedSettings.processing as { convertToWebp?: boolean })?.convertToWebp && (
                    <div className="flex flex-col mb-4">
                      <label>WebP Quality (1-100)</label>
                      <input type="number" value={(editedSettings.processing as { webpQuality?: number })?.webpQuality ?? 85} onChange={(e) => onSettingChange('processing', 'webpQuality', parseInt(e.target.value))} min="1" max="100" />
                    </div>
                  )}
                </>
              )}
              {editedSettings.processing?.removeBg && editedSettings.processing?.imageConvert && editedSettings.processing?.convertToJpg && (
                <div className="flex flex-col mb-4">
                  <label>JPG Background Color</label>
                  <select value={editedSettings.processing?.jpgBackground || 'white'} onChange={(e) => onSettingChange('processing', 'jpgBackground', e.target.value)} className="w-full box-border py-2 px-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20">
                    <option value="white">White</option>
                    <option value="black">Black</option>
                  </select>
                </div>
              )}
              {editedSettings.processing?.removeBg && (
                <div className="flex flex-row justify-between items-start mb-4">
                  <div>
                    <label>Trim Transparent Background</label>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Remove transparent areas from images (PNG/WebP only)</p>
                  </div>
                  <Toggle checked={editedSettings.processing?.trimTransparentBackground || false} onChange={onToggleChange('processing', 'trimTransparentBackground')} />
                </div>
              )}
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>Image Enhancement</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Apply sharpening and saturation effects</p>
                </div>
                <Toggle checked={editedSettings.processing?.imageEnhancement || false} onChange={onToggleChange('processing', 'imageEnhancement')} />
              </div>
              {editedSettings.processing?.imageEnhancement && (
                <>
                  <div className="flex flex-col mb-4">
                    <label>Sharpening Intensity (0-10)</label>
                    <input type="range" min="0" max="10" step="0.5" value={editedSettings.processing?.sharpening || 5} onChange={(e) => onSettingChange('processing', 'sharpening', parseFloat(e.target.value))} className={styles.rangeSlider} />
                    <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-2">
                      <span>0 (None)</span>
                      <span>{String(editedSettings.processing?.sharpening || 5)}</span>
                      <span>10 (Maximum)</span>
                    </div>
                  </div>
                  <div className="flex flex-col mb-4">
                    <label>Saturation Level (0-2)</label>
                    <input type="range" min="0" max="2" step="0.1" value={editedSettings.processing?.saturation || 1.4} onChange={(e) => onSettingChange('processing', 'saturation', parseFloat(e.target.value))} className={styles.rangeSlider} />
                    <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-2">
                      <span>0 (Grayscale)</span>
                      <span>{String(editedSettings.processing?.saturation || 1.4)}</span>
                      <span>2 (Vibrant)</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">AI Features</h4>
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>AI Quality Check</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Use AI to check image quality</p>
                </div>
                <Toggle checked={editedSettings.ai?.runQualityCheck || false} onChange={onToggleChange('ai', 'runQualityCheck')} />
              </div>
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>AI Metadata Generation</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Generate metadata using AI</p>
                </div>
                <Toggle checked={editedSettings.ai?.runMetadataGen || false} onChange={onToggleChange('ai', 'runMetadataGen')} />
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 pb-2 border-b border-[var(--border)]">Advanced Settings</h4>
              <div className="flex flex-row justify-between items-start mb-4">
                <div>
                  <label>Debug Mode</label>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">Enable detailed logging and debugging</p>
                </div>
                <Toggle checked={editedSettings.advanced?.debugMode || false} onChange={onToggleChange('advanced', 'debugMode')} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <p>Unable to load job settings. This job may be corrupted or missing configuration.</p>
              <p>Please check the error message below for more details.</p>
            </div>
          </div>
        )}

        {saveError && (
          <div className="py-2 px-6 text-[var(--status-failed)] flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 px-6 pb-6 border-t border-[var(--border)]">
          <button onClick={onCancel} className="px-4 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)] rounded-[var(--radius)] cursor-pointer transition hover:bg-[var(--accent)]">
            Cancel
          </button>
          <button onClick={onSave} disabled={isSaving || isLoading || !editedSettings} className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] border-0 rounded-[var(--radius)] cursor-pointer transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SingleJobSettingsModal;
