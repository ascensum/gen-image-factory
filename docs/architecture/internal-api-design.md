# Internal API Design (Backend Adapter)

The `Backend Adapter` will expose a single, global API object (`window.api`) to the UI (the Renderer Process) via Electron's secure `contextBridge`. This API will be available under `window.api`. All functions will be asynchronous and return Promises.

## API Methods

### Configuration & Settings
* `getSettings()`: Returns a promise that resolves with the current application settings object, including:
  - **API Keys**: openai, piapi, removeBg
  - **File Paths**: outputDirectory, tempDirectory, systemPromptFile, keywordsFile, qualityCheckPromptFile, metadataPromptFile
  - **Parameters**: processMode, aspectRatios, mjVersion, openaiModel, pollingTimeout, keywordRandom, count
  - **Processing**: removeBg, imageConvert, imageEnhancement, sharpening, saturation, convertToJpg, trimTransparentBackground, jpgBackground, jpgQuality, pngQuality, removeBgSize
  - **AI**: runQualityCheck, runMetadataGen
  - **Advanced**: debugMode
* `saveSettings(settingsObject)`: Saves the provided settings object with all configuration options including new image enhancement parameters.
* `selectFile(options)`: Opens a native OS file dialog for selecting files.
* `getApiKey(serviceName)`: Retrieves a specific API key from the secure OS credential store.
* `setApiKey(serviceName, apiKey)`: Saves a specific API key to the secure OS credential store.

### Security Management (Story 1.13)
* `getSecurityStatus()`: Returns security status information including storage method and security level.
* `getEncryptionStatus()`: Returns encryption status for database fallback storage.
* `clearSensitiveData()`: Clears API keys from memory and secure storage.
* `maskApiKeysInLogs(str)`: Masks API keys in log messages and error outputs.

### Job Execution
* `startJob(configObject)`: Starts the image generation pipeline with the given configuration, including new image enhancement settings:
  - `imageEnhancement`: boolean - Enable/disable image enhancement features
  - `sharpening`: number (0-10) - Sharpening intensity for image processing
  - `saturation`: number (0-2) - Saturation level for image processing
* `stopJob()`: Requests a graceful stop of the currently running pipeline.
* `forceStopAll()`: Immediately terminates all running backend processes.

### Real-time Updates (Event-based)
* `onLogUpdate(callbackFunction)`: Registers a callback function that will be invoked with new log messages from the backend.
* `onProgressUpdate(callbackFunction)`: Registers a callback that will be invoked with structured progress updates.

### Data & History
* `getJobHistory()`: Returns a promise that resolves with an array of all past `JobExecutions`.
* `getJobResults(jobExecutionId)`: Returns a promise that resolves with the detailed results for a specific job execution.
* `manualApproveImage(imageId)`: Triggers the manual processing workflow for a failed image.
* `exportToExcel(jobExecutionId)`: Triggers the creation of the Excel export file for a specific job.

### Data Management
* `deleteJobExecution(jobExecutionId)`: Deletes a single job run and all its associated image records from the database.
* `clearAllHistory()`: Deletes all job execution history and image records from the database.
* `deleteJobConfiguration(jobConfigurationId)`: Deletes a saved job configuration preset.

## Implementation Delta: IPC Endpoints (2025-11-02)

The following IPC channels are implemented and exposed via `electron/preload.js` in the current codebase. They complement the high-level API documented above.

- Job control: `job:start`, `job:stop`, `job:force-stop-all`, `job:get-status`, `job:get-progress`, `job:get-logs`
- Settings & configuration: `get-settings`, `save-settings`, `settings:get-configuration`, `job-configuration:get-by-id`, `job-configuration:update`, `job-configuration:update-name`
- Security: `get-security-status`, `get-api-key`, `set-api-key`
- File dialogs and paths: `select-file`, `validate-path`, `protocol:refresh-roots`, `get-exports-folder-path`, `open-exports-folder`, `reveal-in-folder`
- Job executions: `job-execution:save`, `job-execution:get`, `job-execution:get-all`, `job-execution:update`, `job-execution:delete`, `job-execution:history`, `job-execution:statistics`, `job-execution:export-to-excel`, `job-execution:bulk-delete`, `job-execution:bulk-export`, `job-execution:bulk-rerun`, `job-execution:rename`, `job-execution:export`
- Generated images: `generated-image:save`, `generated-image:get`, `generated-image:get-by-execution`, `generated-image:get-all`, `generated-image:update`, `generated-image:delete`, `generated-image:get-by-qc-status`, `generated-image:update-qc-status`, `generated-image:update-qc-status-by-mapping`, `generated-image:manual-approve`, `generated-image:metadata`, `generated-image:statistics`, `generated-image:export-zip`, `generated-image:bulk-delete`
- Failed images retry: `failed-image:retry-original`, `failed-image:retry-modified`, `failed-image:retry-batch`, plus progress events (`retry-progress`, `retry-completed`, `retry-error`, `retry-queue-updated`, `retry-status-updated`).

Note: The Security Manager responsibilities are currently implemented within `BackendAdapter` rather than a separate module.

## Security Implementation Tiers

### Security Tier 1: Native OS Keychain (Primary)
```typescript
// Try keytar first - most secure
const apiKey = await keytar.getPassword(SERVICE_NAME, accountName);
if (apiKey) {
  return { success: true, apiKey, securityLevel: 'native-keychain' };
}
```

### Security Tier 2: Encrypted Database (Story 1.13 Fallback)
```typescript
// Encrypted database fallback when keytar unavailable
} catch (error) {
  console.warn('Native keychain unavailable, trying encrypted database');
  const encryptedKey = await this.encryptedDb.getEncryptedValue('api-keys', serviceName);
  if (encryptedKey) {
    const decryptedKey = await this.encryptedDb.decrypt(encryptedKey);
    return { success: true, apiKey: decryptedKey, securityLevel: 'encrypted-db' };
  }
}
```

### Security Tier 3: Plain Text Database (Development Only)
```typescript
// Current fallback: Plain text storage (dev/testing phase)
} catch (error) {
  console.error('Error getting API key (keytar failed):', error);
  return { success: true, apiKey: '', securityLevel: 'plain-text-fallback' };
}
```

## New Image Enhancement Features

### Image Processing Parameters
The following new parameters have been added to support configurable image enhancement:

* **`imageEnhancement`**: boolean - Master toggle for image enhancement features (independent of imageConvert)
* **`sharpening`**: number (0-10) - Sharpening intensity with 0.5 step increments
* **`saturation`**: number (0-2) - Saturation level with 0.1 step increments

### Conditional Processing Logic
* Image enhancement is applied only when `imageEnhancement` is true
* Sharpening is applied only when `sharpening > 0`
* Saturation is applied only when `saturation !== 1`
* These features work independently of image conversion settings 