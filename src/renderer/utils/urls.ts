export function buildLocalFileUrl(input?: string | null): string {
  if (!input) return '';
  
  // If already a factory or local-file URL, normalize it
  if (typeof input === 'string' && (input.startsWith('factory://') || input.startsWith('local-file://'))) {
    const rawPath = input.replace(/^(factory|local-file):\/\/+/,
 '');
    const decodedPath = decodeURIComponent(rawPath);
    return constructFactoryUrl(decodedPath);
  }

  // If a file:// URL was passed, convert to absolute path first
  if (typeof input === 'string' && input.startsWith('file://')) {
    const rawPath = input.replace(/^file:\/\/+/,
 '');
    const decodedPath = decodeURIComponent(rawPath);
    return constructFactoryUrl(decodedPath);
  }

  // Otherwise treat as a filesystem path
  return constructFactoryUrl(String(input));
}

/**
 * Constructs a factory:// URL from a filesystem path.
 * Ensures cross-platform consistency:
 * - Windows: C:\path -> factory://C:/path
 * - POSIX: /home/user -> factory:///home/user
 */
function constructFactoryUrl(p: string): string {
  // Normalize slashes to forward slashes for the URI
  let normalized = p.replace(/\\/g, '/');
  
  // macOS/Linux absolute path: /home/... -> factory:///home/... (3 slashes)
  // Windows absolute path: C:/... -> factory://C:/... (2 slashes)
  
  const isWindowsDrive = /^[a-zA-Z]:/.test(normalized);
  
  // Remove all leading slashes to start clean
  normalized = normalized.replace(/^\/+/, '');
  
  if (isWindowsDrive) {
    return `factory://${normalized}`;
  } else {
    // POSIX absolute path needs leading slash after factory://
    return `factory:///${normalized}`;
  }
}
