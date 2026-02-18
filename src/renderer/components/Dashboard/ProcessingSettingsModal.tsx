/**
 * Story 3.4 Phase 5c.5: ProcessingSettingsModal container – composes useProcessingSettingsModalState,
 * ProcessingSettingsModalHeader, ProcessingSettingsModalContent, ProcessingSettingsModalFooter.
 */
import React from 'react';
import type { ProcessingSettings } from '../../../types/processing';
import { useProcessingSettingsModalState } from './hooks/useProcessingSettingsModalState';
import ProcessingSettingsModalHeader from './components/ProcessingSettingsModalHeader';
import ProcessingSettingsModalContent from './components/ProcessingSettingsModalContent';
import ProcessingSettingsModalFooter from './components/ProcessingSettingsModalFooter';

interface ProcessingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: (useOriginalSettings: boolean, modifiedSettings?: ProcessingSettings, includeMetadata?: boolean, failOptions?: { enabled: boolean; steps: string[] }) => void;
  selectedCount: number;
}

const ProcessingSettingsModal: React.FC<ProcessingSettingsModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  selectedCount,
}) => {
  const state = useProcessingSettingsModalState();

  if (!isOpen) return null;

  const handleRetry = () => {
    const { useOriginalSettings, includeMetadata, failRetryEnabled, failOnSteps, batchSettings } = state;
    if (useOriginalSettings) {
      onRetry(true, undefined, includeMetadata, { enabled: failRetryEnabled, steps: failOnSteps });
    } else {
      onRetry(false, batchSettings, includeMetadata, { enabled: failRetryEnabled, steps: failOnSteps });
    }
  };

  return (
    <div data-testid="processing-settings-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] overflow-hidden flex flex-col">
        <ProcessingSettingsModalHeader selectedCount={selectedCount} onClose={onClose} />
        <ProcessingSettingsModalContent selectedCount={selectedCount} {...state} />
        <ProcessingSettingsModalFooter
          useOriginalSettings={state.useOriginalSettings}
          selectedCount={selectedCount}
          onClose={onClose}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
};

export default ProcessingSettingsModal;
