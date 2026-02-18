import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { ValidationState } from '../fileSelectorTypes';

export interface FileSelectorValidationMessageProps {
  validationState: ValidationState;
  errorMessage: string;
}

/** Shows only the final result (valid or invalid). While validating, shows nothing so there is no flicker. */
export const FileSelectorValidationMessage: React.FC<FileSelectorValidationMessageProps> = ({
  validationState,
  errorMessage
}) => {
  if (validationState === 'validating') {
    return null;
  }
  if (validationState === 'valid') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span>Valid path</span>
      </div>
    );
  }
  if (validationState === 'invalid' && errorMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
        <AlertCircle className="w-4 h-4" />
        <span>{errorMessage}</span>
      </div>
    );
  }
  return null;
};
