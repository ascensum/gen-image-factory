/**
 * Utility for building cross-platform local file URLs using the factory:// protocol.
 */

export function buildLocalFileUrl(input?: string | null): string {
  if (!input) return '';
  
  const strInput = String(input);

  // If already a factory URL, normalize it
  if (strInput.startsWith('factory://')) {
    const rawPath = strInput.replace(/^factory:\/\/+/, '');
    const decodedPath = decodeURIComponent(rawPath);
    return constructFactoryUrl(decodedPath);
  }

  // If a file:// URL was passed, convert to absolute path first
  if (strInput.startsWith('file://')) {
    const rawPath = strInput.replace(/^file:\/\/+/, '');
    const decodedPath = decodeURIComponent(rawPath);
    return constructFactoryUrl(decodedPath);
  }

  // Legacy local-file support (migrate to factory internally)
  if (strInput.startsWith('local-file://')) {
    const rawPath = strInput.replace(/^local-file:\/\/+/, '');
    const decodedPath = decodeURIComponent(rawPath);
    return constructFactoryUrl(decodedPath);
  }

  // Otherwise treat as a filesystem path
  return constructFactoryUrl(strInput);
}

/**
 * Constructs a factory:// URL from a filesystem path.
 * Ensures cross-platform consistency:
 * - Windows: C:\path -> factory://C:/path
 * - POSIX: /home/user -> factory:///home/user
 */
function constructFactoryUrl(p: string): string {
  // 1. Normalize all slashes to forward slashes for the URI
  let normalized = p.replace(/\\/g, '/');
  
  // 2. Identify Windows drive letter (e.g., C:/...)
  const isWindowsDrive = /^[a-zA-Z]:/.test(normalized);
  
  // 3. Remove all leading slashes to start from a clean state
  normalized = normalized.replace(/^\/+/, '');
  
  if (isWindowsDrive) {
    // Windows: Resulting URI factory://C:/path/to/file
    return `factory://${normalized}`;
  } else {
    // POSIX: Resulting URI factory:///home/user/file
    return `factory:///${normalized}`;
  }
}