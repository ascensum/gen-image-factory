/**
 * Styling helpers for FileSelector (Story 3.4 Phase 5c.10).
 */
import type { ValidationState } from './fileSelectorTypes';

export function getFileSelectorInputStyling(
  validationState: ValidationState,
  errorMessage: string,
  disabled: boolean,
  error: string | undefined,
  className?: string
): string {
  const baseClasses =
    'flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';
  const customClasses = className || '';

  if (disabled) {
    return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed ${customClasses}`;
  }
  if (error || (validationState === 'invalid' && errorMessage)) {
    return `${baseClasses} border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500 ${customClasses}`;
  }
  if (validationState === 'valid') {
    return `${baseClasses} border-green-300 text-green-900 focus:ring-green-500 focus:border-green-500 ${customClasses}`;
  }
  return `${baseClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${customClasses}`;
}
