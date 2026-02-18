export const isFeatureEnabled = (featureName: string): boolean => {
  // Check Vite env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const key = `VITE_${featureName}`;
    if (import.meta.env[key] === 'true') return true;
  }
  
  // Check global process (if available in dev)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[featureName] === 'true') return true;
  }

  // Check window object (for runtime toggling)
  if (typeof window !== 'undefined' && (window as any)[featureName] === true) {
    return true;
  }

  return false;
};
