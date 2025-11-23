/**
 * Utility to mask sensitive data in log messages
 * @param {string} text - The text to process
 * @returns {string} - The processed text with sensitive data masked
 */
function maskSensitiveData(text) {
  if (typeof text !== 'string') return text;
  
  // Patterns to look for (common API key formats)
  // 1. OpenAI: sk-... (typically 51 chars)
  // 2. Generic API Key looking strings: (32+ chars of random alphanumeric)
  // 3. Labelled keys in JSON or output: "apiKey": "..."
  
  let masked = text;
  
  // Mask OpenAI-style keys (sk-...)
  // Look for sk- followed by at least 20 alphanumeric chars
  masked = masked.replace(/(sk-[a-zA-Z0-9]{20,})/g, (match) => {
    return `${match.substring(0, 3)}...${match.substring(match.length - 4)}`;
  });

  // Mask Anthropic-style keys (sk-ant-...)
  masked = masked.replace(/(sk-ant-[a-zA-Z0-9\-_]{20,})/g, (match) => {
    return `${match.substring(0, 7)}...${match.substring(match.length - 4)}`;
  });

  // Mask Google-style keys (AIza...)
  masked = masked.replace(/(AIza[0-9A-Za-z\-_]{30,})/g, (match) => {
    return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
  });
  
  // Mask generic "apiKey": "VALUE" patterns in JSON strings
  // This handles JSON stringified objects containing keys
  masked = masked.replace(/("api[_-]?key"\s*:\s*")([^"]+)(")/gi, (match, prefix, key, suffix) => {
    if (key.length < 8) return match; // Too short to be a real key probably
    return `${prefix}${key.substring(0, 3)}...${key.substring(key.length - 4)}${suffix}`;
  });
  
  return masked;
}

/**
 * Safe logger wrapper that masks sensitive data
 */
const safeLogger = {
  log: (...args) => {
    console.log(...args.map(arg => 
      typeof arg === 'string' ? maskSensitiveData(arg) : arg
    ));
  },
  error: (...args) => {
    console.error(...args.map(arg => 
      typeof arg === 'string' ? maskSensitiveData(arg) : arg
    ));
  },
  warn: (...args) => {
    console.warn(...args.map(arg => 
      typeof arg === 'string' ? maskSensitiveData(arg) : arg
    ));
  },
  info: (...args) => {
    console.info(...args.map(arg => 
      typeof arg === 'string' ? maskSensitiveData(arg) : arg
    ));
  },
  mask: maskSensitiveData
};

module.exports = { maskSensitiveData, safeLogger };

