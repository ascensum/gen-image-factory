export function buildLocalFileUrl(absolutePath?: string | null): string {
  if (!absolutePath) return '';
  // Normalize Windows backslashes to URL-style slashes
  let normalized = absolutePath.replace(/\\/g, '/');
  // Ensure exactly three slashes after scheme and avoid introducing a hostname segment
  // Example:
  //  - "/Users/name/file.png"  -> "local-file:///Users/name/file.png"
  //  - "C:/Users/name/file.png" -> "local-file:///C:/Users/name/file.png"
  normalized = normalized.replace(/^\/+/, '');
  return `local-file:///${normalized}`;
}


