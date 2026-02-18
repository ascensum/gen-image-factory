import React from 'react';
import { Plus, AlertCircle, Loader2 } from 'lucide-react';
import type { ApiKeysSectionProps } from './apiKeysSectionTypes';
import { useApiKeysSection } from './hooks/useApiKeysSection';
import { ApiKeysSectionServiceCard } from './components/ApiKeysSectionServiceCard';

export type { ApiKeysSectionProps } from './apiKeysSectionTypes';

export const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  onApiKeyChange,
  onTestConnection,
  onRemoveService,
  services: propServices,
  isLoading = false,
  error = null
}) => {
  const {
    services,
    visibleKeys,
    handleApiKeyChange,
    handleTestConnection,
    handleAddService,
    handleRemoveService,
    toggleKeyVisibility,
    getServiceTemplate,
    handleDocumentationClick
  } = useApiKeysSection({
    services: propServices,
    onApiKeyChange,
    onTestConnection,
    onRemoveService
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure your API keys for various services. Keys are stored securely using your
          system&apos;s credential manager.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {services.map((service) => (
          <ApiKeysSectionServiceCard
            key={service.name}
            service={service}
            template={getServiceTemplate(service.name)}
            isKeyVisible={!!visibleKeys[service.name]}
            canRemove={services.length > 1}
            onApiKeyChange={handleApiKeyChange}
            onTestConnection={handleTestConnection}
            onRemove={handleRemoveService}
            onToggleVisibility={toggleKeyVisibility}
            onDocumentationClick={handleDocumentationClick}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleAddService}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};
