const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { emitPipelineStage } = require(path.join(__dirname, '../utils/pipelineStageLog'));

class ImageRemoverService {
  constructor(apiKey, dependencies = {}) {
    this.apiKey = apiKey;
    this.axios = dependencies.axios || axios;
    this.fs = dependencies.fs || fs;
    this.logDebug = dependencies.logDebug || (() => {});
  }

  async removeBackground(input, options = {}) {
    const { removeBgSize, signal, timeoutMs } = options;
    
    // Legacy removeBg logic
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('size', removeBgSize || 'preview');
      
      const fsModule = require('fs');
      // Support both Buffer and File path
      if (Buffer.isBuffer(input)) {
        form.append('image_file', input, { filename: 'image.png' });
      } else {
        form.append('image_file', fsModule.createReadStream(input));
      }

      const headers = {
        ...form.getHeaders(),
        'X-Api-Key': this.apiKey || ''
      };

      const stageCfg = {
        pipelineStageLog: options.pipelineStageLog
      };
      emitPipelineStage(stageCfg, 'remove_bg_http_begin', 'POST https://api.remove.bg/v1.0/removebg', {
        phase: 'network',
        host: 'api.remove.bg',
        generationIndex: options.generationIndex,
        attempt: options.removeBgAttempt,
        maxAttempts: options.removeBgMaxAttempts
      });

      const response = await this.axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers,
        responseType: 'arraybuffer',
        timeout: Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 60000,
        signal
      });

      emitPipelineStage(stageCfg, 'remove_bg_http_end', 'remove.bg HTTP response received', {
        phase: 'network',
        status: response.status,
        generationIndex: options.generationIndex,
        attempt: options.removeBgAttempt
      });

      if (response.status === 200 && response.data) {
        return Buffer.from(response.data);
      }
      throw new Error(`Failed to remove background: ${response.status} ${response.statusText}`);
    } catch (error) {
      // Do not emit remove_bg_http_error here — retryRemoveBackground emits once on final failure
      // so structured logs are not polluted by intermediate retry attempts.
      try {
        const status = error?.response?.status;
        const statusText = error?.response?.statusText;
        let body = '';
        if (error?.response?.data) {
          try {
            if (Buffer.isBuffer(error.response.data)) {
              body = error.response.data.toString('utf8').slice(0, 500);
            } else if (typeof error.response.data === 'string') {
              body = String(error.response.data).slice(0, 500);
            } else {
              body = JSON.stringify(error.response.data).slice(0, 500);
            }
          } catch {}
        }
        this.logDebug('Error in removeBg:', { status, statusText, body });
      } catch {
        this.logDebug('Error in removeBg:', error);
      }
      throw error;
    }
  }

  async retryRemoveBackground(input, options = {}) {
    const { retries = 3, delay = 2000, removeBgSize, signal, timeoutMs, pipelineStageLog, generationIndex } = options;
    let currentDelay = delay;

    for (let i = 0; i < retries; i++) {
      try {
        return await this.removeBackground(input, {
          removeBgSize,
          signal,
          timeoutMs,
          pipelineStageLog,
          generationIndex,
          removeBgAttempt: i + 1,
          removeBgMaxAttempts: retries
        });
      } catch (error) {
        const status = error?.response?.status;
        const isRetryable = !error.response || (status >= 500) || error.code === 'ECONNABORTED' || status === 429;

        console.warn(`Attempt ${i + 1} for removeBg failed: ${error.message}${status ? ` (status ${status})` : ''}. ${isRetryable && i < retries - 1 ? `Retrying in ${currentDelay / 1000} seconds...` : 'Not retryable or no attempts left.'}`);

        if (isRetryable && i < retries - 1) {
          emitPipelineStage(
            { pipelineStageLog },
            'remove_bg_http_retry',
            `remove.bg attempt ${i + 1}/${retries} failed; retrying`,
            {
              phase: 'network',
              generationIndex,
              attempt: i + 1,
              maxAttempts: retries,
              error: String(error?.message || error)
            }
          );
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * 2, 15000);
          continue;
        }

        emitPipelineStage(
          { pipelineStageLog },
          'remove_bg_http_error',
          'remove.bg request failed',
          {
            phase: 'network',
            generationIndex: options.generationIndex,
            attempt: i + 1,
            maxAttempts: retries,
            error: String(error?.message || error)
          }
        );
        throw error;
      }
    }
  }

  async trim(buffer, threshold = 50) {
    try {
      return await sharp(buffer).trim({ threshold }).toBuffer();
    } catch (e) {
      throw e;
    }
  }
}

module.exports = ImageRemoverService;
