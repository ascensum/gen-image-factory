export function buildLocalFileUrl(input?: string | null): string {
  if (!input) return '';
  try {
    function finalize(u: string): string {
      try {
        // Ensure exactly three slashes after protocol
        if (u.startsWith('local-file://') && !u.startsWith('local-file:///')) {
          u = u.replace(/^local-file:\/\/+/, 'local-file:///');
        }
        // macOS: fix lowercased /users authority leak patterns
        if (u.startsWith('local-file://users/')) {
          u = 'local-file:///Users/' + u.slice('local-file://users/'.length);
        }
        // Extra safety: collapse multiple leading slashes after protocol to exactly three
        u = u.replace(/^local-file:\/+/, 'local-file:///');
        // Debug rare cases
        if (u.startsWith('local-file://users/')) {
          console.warn('[urls] Unexpected URL after finalize, still has host "users":', u);
        }
      } catch {}
      return u;
    }
    // If already a local-file URL, normalize it to ensure no host segment leaks (e.g., local-file://users/...)
    if (typeof input === 'string' && input.startsWith('local-file://')) {
      const url = new URL(input);
      const host = url.hostname; // e.g., "users" when wrongly constructed as local-file://users/...
      let pathname = decodeURIComponent(url.pathname || '');
      if (host) {
        // Prepend host to pathname to reconstruct absolute path (/users/...)
        pathname = `/${host}${pathname}`;
      }
      // macOS: correct common case mistake where '/users' should be '/Users'
      if (typeof navigator !== 'undefined' && navigator.userAgent && /Mac OS X/.test(navigator.userAgent)) {
        if (pathname.startsWith('/users/')) {
          pathname = '/Users/' + pathname.slice('/users/'.length);
        }
      }
      // Ensure single leading slash on POSIX, keep drive letter on Windows
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;
      // Always return with exactly three slashes (no authority/host)
      return finalize(`local-file:///${pathname.replace(/^\/+/, '')}`);
    }
    // If a file:// URL was passed, convert to absolute path first
    if (typeof input === 'string' && input.startsWith('file://')) {
      const url = new URL(input);
      const host = url.hostname;
      let pathname = decodeURIComponent(url.pathname || '');
      if (host) {
        pathname = `/${host}${pathname}`;
      }
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;
      return finalize(`local-file:///${pathname.replace(/^\/+/, '')}`);
    }
    // Otherwise treat as a filesystem path (relative or absolute)
    let p = String(input).replace(/\\/g, '/'); // normalize backslashes
    // Windows drive letter: "C:/..." or "C:\..."
    const drive = /^[a-zA-Z]:\//.test(p);
    // Ensure leading slash for URL path
    if (!p.startsWith('/')) {
      if (drive) {
        p = `/${p}`;
      } else {
        // Assume POSIX absolute-like if not drive letter; prepend slash as safest choice
        p = `/${p}`;
      }
    }
    return finalize(`local-file:///${p.replace(/^\/+/, '')}`);
  } catch {
    // As a last resort, fall back to naive construction
    const normalized = String(input).replace(/\\/g, '/').replace(/^\/+/, '');
    return `local-file:///${normalized}`;
  }
}


