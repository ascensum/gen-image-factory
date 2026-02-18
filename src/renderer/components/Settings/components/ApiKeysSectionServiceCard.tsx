import React from 'react';
import {
  Trash2,
  TestTube,
  Shield,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import type { ApiService, ServiceTemplate } from '../apiKeysSectionTypes';

export interface ApiKeysSectionServiceCardProps {
  service: ApiService;
  template: ServiceTemplate;
  isKeyVisible: boolean;
  canRemove: boolean;
  onApiKeyChange: (serviceName: string, apiKey: string) => void;
  onTestConnection: (serviceName: string) => void;
  onRemove: (serviceName: string) => void;
  onToggleVisibility: (serviceName: string) => void;
  onDocumentationClick: (url: string) => void;
}

export const ApiKeysSectionServiceCard: React.FC<ApiKeysSectionServiceCardProps> = ({
  service,
  template,
  isKeyVisible,
  canRemove,
  onApiKeyChange,
  onTestConnection,
  onRemove,
  onToggleVisibility,
  onDocumentationClick
}) => {
  const ServiceIcon = template.icon;
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ServiceIcon className="w-6 h-6" />
          <div>
            <h3 className="font-medium text-gray-900">{template.displayName}</h3>
            <p className="text-sm text-gray-500">API Key Configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {service.secureStorageAvailable ? (
              <Shield className="w-4 h-4 text-green-500" title="Secure storage available" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-yellow-500" title="Secure storage unavailable" />
            )}
          </div>
          {service.connectionStatus === 'testing' && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          {service.connectionStatus === 'success' && (
            <CheckCircle className="w-4 h-4 text-green-500" title="Connection successful" />
          )}
          {service.connectionStatus === 'failed' && (
            <AlertCircle className="w-4 h-4 text-red-500" title="Connection failed" />
          )}
          <button
            type="button"
            onClick={() => onTestConnection(service.name)}
            disabled={!service.isValid || service.connectionStatus === 'testing'}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <TestTube className="w-3 h-3" />
            Test
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(service.name)}
              className="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded transition-colors"
              title="Remove service"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor={`${service.name}-key`} className="block text-sm font-medium text-gray-700">
          API Key
        </label>
        <div className="relative">
          <input
            id={`${service.name}-key`}
            type={isKeyVisible ? 'text' : 'password'}
            value={service.apiKey}
            onChange={(e) => onApiKeyChange(service.name, e.target.value)}
            className={`w-full px-3 py-2 pr-20 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors ${
              service.apiKey && !service.isValid
                ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
                : service.isValid
                  ? 'border-green-300 text-green-900 focus:ring-green-500 focus:border-green-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder={template.placeholder}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button
              type="button"
              onClick={() => onToggleVisibility(service.name)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              title={isKeyVisible ? 'Hide API key' : 'Show API key'}
            >
              {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {service.apiKey && !service.isValid && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Invalid API key format
          </p>
        )}
        {service.errorMessage && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {service.errorMessage}
          </p>
        )}
        {template.documentationUrl && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDocumentationClick(template.documentationUrl!)}
              className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Get API Key
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
