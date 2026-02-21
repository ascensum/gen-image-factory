/**
 * Shadow Bridge Logger
 * 
 * Logs when feature flags route to new services/repositories vs legacy code.
 * Helps verify that refactored code paths are actually being used.
 * 
 * SECURITY: This logger is designed to NOT log sensitive data:
 * - Does NOT log method parameters (which may contain API keys, user data)
 * - Does NOT log return values (which may contain sensitive results)
 * - Only logs service/method names and routing decisions
 * - Log files are stored in OS temp directory (NOT workspace)
 * - Log files match *.log pattern (already in .gitignore)
 * 
 * Usage:
 *   const logger = require('./utils/shadowBridgeLogger');
 *   logger.logModularPath('JobRepository', 'getJobHistory');
 *   logger.logLegacyFallback('JobRepository', 'getJobHistory', error);
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ShadowBridgeLogger {
  constructor() {
    this.enabled = process.env.SHADOW_BRIDGE_LOGGING === 'true';
    this.logToFile = process.env.SHADOW_BRIDGE_LOG_FILE === 'true';
    
    this.logFilePath = path.join(os.tmpdir(), `shadow-bridge-${Date.now()}.log`);
    
    if (this.logToFile) {
      console.log(`[Shadow Bridge] Logging to: ${this.logFilePath}`);
      console.log(`[Security] Logs stored in temp directory (not workspace)`);
      console.log(`[Security] Log files match *.log (ignored by git)`);
    }
  }

  /**
   * Sanitize error messages to remove potential sensitive data
   * @private
   */
  _sanitizeError(error) {
    if (!error || !error.message) return 'Unknown error';
    
    let message = error.message;
    
    // Remove potential API keys (patterns like: sk-*, api_*, etc.)
    message = message.replace(/\b(sk|api|key|token|auth)[-_]?[a-zA-Z0-9]{10,}\b/gi, '[REDACTED]');
    
    // Remove Bearer tokens (including JWT tokens)
    message = message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
    
    // Remove potential passwords
    message = message.replace(/password[=:]\s*['"]?[^'"\s]+['"]?/gi, 'password=[REDACTED]');
    
    // Remove potential email addresses
    message = message.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]');
    
    // Remove file paths that might contain usernames
    message = message.replace(/[A-Z]:\\Users\\[^\\]+/g, '[PATH_REDACTED]');
    message = message.replace(/\/Users\/[^\/]+/g, '[PATH_REDACTED]');
    message = message.replace(/\/home\/[^\/]+/g, '[PATH_REDACTED]');
    
    return message;
  }

  /**
   * Log when modular service/repository is used
   */
  logModularPath(serviceName, methodName) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const message = `[MODULAR] ${timestamp} - ${serviceName}.${methodName}() - Using NEW refactored code`;
    
    console.log(`[OK] ${message}`);
    
    if (this.logToFile) {
      this._writeToFile(message);
    }
  }

  /**
   * Log when legacy code is used (fallback or flag disabled)
   */
  logLegacyPath(serviceName, methodName, reason = 'flag disabled') {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const message = `[LEGACY] ${timestamp} - ${serviceName}.${methodName}() - Using LEGACY code (${reason})`;
    
    console.log(`[WARN] ${message}`);
    
    if (this.logToFile) {
      this._writeToFile(message);
    }
  }

  /**
   * Log when fallback to legacy occurs due to error
   * SECURITY: Error messages are sanitized to remove sensitive data
   */
  logLegacyFallback(serviceName, methodName, error) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const sanitizedError = this._sanitizeError(error);
    const message = `[FALLBACK] ${timestamp} - ${serviceName}.${methodName}() - FALLBACK to legacy due to error: ${sanitizedError}`;
    
    console.warn(`[FALLBACK] ${message}`);
    
    if (this.logToFile) {
      this._writeToFile(message);
    }
  }

  /**
   * Log feature flag initialization status
   */
  logFeatureFlagStatus(flags) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const message = `[FLAGS] ${timestamp} - Feature Flags Status:\n${JSON.stringify(flags, null, 2)}`;
    
    console.log(`[FLAGS] ${message}`);
    
    if (this.logToFile) {
      this._writeToFile(message);
    }
  }

  /**
   * Log initialization of services/repositories
   * SECURITY: Error messages are sanitized to remove sensitive data
   */
  logInitialization(serviceName, success, error = null) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILED';
    const errorMsg = error ? ` - Error: ${this._sanitizeError(error)}` : '';
    const message = `[INIT] ${timestamp} - ${serviceName} initialization: ${status}${errorMsg}`;
    
    const prefix = success ? '[OK]' : '[X]';
    console.log(`${prefix} ${message}`);
    
    if (this.logToFile) {
      this._writeToFile(message);
    }
  }

  /**
   * Generate summary report from all relevant log files
   */
  getSummary() {
    if (!this.logToFile) {
      return 'File logging disabled. Enable with SHADOW_BRIDGE_LOG_FILE=true';
    }
    
    try {
      const files = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('shadow-bridge-') && f.endsWith('.log'));
      let modularCount = 0;
      let legacyCount = 0;
      let fallbackCount = 0;
      
      for (const file of files) {
        const logContent = fs.readFileSync(path.join(os.tmpdir(), file), 'utf-8');
        const lines = logContent.split('\n');
        modularCount += lines.filter(l => l.includes('[MODULAR]')).length;
        legacyCount += lines.filter(l => l.includes('[LEGACY]')).length;
        fallbackCount += lines.filter(l => l.includes('[FALLBACK]')).length;
      }
      
      return {
        logFile: this.logFilePath,
        logFiles: files.length,
        totalCalls: modularCount + legacyCount,
        modularCalls: modularCount,
        legacyCalls: legacyCount,
        fallbackCalls: fallbackCount,
        modularPercentage: (modularCount + legacyCount) > 0 ? ((modularCount / (modularCount + legacyCount)) * 100).toFixed(2) : 0
      };
    } catch (error) {
      return `Error reading log files: ${error.message}`;
    }
  }

  /**
   * Write message to log file
   */
  _writeToFile(message) {
    try {
      fs.appendFileSync(this.logFilePath, `${message}\n`);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
}

// Singleton instance
const logger = new ShadowBridgeLogger();

module.exports = logger;
