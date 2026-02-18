import React from 'react';
import type { SettingsObject } from '../../../../../types/settings';
import { Toggle } from '../../Toggle';

interface SettingsTabParametersProps {
  form: SettingsObject;
  setForm: React.Dispatch<React.SetStateAction<SettingsObject>>;
  setHasUnsavedChanges: (v: boolean) => void;
}

export function SettingsTabParameters({ form, setForm, setHasUnsavedChanges }: SettingsTabParametersProps) {
  const params = form.parameters;

  const updateParams = (patch: Partial<SettingsObject['parameters']>) => {
    setForm((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const updateRunwareAdvanced = (patch: Partial<NonNullable<SettingsObject['parameters']['runwareAdvanced']>>) => {
    setForm((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), ...patch },
      },
    }));
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-6" data-testid="parameters-section">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Runware & OpenAI</h3>
        <p className="text-sm text-gray-600 mb-6">Configure Runware image generation and OpenAI model.</p>
      </div>

      {/* Job Name / Label */}
      <div>
        <label htmlFor="job-label" className="block text-sm font-medium text-gray-700 mb-2">
          Job Name / Label
        </label>
        <input
          id="job-label"
          type="text"
          value={params.label ?? ''}
          onChange={(e) => updateParams({ label: e.target.value })}
          onBlur={() => setHasUnsavedChanges(true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optional label shown in Dashboard and Job views"
        />
        <p className="text-xs text-gray-500 mt-1">If empty, a default job_timestamp label will be used.</p>
      </div>

      {/* Runware Settings */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800">Runware Settings</h4>
        <div>
          <label htmlFor="runware-model" className="block text-sm font-medium text-gray-700 mb-2">
            Runware Model
          </label>
          <input
            id="runware-model"
            type="text"
            value={params.runwareModel ?? 'runware:101@1'}
            onChange={(e) => updateParams({ runwareModel: e.target.value || 'runware:101@1' })}
            onBlur={() => setHasUnsavedChanges(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="runware:101@1"
          />
          <p className="text-xs text-gray-500 mt-1">Model id used for image generation. Default: runware:101@1.</p>
        </div>
        <div>
          <label htmlFor="runware-dimensions" className="block text-sm font-medium text-gray-700 mb-2">
            Image Dimensions (CSV)
          </label>
          <input
            id="runware-dimensions"
            type="text"
            value={params.runwareDimensionsCsv ?? ''}
            onChange={(e) => updateParams({ runwareDimensionsCsv: (e.target.value || '').trim() })}
            onBlur={() => setHasUnsavedChanges(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="1024x1024,1280x720,720x1280"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty for provider defaults.</p>
        </div>
        <div>
          <label htmlFor="runware-format" className="block text-sm font-medium text-gray-700 mb-2">
            Output Format
          </label>
          <select
            id="runware-format"
            value={params.runwareFormat ?? 'png'}
            onChange={(e) => updateParams({ runwareFormat: e.target.value as 'png' | 'jpg' | 'webp' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LoRA Models</label>
            <p className="text-xs text-gray-500">Optional LoRA adapters (model:weight per line).</p>
          </div>
          <Toggle
            checked={!!params.loraEnabled}
            onChange={(checked) => updateParams({ loraEnabled: checked })}
          />
        </div>
        {params.loraEnabled && (
          <div>
            <label htmlFor="lora-list" className="block text-sm font-medium text-gray-700 mb-2">
              LoRA list (model:weight per line)
            </label>
            <textarea
              id="lora-list"
              defaultValue={
                Array.isArray((params as any)?.lora)
                  ? ((params as any).lora as Array<{ model: string; weight?: number }>)
                      .map((l) => `${l.model}:${l.weight ?? 1}`)
                      .join('\n')
                  : Array.isArray(params.runwareAdvanced?.lora)
                    ? params.runwareAdvanced.lora.map((l) => `${l.model}:${l.weight ?? 1}`).join('\n')
                    : ''
              }
              onBlur={(e) => {
                const lines = e.currentTarget.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                const lora = lines
                  .map((line) => {
                    const [model, weightStr] = line.split(':').map((s) => s.trim());
                    return model ? { model, weight: Number(weightStr) || 1 } : null;
                  })
                  .filter(Boolean) as Array<{ model: string; weight?: number }>;
                updateParams({ lora });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="flux-lora:0.8"
            />
          </div>
        )}
      </div>

      {/* OpenAI Settings */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800">OpenAI Settings</h4>
        <div>
          <label htmlFor="openai-model" className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI Model
          </label>
          <input
            id="openai-model"
            type="text"
            value={params.openaiModel ?? 'gpt-4o'}
            onChange={(e) => updateParams({ openaiModel: e.target.value || 'gpt-4o' })}
            onBlur={() => setHasUnsavedChanges(true)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="gpt-4o, gpt-4o-mini, gpt-4.1"
          />
          <p className="text-xs text-gray-500 mt-1">Model used for prompts, quality check, and metadata.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Generation Timeout</label>
            <p className="text-xs text-gray-500">Use custom HTTP timeout for Runware (minutes)</p>
          </div>
          <Toggle
            checked={params.enablePollingTimeout ?? true}
            onChange={(checked) => updateParams({ enablePollingTimeout: checked })}
          />
        </div>
        {(params.enablePollingTimeout ?? true) && (
          <div>
            <label htmlFor="polling-timeout" className="block text-sm font-medium text-gray-700 mb-2">
              Timeout (minutes)
            </label>
            <input
              id="polling-timeout"
              type="number"
              min={1}
              max={60}
              value={params.pollingTimeout ?? 15}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) updateParams({ pollingTimeout: Math.max(1, Math.min(60, v)) });
              }}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Runware Advanced */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium text-gray-800">Runware Advanced</h4>
          <Toggle
            checked={!!params.runwareAdvancedEnabled}
            onChange={(checked) => updateParams({ runwareAdvancedEnabled: checked })}
          />
        </div>
        <p className="text-xs text-gray-500">CFG Scale, Steps, Scheduler, NSFW check. Only if your model supports them.</p>
        {params.runwareAdvancedEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="runware-cfg" className="block text-sm font-medium text-gray-700 mb-2">
                CFG Scale
              </label>
              <input
                id="runware-cfg"
                type="number"
                value={params.runwareAdvanced?.CFGScale ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  updateRunwareAdvanced({ CFGScale: v === '' ? undefined : (Number(v) as any) });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="optional"
              />
            </div>
            <div>
              <label htmlFor="runware-steps" className="block text-sm font-medium text-gray-700 mb-2">
                Steps
              </label>
              <input
                id="runware-steps"
                type="number"
                value={params.runwareAdvanced?.steps ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  updateRunwareAdvanced({ steps: v === '' ? undefined : (Number(v) as any) });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="optional"
              />
            </div>
            <div>
              <label htmlFor="runware-scheduler" className="block text-sm font-medium text-gray-700 mb-2">
                Scheduler
              </label>
              <input
                id="runware-scheduler"
                type="text"
                value={params.runwareAdvanced?.scheduler ?? ''}
                onChange={(e) => updateRunwareAdvanced({ scheduler: e.target.value.trim() || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="optional"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 mb-2">Check NSFW</label>
              <Toggle
                checked={!!params.runwareAdvanced?.checkNSFW}
                onChange={(checked) => updateRunwareAdvanced({ checkNSFW: checked })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Generation Settings */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-800">Generation Settings</h4>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Random Keywords</label>
            <p className="text-xs text-gray-500">Use random keywords from the keywords file</p>
          </div>
          <Toggle
            checked={params.keywordRandom ?? false}
            onChange={(checked) => updateParams({ keywordRandom: checked })}
          />
        </div>
        <div>
          <label htmlFor="gen-retry-attempts" className="block text-sm font-medium text-gray-700 mb-2">
            Generation Retry Attempts
          </label>
          <input
            id="gen-retry-attempts"
            type="number"
            min={0}
            max={5}
            value={String(params.generationRetryAttempts ?? 1)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) updateParams({ generationRetryAttempts: Math.max(0, Math.min(5, v)) });
            }}
            onBlur={(e) => {
              const v = parseInt(e.currentTarget.value || '0', 10);
              const clamped = Math.min(5, Math.max(0, isNaN(v) ? 0 : v));
              updateParams({ generationRetryAttempts: clamped });
            }}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Number of automatic retries per generation (0–5).</p>
        </div>
        <div>
          <label htmlFor="gen-retry-backoff" className="block text-sm font-medium text-gray-700 mb-2">
            Retry Backoff (ms)
          </label>
          <input
            id="gen-retry-backoff"
            type="number"
            min={0}
            max={60000}
            step={100}
            value={String(params.generationRetryBackoffMs ?? 0)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) updateParams({ generationRetryBackoffMs: Math.max(0, Math.min(60000, v)) });
            }}
            onBlur={(e) => {
              const v = parseInt(e.currentTarget.value || '0', 10);
              const clamped = Math.min(60000, Math.max(0, isNaN(v) ? 0 : v));
              updateParams({ generationRetryBackoffMs: clamped });
            }}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Delay between retries (0–60000 ms).</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
              Generations count
            </label>
            <input
              id="count"
              type="number"
              value={String(params.count ?? 1)}
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.value || '1', 10);
                const clamped = Math.min(2500, Math.max(1, isNaN(v) ? 1 : v));
                const currentVariations = Math.max(1, Math.min(20, Number(params.variations || 1)));
                const maxVariationsAllowed = Math.max(1, Math.min(20, Math.floor(10000 / clamped)));
                const adjustedVariations = Math.min(currentVariations, maxVariationsAllowed);
                updateParams({ count: clamped, variations: adjustedVariations });
              }}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) {
                  const clamped = Math.min(2500, Math.max(1, v));
                  const currentVariations = Math.max(1, Math.min(20, Number(params.variations || 1)));
                  const maxVariationsAllowed = Math.max(1, Math.min(20, Math.floor(10000 / clamped)));
                  const adjustedVariations = Math.min(currentVariations, maxVariationsAllowed);
                  updateParams({ count: clamped, variations: adjustedVariations });
                }
              }}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={1}
              max={2500}
            />
            <p className="text-xs text-gray-500 mt-1">Up to 2500 generations.</p>
          </div>
          <div>
            <label htmlFor="runware-variations" className="block text-sm font-medium text-gray-700 mb-2">
              Variations per generation (1–20)
            </label>
            <input
              id="runware-variations"
              type="number"
              value={String(params.variations ?? 1)}
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.value || '1', 10);
                const clamped = Math.max(1, Math.min(20, isNaN(v) ? 1 : v));
                const currentCount = Math.max(1, Number(params.count || 1));
                const maxCountAllowed = Math.max(1, Math.floor(10000 / clamped));
                const adjustedCount = Math.min(currentCount, maxCountAllowed);
                updateParams({ variations: clamped, count: adjustedCount });
              }}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) {
                  const clamped = Math.max(1, Math.min(20, v));
                  const currentCount = Math.max(1, Number(params.count || 1));
                  const maxCountAllowed = Math.max(1, Math.floor(10000 / clamped));
                  const adjustedCount = Math.min(currentCount, maxCountAllowed);
                  updateParams({ variations: clamped, count: adjustedCount });
                }
              }}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={1}
              max={20}
            />
            <p className="text-xs text-gray-500 mt-1">Total images = Generations × Variations (cap 10,000)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
