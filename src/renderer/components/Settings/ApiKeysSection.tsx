import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, TestTube, Shield, ShieldAlert, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';

// Types and Interfaces
interface ApiService {
  name: string;
  apiKey: string;
  isValid: boolean;
  isTested: boolean;
  secureStorageAvailable: boolean;
  lastTested?: Date;
  connectionStatus?: 'success' | 'failed' | 'testing' | 'idle';
  errorMessage?: string;
}

interface ApiKeysSectionProps {
  onApiKeyChange?: (serviceName: string, apiKey: string) => void;
  onTestConnection?: (serviceName: string) => Promise<boolean>;
  onRemoveService?: (serviceName: string) => void;
  services?: ApiService[];
  isLoading?: boolean;
  error?: string | null;
}

interface ServiceTemplate {
  name: string;
  displayName: string;
  icon: React.ComponentType<{ className?: string }>;
  keyPattern: RegExp;
  testEndpoint?: string;
  documentationUrl?: string;
  placeholder: string;
}

// Service templates with validation patterns
const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    icon: ({ className }) => <div className={`${className} bg-green-500 rounded`} />,
    keyPattern: /^sk-[a-zA-Z0-9]{48}$/,
    testEndpoint: 'https://api.openai.com/v1/models',
    documentationUrl: 'https://platform.openai.com/docs/api-reference',
    placeholder: 'sk-...'
  },
  {
    name: 'midjourney',
    displayName: 'Midjourney',
    icon: ({ className }) => <div className={`${className} bg-purple-500 rounded`} />,
    keyPattern: /^mj-[a-zA-Z0-9\-_]{32,}$/,
    documentationUrl: 'https://docs.midjourney.com/',
    placeholder: 'mj-...'
  },
  {
    name: 'stable-diffusion',
    displayName: 'Stable Diffusion',
    icon: ({ className }) => <div className={`${className} bg-blue-500 rounded`} />,
    keyPattern: /^sd-[a-zA-Z0-9\-_]{32,}$/,
    documentationUrl: 'https://stability.ai/docs',
    placeholder: 'sd-...'
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    icon: ({ className }) => <div className={`${className} bg-orange-500 rounded`} />,
    keyPattern: /^sk-ant-[a-zA-Z0-9\-_]{95}$/,
    testEndpoint: 'https://api.anthropic.com/v1/messages',
    documentationUrl: 'https://docs.anthropic.com/',
    placeholder: 'sk-ant-...'
  },
  {
    name: 'custom',
    displayName: 'Custom Service',
    icon: ({ className }) => <div className={`${className} bg-gray-500 rounded`} />,
    keyPattern: /^[a-zA-Z0-9\-_]{10,}$/,
    placeholder: 'Enter custom API key...'
  }
];

// Default services
const DEFAULT_SERVICES: ApiService[] = [
  {
    name: 'openai',
    apiKey: '',
    isValid: false,
    isTested: false,
    secureStorageAvailable: false,
    connectionStatus: 'idle'
  }
];

