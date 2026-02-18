import { useState, useEffect, useCallback } from 'react';
import { SERVICE_TEMPLATES, DEFAULT_SERVICES } from '../apiKeysSectionConstants';
import type { ApiService, ServiceTemplate } from '../apiKeysSectionTypes';

export interface UseApiKeysSectionOptions {
  services?: ApiService[] | null;
  onApiKeyChange?: (serviceName: string, apiKey: string) => void;
  onTestConnection?: (serviceName: string) => Promise<boolean>;
  onRemoveService?: (serviceName: string) => void;
}

function validateApiKey(serviceName: string, apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') return false;
  const template = SERVICE_TEMPLATES.find((t) => t.name === serviceName);
  if (!template) return apiKey.length >= 10;
  return template.keyPattern.test(apiKey.trim());
}

export function useApiKeysSection(options: UseApiKeysSectionOptions) {
  const { services: propServices, onApiKeyChange, onTestConnection, onRemoveService } = options;

  const [services, setServices] = useState<ApiService[]>(propServices ?? DEFAULT_SERVICES);
  const [showAddService, setShowAddService] = useState(false);
  const [selectedServiceTemplate, setSelectedServiceTemplate] = useState<string>('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (propServices) {
      setServices(propServices);
    }
  }, [propServices]);

  useEffect(() => {
    const check = async () => {
      try {
        if (window.electronAPI?.isSecureStorageAvailable) {
          const isAvailable = await window.electronAPI.isSecureStorageAvailable();
          setServices((prev) =>
            prev.map((s) => ({ ...s, secureStorageAvailable: isAvailable }))
          );
        }
      } catch {
        // ignore
      }
    };
    check();
  }, []);

  const handleApiKeyChange = useCallback(
    (serviceName: string, apiKey: string) => {
      setServices((prev) =>
        prev.map((s) =>
          s.name === serviceName
            ? {
                ...s,
                apiKey,
                isValid: validateApiKey(serviceName, apiKey),
                connectionStatus: 'idle' as const,
                errorMessage: undefined
              }
            : s
        )
      );
      onApiKeyChange?.(serviceName, apiKey);
    },
    [onApiKeyChange]
  );

  const handleTestConnection = useCallback(
    async (serviceName: string) => {
      setServices((prev) =>
        prev.map((s) =>
          s.name === serviceName
            ? { ...s, connectionStatus: 'testing' as const, errorMessage: undefined }
            : s
        )
      );
      try {
        const success = onTestConnection
          ? await onTestConnection(serviceName)
          : await testConnectionDefault(serviceName, services, validateApiKey);
        setServices((prev) =>
          prev.map((s) =>
            s.name === serviceName
              ? {
                  ...s,
                  connectionStatus: success ? 'success' : 'failed',
                  isTested: true,
                  lastTested: new Date(),
                  errorMessage: success ? undefined : 'Connection failed'
                }
              : s
          )
        );
      } catch (err) {
        setServices((prev) =>
          prev.map((s) =>
            s.name === serviceName
              ? {
                  ...s,
                  connectionStatus: 'failed',
                  isTested: true,
                  lastTested: new Date(),
                  errorMessage: err instanceof Error ? err.message : 'Connection failed'
                }
              : s
          )
        );
      }
    },
    [onTestConnection, services]
  );

  const handleAddService = useCallback(() => {
    if (!selectedServiceTemplate) return;
    const template = SERVICE_TEMPLATES.find((t) => t.name === selectedServiceTemplate);
    if (!template) return;
    const newService: ApiService = {
      name: selectedServiceTemplate,
      apiKey: '',
      isValid: false,
      isTested: false,
      secureStorageAvailable: false,
      connectionStatus: 'idle'
    };
    setServices((prev) => [...prev, newService]);
    setShowAddService(false);
    setSelectedServiceTemplate('');
  }, [selectedServiceTemplate]);

  const handleRemoveService = useCallback(
    (serviceName: string) => {
      setServices((prev) => prev.filter((s) => s.name !== serviceName));
      onRemoveService?.(serviceName);
    },
    [onRemoveService]
  );

  const toggleKeyVisibility = useCallback((serviceName: string) => {
    setVisibleKeys((prev) => ({ ...prev, [serviceName]: !prev[serviceName] }));
  }, []);

  const getServiceTemplate = useCallback((serviceName: string): ServiceTemplate => {
    return (
      SERVICE_TEMPLATES.find((t) => t.name === serviceName) ?? SERVICE_TEMPLATES[SERVICE_TEMPLATES.length - 1]
    );
  }, []);

  const handleDocumentationClick = useCallback((url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    }
  }, []);

  return {
    services,
    visibleKeys,
    showAddService,
    setShowAddService,
    selectedServiceTemplate,
    setSelectedServiceTemplate,
    handleApiKeyChange,
    handleTestConnection,
    handleAddService,
    handleRemoveService,
    toggleKeyVisibility,
    getServiceTemplate,
    handleDocumentationClick
  };
}

async function testConnectionDefault(
  serviceName: string,
  services: ApiService[],
  validate: (name: string, key: string) => boolean
): Promise<boolean> {
  const service = services.find((s) => s.name === serviceName);
  const template = SERVICE_TEMPLATES.find((t) => t.name === serviceName);
  if (!service || !template?.testEndpoint) {
    throw new Error('Service not configured for testing');
  }
  await new Promise((r) => setTimeout(r, 1000));
  return validate(serviceName, service.apiKey);
}