export const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  onApiKeyChange,
  onTestConnection,
  onRemoveService,
  services: propServices,
  isLoading = false,
  error = null
}) => {
  // State management
  const [services, setServices] = useState<ApiService[]>(propServices || DEFAULT_SERVICES);
  const [showAddService, setShowAddService] = useState(false);
  const [selectedServiceTemplate, setSelectedServiceTemplate] = useState<string>('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // Update services when props change
  useEffect(() => {
    if (propServices) {
      setServices(propServices);
    }
  }, [propServices]);

  // Check secure storage availability for all services
  useEffect(() => {
    checkSecureStorageAvailability();
  }, []);

  // Check secure storage availability
  const checkSecureStorageAvailability = async () => {
    try {
      if (window.electronAPI?.isSecureStorageAvailable) {
        const isAvailable = await window.electronAPI.isSecureStorageAvailable();
        setServices(prev => prev.map(service => ({
          ...service,
          secureStorageAvailable: isAvailable
        })));
      }
    } catch (error) {
      console.error('Error checking secure storage:', error);
    }
  };

  // Handle API key change
  const handleApiKeyChange = useCallback((serviceName: string, apiKey: string) => {
    setServices(prev => prev.map(service => 
      service.name === serviceName 
        ? { 
            ...service, 
            apiKey, 
            isValid: validateApiKey(serviceName, apiKey),
            connectionStatus: 'idle',
            errorMessage: undefined
          }
        : service
    ));
    
    onApiKeyChange?.(serviceName, apiKey);
  }, [onApiKeyChange]);

  // Validate API key format
  const validateApiKey = (serviceName: string, apiKey: string): boolean => {
    if (!apiKey || apiKey.trim() === '') return false;
    
    const template = SERVICE_TEMPLATES.find(t => t.name === serviceName);
    if (!template) return apiKey.length >= 10; // Basic validation for custom services
    
    return template.keyPattern.test(apiKey.trim());
  };

  // Test API connection
  const handleTestConnection = useCallback(async (serviceName: string) => {
    setServices(prev => prev.map(service => 
      service.name === serviceName 
        ? { ...service, connectionStatus: 'testing', errorMessage: undefined }
        : service
    ));

    try {
      const success = onTestConnection 
        ? await onTestConnection(serviceName)
        : await testConnectionDefault(serviceName);

      setServices(prev => prev.map(service => 
        service.name === serviceName 
          ? { 
              ...service, 
              connectionStatus: success ? 'success' : 'failed',
              isTested: true,
              lastTested: new Date(),
              errorMessage: success ? undefined : 'Connection failed'
            }
          : service
      ));
    } catch (error) {
      setServices(prev => prev.map(service => 
        service.name === serviceName 
          ? { 
              ...service, 
              connectionStatus: 'failed',
              isTested: true,
              lastTested: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Connection failed'
            }
          : service
      ));
    }
  }, [onTestConnection]);

  // Default connection test implementation
  const testConnectionDefault = async (serviceName: string): Promise<boolean> => {
    const service = services.find(s => s.name === serviceName);
    const template = SERVICE_TEMPLATES.find(t => t.name === serviceName);
    
    if (!service || !template || !template.testEndpoint) {
      throw new Error('Service not configured for testing');
    }

    // Simulate API test (in real implementation, this would make actual API calls)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, return true if API key is valid format
    return validateApiKey(serviceName, service.apiKey);
  };

  // Add new service
  const handleAddService = useCallback(() => {
    if (!selectedServiceTemplate) return;

    const template = SERVICE_TEMPLATES.find(t => t.name === selectedServiceTemplate);
    if (!template) return;

    const newService: ApiService = {
      name: selectedServiceTemplate,
      apiKey: '',
      isValid: false,
      isTested: false,
      secureStorageAvailable: false,
      connectionStatus: 'idle'
    };

    setServices(prev => [...prev, newService]);
    setShowAddService(false);
    setSelectedServiceTemplate('');
  }, [selectedServiceTemplate]);

  // Remove service
  const handleRemoveService = useCallback((serviceName: string) => {
    setServices(prev => prev.filter(service => service.name !== serviceName));
    onRemoveService?.(serviceName);
  }, [onRemoveService]);

  // Toggle API key visibility
  const toggleKeyVisibility = (serviceName: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [serviceName]: !prev[serviceName]
    }));
  };

  // Get service template
  const getServiceTemplate = (serviceName: string) => {
    return SERVICE_TEMPLATES.find(t => t.name === serviceName) || SERVICE_TEMPLATES[SERVICE_TEMPLATES.length - 1];
  };

  // Handle documentation link click
  const handleDocumentationClick = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    }
  };

  // Service Card Component
  const ServiceCard: React.FC<{ service: ApiService }> = ({ service }) => {
    const template = getServiceTemplate(service.name);
    const ServiceIcon = template.icon;

    return (
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Service Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ServiceIcon className="w-6 h-6" />
            <div>
              <h3 className="font-medium text-gray-900">{template.displayName}</h3>
              <p className="text-sm text-gray-500">API Key Configuration</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Secure Storage Status */}
            <div className="flex items-center gap-1">
              {service.secureStorageAvailable ? (
                <Shield className="w-4 h-4 text-green-500" title="Secure storage available" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-yellow-500" title="Secure storage unavailable" />
              )}
            </div>

            {/* Connection Status */}
            {service.connectionStatus === 'testing' && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            )}
            {service.connectionStatus === 'success' && (
              <CheckCircle className="w-4 h-4 text-green-500" title="Connection successful" />
            )}
            {service.connectionStatus === 'failed' && (
              <AlertCircle className="w-4 h-4 text-red-500" title="Connection failed" />
            )}

            {/* Test Connection Button */}
            <button
              type="button"
              onClick={() => handleTestConnection(service.name)}
              disabled={!service.isValid || service.connectionStatus === 'testing'}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <TestTube className="w-3 h-3" />
              Test
            </button>

            {/* Remove Service Button */}
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveService(service.name)}
                className="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded transition-colors"
                title="Remove service"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <label htmlFor={`${service.name}-key`} className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <div className="relative">
            <input
              id={`${service.name}-key`}
              type={visibleKeys[service.name] ? 'text' : 'password'}
              value={service.apiKey}
              onChange={(e) => handleApiKeyChange(service.name, e.target.value)}
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
                onClick={() => toggleKeyVisibility(service.name)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                title={visibleKeys[service.name] ? 'Hide API key' : 'Show API key'}
              >
                {visibleKeys[service.name] ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Validation Message */}
          {service.apiKey && !service.isValid && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Invalid API key format
            </p>
          )}

          {/* Error Message */}
          {service.errorMessage && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {service.errorMessage}
            </p>
          )}

          {/* Documentation Link */}
          {template.documentationUrl && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDocumentationClick(template.documentationUrl!)}
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">API Keys</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure your API keys for various services. Keys are stored securely using your system's credential manager.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="space-y-4">
        {services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>

      {/* Add Service Button */}
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

      {/* Loading Overlay */}
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